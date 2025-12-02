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

import { ToolLoopAgent, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { ALL_TOOLS } from "../tools/all-tools";
import { getSystemPrompt } from "./system-prompt";
import type { AgentContext } from "../tools/types";

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

	// Working memory context (injected into system prompt)
	workingMemory: z.string().optional(),

	// CMS target (site/environment)
	cmsTarget: z.object({
		siteId: z.string(),
		environmentId: z.string(),
	}),

	// Runtime-injected services (passed through to tools via experimental_context)
	db: z.custom<any>(),
	services: z.custom<any>(),
	sessionService: z.custom<any>(),
	vectorIndex: z.custom<any>(),
	logger: z.custom<any>(),
	stream: z.custom<any>().optional(),
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

		return {
			...settings,
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
});
