/**
 * CMS Agent - AI SDK v6 ToolLoopAgent (Cache-Safe Architecture)
 *
 * Dynamic tool injection with STATIC system prompt:
 * - System prompt NEVER changes (preserves LLM cache)
 * - Working memory injected as conversation messages
 * - Tool guidance injected as conversation messages
 * - Discovered tools + their prompts injected via prepareStep messages
 *
 * Cache Benefits:
 * - OpenAI: 50% discount on cached prefix
 * - Anthropic: 90% discount on cached prefix
 * - All providers: Stable system prompt = cache hits
 *
 * NOTE: Module-level state is a limitation of AI SDK's ToolLoopAgent pattern.
 * prepareStep doesn't have access to experimental_context, so we must store
 * state at module level. Each new request overwrites this state via prepareCall.
 */

import { ToolLoopAgent, stepCountIs, hasToolCall, NoSuchToolError, InvalidToolInputError, type CoreMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { ALL_TOOLS } from "../tools/_index";
import { getStaticSystemPrompt } from "./system-prompt";
import { ToolSearchManager, type StepResult } from "../memory/tool-search";
import { createToolGuidanceMessages } from "../prompts/messages";
import type { AgentContext, AgentLogger, StreamWriter } from "../tools/types";
import type { DrizzleDB } from "../db/client";
import type { Services } from "../services/types";
import type { VectorIndexService } from "../services/vector-index";

// ============================================================================
// Module-Level State (AI SDK limitation - prepareStep lacks context access)
// ============================================================================
//
// CONCURRENCY WARNING: This module-level state is NOT thread-safe.
// AI SDK's ToolLoopAgent.prepareStep() doesn't receive options/context,
// forcing us to store state at module level. Each request overwrites
// these values in prepareCall().
//
// Current mitigation: Single-process Express server handles requests
// sequentially within the Node.js event loop. Parallel requests are
// still a race condition risk (e.g., load balancer with multiple instances).
//
// Future fix options:
// 1. Request AI SDK team to add context to prepareStep signature
// 2. Use request-scoped AsyncLocalStorage for state isolation
// 3. Create per-request agent instances (expensive, defeats caching)
// ============================================================================

/** Discovered tools from previous turns (loaded at turn start) */
let persistedDiscoveredTools: string[] = [];

/** Tools that have already had guidance injected in this turn */
let toolsWithGuidanceInjected: Set<string> = new Set();

/** Callback for SSE emission when instructions are injected */
let onInstructionsInjectedCallback: ((data: { tools: string[]; instructions: string; stepNumber: number }) => void) | null = null;

/** Tool search manager instance (singleton - stateless) */
const toolSearchManager = new ToolSearchManager();

// NOTE: getLastInjectedInstructions was removed - we now use onInstructionsInjected callback
// for SSE emission, passed via AgentCallOptions and stored in onInstructionsInjectedCallback

// ============================================================================
// Provider Setup
// ============================================================================

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
});

// ============================================================================
// Agent Configuration
// ============================================================================

export const AGENT_CONFIG = {
	maxSteps: 15, // Higher limit for complex multi-step CMS tasks
	modelId: "openai/gpt-4o-mini",
	maxOutputTokens: 4096,
} as const;

/** Core tools that are always available */
const CORE_TOOLS = toolSearchManager.getCoreTools();

// ============================================================================
// Call Options Schema (replaces experimental_context typing)
// ============================================================================

/** Callback for when tool instructions are injected */
export type OnInstructionsInjected = (data: {
	tools: string[];
	instructions: string;
	stepNumber: number;
}) => void;

export const AgentCallOptionsSchema = z.object({
	// Identifiers
	sessionId: z.string(),
	traceId: z.string(),

	// Dynamic model selection (e.g. "openai/gpt-4o", "anthropic/claude-3.5-sonnet")
	modelId: z.string().optional(),

	// NOTE: workingMemory is now injected as conversation messages by context-coordinator
	// This field is kept for backward compatibility but is NOT used in system prompt
	workingMemory: z.string().optional(),

	// Discovered tools from previous turns (from WorkingContext)
	// Passed directly to avoid fragile regex parsing from system prompt
	discoveredTools: z.array(z.string()).optional(),

	// CMS target (site/environment)
	cmsTarget: z.object({
		siteId: z.string(),
		environmentId: z.string(),
	}),

	// Runtime-injected services (passed through to tools via experimental_context)
	// Using z.custom with proper types - validation happens at runtime via TypeScript
	db: z.custom<DrizzleDB>((val) => val != null),
	services: z.custom<Services>((val) => val != null),
	vectorIndex: z.custom<VectorIndexService>((val) => val != null),
	logger: z.custom<AgentLogger>((val) => val != null),
	stream: z.custom<StreamWriter>((val) => val != null).optional(),

	// Callback for SSE emission when tool instructions are injected
	onInstructionsInjected: z.custom<OnInstructionsInjected>((val) => typeof val === 'function' || val == null).optional(),
});

export type AgentCallOptions = z.infer<typeof AgentCallOptionsSchema>;

// ============================================================================
// CMS Agent Definition
// ============================================================================

