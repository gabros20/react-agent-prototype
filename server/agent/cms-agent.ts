/**
 * CMS Agent - Centralized AI SDK v6 ToolLoopAgent
 *
 * Single-file agent definition following AI SDK v6 best practices:
 * - Module-level singleton agent
 * - Type-safe call options with callOptionsSchema
 * - Dynamic instructions via prepareCall
 * - Dynamic tool availability via prepareStep (Phase 7)
 * - Native stop conditions
 * - Working memory via system prompt injection
 *
 * Dynamic Tool Injection Architecture:
 * - Agent starts with only tool_search
 * - Agent discovers tools via tool_search calls
 * - Discovered tools become available via activeTools in prepareStep
 * - Rules are injected alongside discovered tools
 */

import { ToolLoopAgent, stepCountIs, hasToolCall, NoSuchToolError, InvalidToolInputError } from "ai";
import type { CoreMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { ALL_TOOLS } from "../tools/all-tools";
import { getAgentSystemPrompt } from "./system-prompt";
import { getToolInstructions } from "../tools/instructions";
import type { AgentContext, AgentLogger, StreamWriter } from "../tools/types";
import type { DrizzleDB } from "../db/client";
import type { ServiceContainer } from "../services/service-container";
import type { SessionService } from "../services/session-service";
import type { VectorIndexService } from "../services/vector-index";

// Module-level store for last injected instructions (for SSE emission)
let lastInjectedInstructions: {
	instructions: string;
	tools: string[];
	updatedSystemPrompt: string | null;
} | null = null;

// Store the base system prompt from prepareCall so prepareStep can build updated version
let currentBaseSystemPrompt: string = "";

// Store discovered tools from working memory (loaded at turn start)
// This avoids fragile regex parsing from system prompt text
let persistedDiscoveredTools: string[] = [];

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
	services: z.custom<ServiceContainer>((val) => val != null),
	sessionService: z.custom<SessionService>((val) => val != null),
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
		// Generate minimal agent system prompt (with tool_search for discovery)
		const dynamicInstructions = getAgentSystemPrompt({
			currentDate: new Date().toISOString(),
			workingMemory: options.workingMemory || "",
		});

		// Store for prepareStep to build updated version with injected instructions
		currentBaseSystemPrompt = dynamicInstructions;

		// Store discovered tools from previous turns (passed directly from WorkingContext)
		persistedDiscoveredTools = options.discoveredTools || [];

		// Dynamic model selection: use requested model or fall back to default
		const model = options.modelId ? openrouter.languageModel(options.modelId) : openrouter.languageModel(AGENT_CONFIG.modelId);

		return {
			...settings,
			// Override model if custom modelId provided
			model,
			// Override instructions with minimal agent prompt
			instructions: dynamicInstructions,
			maxOutputTokens: AGENT_CONFIG.maxOutputTokens,
			// Start with core tools - others added via prepareStep
			activeTools: ["tool_search", "final_answer"] as (keyof typeof ALL_TOOLS)[],
			// experimental_context is how tools access runtime services
			experimental_context: {
				db: options.db,
				services: options.services,
				sessionService: options.sessionService,
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
	// Stops when: max steps reached OR final_answer tool is called
	stopWhen: [stepCountIs(AGENT_CONFIG.maxSteps), hasToolCall("final_answer")],

	// Dynamic tool availability via prepareStep
	// Implements Per-Tool Instruction Architecture from PER_TOOL_INSTRUCTION_ARCHITECTURE.md
	prepareStep: async ({ stepNumber, steps, messages }: { stepNumber: number; steps: any[]; messages: CoreMessage[] }) => {
		type ToolName = keyof typeof ALL_TOOLS;

		// Get tools from current execution steps
		const { extractToolsFromSteps } = await import("../tools/discovery");
		const fromCurrentSteps = extractToolsFromSteps(steps);

		// Combine: persisted tools (previous turns) + current step discoveries
		// persistedDiscoveredTools is set in prepareCall from WorkingContext directly
		const discoveredTools = [...new Set([...persistedDiscoveredTools, ...fromCurrentSteps])] as ToolName[];

		// Debug: trace cross-turn tool sources
		console.log(`[prepareStep] Step ${stepNumber} | Tool sources:`);
		console.log(`  - Persisted (previous turns): [${persistedDiscoveredTools.join(", ") || "none"}]`);
		console.log(`  - Current steps: [${fromCurrentSteps.join(", ") || "none"}]`);
		console.log(`  - Combined: [${discoveredTools.join(", ") || "none"}]`);

		// Log what LLM actually receives in tools array
		const toolsForLLM = ["tool_search", "final_answer", ...discoveredTools];
		console.log(`  - Tools sent to LLM API (${toolsForLLM.length}): [${toolsForLLM.join(", ")}]`);

		// Core tools always available
		const coreTools: ToolName[] = ["tool_search", "final_answer"];

		// Phase 1: Discovery (step 0, no tools discovered yet)
		// Use 'auto' - agent decides whether to call tool_search or answer directly
		if (stepNumber === 0 && discoveredTools.length === 0) {
			return {
				activeTools: coreTools,
				toolChoice: "auto" as const,
			};
		}

		// Phase 2: Execution (tools discovered)
		// All discovered tools available, plus core tools
		const activeTools = [...coreTools, ...discoveredTools] as ToolName[];

		const result: {
			activeTools: ToolName[];
			toolChoice: "auto";
			messages?: CoreMessage[];
		} = {
			activeTools,
			toolChoice: "auto" as const,
		};

		// =====================================================================
		// Per-Tool Protocol Injection: Inject <active-protocols> into system prompt
		// ALWAYS include core tools (final_answer, tool_search) + any discovered tools
		// =====================================================================
		{
			// Get all tools that need protocols (core tools ALWAYS + discovered)
			const toolsNeedingProtocols = [...new Set(["final_answer", "tool_search", ...discoveredTools])];
			const toolInstructions = getToolInstructions(toolsNeedingProtocols);

			// Log final activeTools and instructions (after cross-turn sync debug above)
			console.log(`  - Final activeTools: [${activeTools.join(", ")}]`);
			console.log(`  - Instructions for: [${toolsNeedingProtocols.join(", ")}]`);

			// Store for SSE emission (read by orchestrator)
			// Include the full updated system prompt so debug panel can show what agent actually sees
			if (toolInstructions) {
				lastInjectedInstructions = {
					instructions: toolInstructions,
					tools: toolsNeedingProtocols,
					updatedSystemPrompt: null, // Will be set below if we update the prompt
				};
			}

			if (toolInstructions) {
				// Build updated system prompt from the base (stored in prepareCall)
				let updatedContent = currentBaseSystemPrompt;

				// Replace <active-protocols> content in-place
				updatedContent = updatedContent.replace(
					/<active-protocols>[\s\S]*?<\/active-protocols>/g,
					`<active-protocols>\n${toolInstructions}\n</active-protocols>`
				);

				// Store full updated system prompt for debug panel
				if (lastInjectedInstructions) {
					lastInjectedInstructions.updatedSystemPrompt = updatedContent;
				}

				return {
					...result,
					instructions: updatedContent,
				};
			}
		}

		// Message trimming for long conversations (prevent token overflow)
		if (!result.messages && messages.length > 30) {
			result.messages = [
				messages[0], // Keep system prompt
				...messages.slice(-15), // Keep last 15 messages for long-horizon tasks
			];
		}

		return result;
	},

	// Step completion callback for telemetry
	// Logging is handled by the route handler via options.logger
	// Message saving happens at the end via onFinish in the route
	onStepFinish: async () => {
		// No-op - handled by route handler
	},

	// Handle malformed tool calls - let model retry naturally
	experimental_repairToolCall: async ({ toolCall, tools, error }) => {
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
