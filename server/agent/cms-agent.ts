/**
 * CMS Agent - AI SDK v6 ToolLoopAgent
 *
 * Singleton agent with dynamic tool injection:
 * - Starts with tool_search and final_answer only
 * - Discovers tools via tool_search calls
 * - Discovered tools + their instructions injected via prepareStep
 * - Cross-turn persistence via WorkingContext (handled by ContextManager)
 */

import { ToolLoopAgent, stepCountIs, hasToolCall, NoSuchToolError, InvalidToolInputError } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { ALL_TOOLS } from "../tools/all-tools";
import { getAgentSystemPrompt } from "./system-prompt";
import { getToolInstructions } from "../tools/instructions";
import { normalizePromptText } from "../utils/prompt-normalizer";
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
			activeTools: ["tool_search", "final_answer", "acknowledge"] as (keyof typeof ALL_TOOLS)[],
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
	prepareStep: async ({ stepNumber, steps }: { stepNumber: number; steps: any[] }) => {
		type ToolName = keyof typeof ALL_TOOLS;

		// Get tools from current execution steps
		const { extractToolsFromSteps } = await import("../tools/discovery");
		const fromCurrentSteps = extractToolsFromSteps(steps);

		// Combine: persisted tools (previous turns) + current step discoveries
		const discoveredTools = [...new Set([...persistedDiscoveredTools, ...fromCurrentSteps])] as ToolName[];

		// Debug log
		if (discoveredTools.length > 0 || fromCurrentSteps.length > 0) {
			console.log(
				`[prepareStep] Step ${stepNumber} | Tools: persisted=${persistedDiscoveredTools.length}, current=${fromCurrentSteps.length}, total=${discoveredTools.length}`
			);
		}

		// Core tools always available
		const coreTools: ToolName[] = ["tool_search", "final_answer", "acknowledge"];

		// Build tool instructions for all core + discovered tools up-front so every step (including 0/1)
		// has the protocols injected. This keeps the image URL rule and other gotchas always in context.
		const toolsNeedingProtocols = [...new Set([...coreTools, ...discoveredTools])];
		const toolInstructions = getToolInstructions(toolsNeedingProtocols);

		// Replace the tool-calling instructions placeholder in the base system prompt
		const updatedContent = toolInstructions
			? currentBaseSystemPrompt.replace(
					/<tool-usage-instructions>[\s\S]*?<\/tool-usage-instructions>/g,
					`<tool-usage-instructions>\n${toolInstructions}\n</tool-usage-instructions>`
			  )
			: currentBaseSystemPrompt;

		const normalizedContent = normalizePromptText(updatedContent);

		// Store for SSE emission (debug panel)
		if (toolInstructions) {
			lastInjectedInstructions = {
				instructions: toolInstructions,
				tools: toolsNeedingProtocols,
				updatedSystemPrompt: normalizedContent,
			};
		}

		// Step 0: Force acknowledge tool to create conversational preflight response
		// This ensures the user sees acknowledgment before any action is taken
		if (stepNumber === 0) {
			return {
				activeTools: coreTools,
				toolChoice: { type: "tool" as const, toolName: "acknowledge" as const },
				instructions: normalizedContent,
			};
		}

		// Step 1 with no tools discovered: Discovery phase
		// Agent can use tool_search to find capabilities
		if (stepNumber === 1 && discoveredTools.length === 0) {
			return {
				activeTools: coreTools,
				toolChoice: "auto" as const,
				instructions: normalizedContent,
			};
		}

		// Phase 2: Execution (tools discovered)
		// All discovered tools available, plus core tools
		const activeTools = [...coreTools, ...discoveredTools] as ToolName[];

		const result = {
			activeTools,
			toolChoice: "auto" as const,
			instructions: normalizedContent,
		};

		// Note: Message trimming is now handled by ContextManager in orchestrator
		// for coordinated cleanup of messages AND discovered tools

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
