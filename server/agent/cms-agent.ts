/**
 * CMS Agent - Centralized AI SDK v6 ToolLoopAgent
 *
 * Single-file agent definition following AI SDK v6 best practices:
 * - Module-level singleton agent
 * - Type-safe call options with callOptionsSchema
 * - Dynamic instructions via prepareCall
 * - Native stop conditions
 * - Working memory via system prompt injection
 */

import { ToolLoopAgent, stepCountIs, NoSuchToolError, InvalidToolInputError } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { ALL_TOOLS } from "../tools/all-tools";
import { getSystemPrompt } from "./system-prompt";
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
		// Generate dynamic system prompt with working memory
		const dynamicInstructions = getSystemPrompt({
			currentDate: new Date().toISOString().split("T")[0],
			workingMemory: options.workingMemory || "",
		});

		// Dynamic model selection: use requested model or fall back to default
		const model = options.modelId ? openrouter.languageModel(options.modelId) : openrouter.languageModel(AGENT_CONFIG.modelId);

		return {
			...settings,
			// Override model if custom modelId provided
			model,
			// Override instructions with dynamic version
			instructions: dynamicInstructions,
			maxOutputTokens: AGENT_CONFIG.maxOutputTokens,
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

	// Context window management - trim if too long
	// TODO: Future enhancement - use `activeTools` in prepareStep for phase-based tool control
	// Example: Restrict to read-only tools during planning, enable write tools during execution
	// See: https://v6.ai-sdk.dev/docs/agents/loop-control#active-tools
	prepareStep: async ({ messages }: { messages: any[] }) => {
		// Trim history if too long (prevent token overflow)
		if (messages.length > 20) {
			return {
				messages: [
					messages[0], // Keep system prompt
					...messages.slice(-10), // Keep last 10 messages
				],
			};
		}
		return {};
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