export const cmsAgent = new ToolLoopAgent({
	model: openrouter.languageModel(AGENT_CONFIG.modelId),

	// STATIC instructions - never changes (preserves LLM cache)
	instructions: getStaticSystemPrompt(),

	tools: ALL_TOOLS,

	callOptionsSchema: AgentCallOptionsSchema,

	// prepareCall: Initialize per-request state
	prepareCall: ({ options, ...settings }) => {
		// Store discovered tools from previous turns (passed directly from WorkingContext)
		persistedDiscoveredTools = options.discoveredTools || [];

		// Reset guidance tracking for this new turn
		toolsWithGuidanceInjected = new Set([...CORE_TOOLS, ...persistedDiscoveredTools]);

		// Store callback for SSE emission when instructions are injected
		onInstructionsInjectedCallback = options.onInstructionsInjected || null;

		// Dynamic model selection: use requested model or fall back to default
		const model = options.modelId ? openrouter.languageModel(options.modelId) : openrouter.languageModel(AGENT_CONFIG.modelId);

		return {
			...settings,
			// Override model if custom modelId provided
			model,
			// STATIC instructions - do NOT override with dynamic content
			// This preserves LLM prefix caching
			instructions: getStaticSystemPrompt(),
			maxOutputTokens: AGENT_CONFIG.maxOutputTokens,
			// Start with core tools - others added via prepareStep
			activeTools: [...CORE_TOOLS] as (keyof typeof ALL_TOOLS)[],
			// experimental_context is how tools access runtime services
			experimental_context: {
				db: options.db,
				services: options.services,
				vectorIndex: options.vectorIndex,
				logger: options.logger,
				stream: options.stream,
				traceId: options.traceId,
				sessionId: options.sessionId,
				cmsTarget: options.cmsTarget,
			} as AgentContext,
		};
	},

	// Native stop conditions (combined with OR logic)
	// Stops when: max steps reached OR finalAnswer tool is called
	stopWhen: [stepCountIs(AGENT_CONFIG.maxSteps), hasToolCall("finalAnswer")],

	// Dynamic tool availability via prepareStep
	// KEY CHANGE: Inject tool guidance via MESSAGES, not instructions
	prepareStep: async ({ stepNumber, steps, messages }: { stepNumber: number; steps: StepResult[]; messages: CoreMessage[] }) => {
		type ToolName = keyof typeof ALL_TOOLS;

		// Extract tools from current execution steps using ToolSearchManager
		const fromCurrentSteps = toolSearchManager.extractFromSteps(steps);

		// Combine: persisted tools (previous turns) + current step discoveries
		const discoveredTools = [...new Set([...persistedDiscoveredTools, ...fromCurrentSteps])] as ToolName[];

		// Find NEW tools (discovered in this step, not seen before)
		const newlyDiscovered = fromCurrentSteps.filter((tool) => !toolsWithGuidanceInjected.has(tool));

		// Debug log
		if (discoveredTools.length > 0 || fromCurrentSteps.length > 0) {
			console.log(
				`[prepareStep] Step ${stepNumber} | Tools: persisted=${persistedDiscoveredTools.length}, current=${fromCurrentSteps.length}, new=${newlyDiscovered.length}, total=${discoveredTools.length}`
			);
		}

		// Inject tool guidance as MESSAGES (not into instructions)
		let updatedMessages = [...messages];
		if (newlyDiscovered.length > 0 && stepNumber > 0) {
			const guidanceMessages = createToolGuidanceMessages(newlyDiscovered, [...toolsWithGuidanceInjected]);

			if (guidanceMessages.length > 0) {
				// APPEND guidance at the END of messages (after all tool results)
				// This preserves the assistant→tool message sequence required by OpenAI
				// The LLM will see the guidance before generating its next response
				updatedMessages = [...updatedMessages, ...guidanceMessages];

				console.log(`[prepareStep] Injected guidance for: ${newlyDiscovered.join(", ")}`);

				// Mark these tools as having guidance
				for (const tool of newlyDiscovered) {
					toolsWithGuidanceInjected.add(tool);
				}

				// Emit via callback for SSE to frontend (debug panel)
				if (onInstructionsInjectedCallback) {
					const injectorContent = guidanceMessages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
					onInstructionsInjectedCallback({
						tools: newlyDiscovered,
						instructions: injectorContent,
						stepNumber,
					});
				}
			}
		}

		// Step 0: Force acknowledgeRequest tool to create conversational preflight response
		// This ensures the user sees acknowledgment before any action is taken
		if (stepNumber === 0) {
			return {
				activeTools: [...CORE_TOOLS] as ToolName[],
				toolChoice: { type: "tool" as const, toolName: "acknowledgeRequest" as const },
				messages: updatedMessages,
				// NO instructions override - use static system prompt
			};
		}

		// Step 1 with no tools discovered: Discovery phase
		// Agent can use searchTools to find capabilities
		if (stepNumber === 1 && discoveredTools.length === 0) {
			return {
				activeTools: [...CORE_TOOLS] as ToolName[],
				toolChoice: "auto" as const,
				messages: updatedMessages,
			};
		}

		// Phase 2: Execution (tools discovered)
		// All discovered tools available, plus core tools
		const activeTools = [...new Set([...CORE_TOOLS, ...discoveredTools])] as ToolName[];

		return {
			activeTools,
			toolChoice: "auto" as const,
			messages: updatedMessages,
			// NO instructions override - preserves LLM cache
		};
	},

	// Step completion callback for telemetry
	// Logging is handled by the route handler via options.logger
	// Message saving happens at the end via onFinish in the route
	onStepFinish: async () => {
		// No-op - handled by route handler
	},

	// Handle malformed tool calls - let model retry naturally
	experimental_repairToolCall: async ({ toolCall, error }) => {
		// Don't attempt to fix unknown tool names
		if (NoSuchToolError.isInstance(error)) {
			console.warn(`[repairToolCall] Unknown tool: ${toolCall.toolName}`);
			return null;
		}

		// For invalid input, log and let prompt-based recovery handle it
		if (InvalidToolInputError.isInstance(error)) {
			console.warn(`[repairToolCall] Invalid input for ${toolCall.toolName}:`, error.message);
			// Could implement schema-based repair here in future
			// For now, return null to let the model retry naturally
			return null;
		}

		console.warn(`[repairToolCall] Unhandled error for ${toolCall.toolName}:`, error);
		return null;
	},
});
