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

import { ToolLoopAgent, stepCountIs, NoSuchToolError, InvalidToolInputError } from "ai";
import type { CoreMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { ALL_TOOLS, CORE_TOOLS, DYNAMIC_TOOLS } from "../tools/all-tools";
import { getAgentSystemPrompt } from "./system-prompt";
import { getAllDiscoveredTools } from "../tools/discovery";
import type { AgentContext, AgentLogger, StreamWriter } from "../tools/types";
import type { DrizzleDB } from "../db/client";
import type { ServiceContainer } from "../services/service-container";
import type { SessionService } from "../services/session-service";
import type { VectorIndexService } from "../services/vector-index";

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
// Custom Stop Condition: FINAL_ANSWER Detection
// ============================================================================

const hasFinalAnswer = ({ steps }: { steps: any[] }) => {
	const lastStep = steps[steps.length - 1];
	return lastStep?.text?.includes("FINAL_ANSWER:") || false;
};

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
			currentDate: new Date().toISOString().split("T")[0],
			workingMemory: options.workingMemory || "",
		});

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
			// Start with only discovery tool - others added via prepareStep
			activeTools: ["tool_search"] as (keyof typeof ALL_TOOLS)[],
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
	stopWhen: [stepCountIs(AGENT_CONFIG.maxSteps), hasFinalAnswer],

	// Dynamic tool availability via prepareStep
	// Implements Phase 7 from DYNAMIC_TOOL_INJECTION_PLAN.md
	prepareStep: async ({
		stepNumber,
		steps,
		messages,
	}: {
		stepNumber: number;
		steps: any[];
		messages: CoreMessage[];
	}) => {
		type ToolName = keyof typeof ALL_TOOLS;

		// Extract tools discovered from working memory (previous turns) + current steps
		const discoveredTools = getAllDiscoveredTools(messages, steps) as ToolName[];

		// Phase 1: Discovery (step 0, no tools discovered yet)
		// Use 'auto' - agent decides whether to call tool_search or answer directly
		if (stepNumber === 0 && discoveredTools.length === 0) {
			return {
				activeTools: ["tool_search"] as ToolName[],
				toolChoice: "auto" as const,
			};
		}

		// Phase 2: Execution (tools discovered)
		// All discovered tools available, plus tool_search for additional discovery
		const activeTools = ["tool_search", ...discoveredTools] as ToolName[];

		const result: {
			activeTools: ToolName[];
			toolChoice: "auto";
			messages?: CoreMessage[];
		} = {
			activeTools,
			toolChoice: "auto" as const,
		};

		// =====================================================================
		// Stuck Detection: Detect repeated identical tool calls
		// =====================================================================
		const recentCalls = steps.slice(-3).flatMap((step: any) =>
			(step.toolCalls || []).map((tc: any) => ({
				name: tc.toolName,
				input: JSON.stringify(tc.input || {}),
			}))
		);

		// Check for 2+ identical consecutive calls
		if (recentCalls.length >= 2) {
			const last = recentCalls[recentCalls.length - 1];
			const secondLast = recentCalls[recentCalls.length - 2];

			if (last.name === secondLast.name && last.input === secondLast.input) {
				// Inject a system message to break the loop
				const stuckMessage: CoreMessage = {
					role: "system" as const,
					content: `⚠️ STUCK DETECTED: You called ${last.name} with identical parameters twice in a row. This indicates a loop. STOP and try a different approach:
1. If you need different results, use different parameters
2. If the tool isn't working, try an alternative tool
3. If you're blocked, explain the issue to the user
DO NOT call ${last.name} with the same parameters again.`,
				};

				// Prepend stuck warning to messages
				result.messages = result.messages
					? [result.messages[0], stuckMessage, ...result.messages.slice(1)]
					: [...messages.slice(0, -1), stuckMessage, messages[messages.length - 1]];

				console.warn(`[prepareStep] Stuck detected: ${last.name} called twice with same params`);
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
