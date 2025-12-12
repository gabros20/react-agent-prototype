/**
 * CMS Agent - AI SDK v6 ToolLoopAgent
 *
 * Singleton agent with dynamic tool injection:
 * - Starts with searchTools and finalAnswer only
 * - Discovers tools via searchTools calls
 * - Discovered tools + their tool prompts injected via prepareStep
 * - Cross-turn persistence via WorkingContext (handled by ContextManager)
 *
 * NOTE: Module-level state is a limitation of AI SDK's ToolLoopAgent pattern.
 * prepareStep doesn't have access to experimental_context, so we must store
 * state at module level. Each new request overwrites this state via prepareCall.
 */

import { ToolLoopAgent, stepCountIs, hasToolCall, NoSuchToolError, InvalidToolInputError } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { ALL_TOOLS } from "../tools/_index";
import { getAgentSystemPrompt } from "./system-prompt";
import { PromptBuilder, ToolPromptInjector } from "../prompts/builder";
import { ToolSearchManager, type StepResult } from "../memory/tool-search";
import type { AgentContext, AgentLogger, StreamWriter } from "../tools/types";
import type { DrizzleDB } from "../db/client";
import type { Services } from "../services/types";
import type { VectorIndexService } from "../services/vector-index";

// ============================================================================
// Module-Level State (AI SDK limitation - prepareStep lacks context access)
// ============================================================================

/** Last injected tool prompts (for SSE emission to debug panel) */
let lastInjectedInstructions: {
	instructions: string;
	tools: string[];
	updatedSystemPrompt: string | null;
} | null = null;

/** Base system prompt from prepareCall (used by prepareStep) */
let currentBaseSystemPrompt: string = "";

/** Discovered tools from previous turns (loaded at turn start) */
let persistedDiscoveredTools: string[] = [];

/** Tool search manager instance (singleton - stateless) */
const toolSearchManager = new ToolSearchManager();

// ============================================================================
// Exports for Orchestrator
// ============================================================================

export function getLastInjectedInstructions() {
	const result = lastInjectedInstructions;
	lastInjectedInstructions = null; // Clear after reading
	return result;
}

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

export const AgentCallOptionsSchema = z.object({
	// Identifiers
	sessionId: z.string(),
	traceId: z.string(),

	// Dynamic model selection (e.g. "openai/gpt-4o", "anthropic/claude-3.5-sonnet")
	modelId: z.string().optional(),

	// Working memory context (injected into system prompt)
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
});

export type AgentCallOptions = z.infer<typeof AgentCallOptionsSchema>;

// ============================================================================
// CMS Agent Definition
// ============================================================================

export const cmsAgent = new ToolLoopAgent({
	model: openrouter.languageModel(AGENT_CONFIG.modelId),

	instructions: "", // overwritten by prepareCall with dynamic system prompt

	tools: ALL_TOOLS,

	callOptionsSchema: AgentCallOptionsSchema,

	// prepareCall: Build dynamic instructions and inject runtime context
	prepareCall: ({ options, ...settings }) => {
		// Generate minimal agent system prompt (with searchTools for discovery)
		const dynamicInstructions = getAgentSystemPrompt({
			currentDate: new Date().toISOString(),
			workingMemory: options.workingMemory || "",
		});

		// Store for prepareStep to build updated version with injected instructions
		currentBaseSystemPrompt = dynamicInstructions;

		// Store discovered tools from previous turns (passed directly from WorkingContext)
		persistedDiscoveredTools = options.discoveredTools || [];

		// Dynamic model selection: use requested model or fall back to default
		const model = options.modelId
			? openrouter.languageModel(options.modelId)
			: openrouter.languageModel(AGENT_CONFIG.modelId);

		return {
			...settings,
			// Override model if custom modelId provided
			model,
			// Override instructions with minimal agent prompt
			instructions: dynamicInstructions,
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
	prepareStep: async ({ stepNumber, steps }: { stepNumber: number; steps: StepResult[] }) => {
		type ToolName = keyof typeof ALL_TOOLS;

		// Extract tools from current execution steps using ToolSearchManager
		const fromCurrentSteps = toolSearchManager.extractFromSteps(steps);

		// Combine: persisted tools (previous turns) + current step discoveries
		const discoveredTools = [...new Set([...persistedDiscoveredTools, ...fromCurrentSteps])] as ToolName[];

		// Debug log
		if (discoveredTools.length > 0 || fromCurrentSteps.length > 0) {
			console.log(
				`[prepareStep] Step ${stepNumber} | Tools: persisted=${persistedDiscoveredTools.length}, current=${fromCurrentSteps.length}, total=${discoveredTools.length}`
			);
		}

		// Build tool prompts using ToolPromptInjector (deduplicates automatically)
		const toolsNeedingProtocols = [...new Set([...CORE_TOOLS, ...discoveredTools])];
		const injector = new ToolPromptInjector()
			.addCoreTools([...CORE_TOOLS])
			.addDiscoveredTools(discoveredTools);
		const toolInstructions = injector.build();

		// Build updated prompt using PromptBuilder (type-safe, no regex)
		const normalizedContent = PromptBuilder
			.fromTemplate(currentBaseSystemPrompt)
			.withToolInstructions(toolInstructions)
			.build();

		// Store for SSE emission (debug panel)
		if (toolInstructions) {
			lastInjectedInstructions = {
				instructions: toolInstructions,
				tools: toolsNeedingProtocols,
				updatedSystemPrompt: normalizedContent,
			};
		}

		// Step 0: Force acknowledgeRequest tool to create conversational preflight response
		// This ensures the user sees acknowledgment before any action is taken
		if (stepNumber === 0) {
			return {
				activeTools: [...CORE_TOOLS] as ToolName[],
				toolChoice: { type: "tool" as const, toolName: "acknowledgeRequest" as const },
				instructions: normalizedContent,
			};
		}

		// Step 1 with no tools discovered: Discovery phase
		// Agent can use searchTools to find capabilities
		if (stepNumber === 1 && discoveredTools.length === 0) {
			return {
				activeTools: [...CORE_TOOLS] as ToolName[],
				toolChoice: "auto" as const,
				instructions: normalizedContent,
			};
		}

		// Phase 2: Execution (tools discovered)
		// All discovered tools available, plus core tools
		const activeTools = [...new Set([...CORE_TOOLS, ...discoveredTools])] as ToolName[];

		return {
			activeTools,
			toolChoice: "auto" as const,
			instructions: normalizedContent,
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
