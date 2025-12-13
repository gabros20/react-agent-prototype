/**
 * Tool Guidance Messages Factory
 *
 * Creates user-assistant message pairs for tool guidance injection.
 * This preserves LLM cache (system prompt stays static).
 *
 * Pattern from CACHE_SAFE_DYNAMIC_INJECTION_PLAN.md:
 * - Tool prompts were injected into <tool-usage-instructions> in system prompt
 * - This broke caching because system prompt changed every step
 * - Now: inject as conversation messages when new tools are discovered
 *
 * Flow:
 * 1. Agent calls searchTools -> discovers new tools
 * 2. prepareStep injects tool guidance as user-assistant pair
 * 3. Agent has context for new tools without modifying system prompt
 */

import type { ModelMessage } from "ai";
import { ToolPromptInjector } from "../_builder/tool-prompt-injector";

// ============================================================================
// Tool Guidance Messages
// ============================================================================

/**
 * Create tool guidance messages for newly discovered tools
 *
 * Returns a user-assistant pair that teaches the agent about discovered tools.
 * The user message contains the guidance, assistant acknowledges.
 *
 * @param newTools - Tools discovered in current step (not seen before)
 * @param existingTools - Tools already known (for context)
 * @returns Array of ModelMessage (user + assistant) or empty if no new tools
 */
export function createToolGuidanceMessages(newTools: string[], existingTools: string[] = []): ModelMessage[] {
	if (newTools.length === 0) {
		return [];
	}

	// Load prompts only for NEW tools
	const injector = new ToolPromptInjector();
	injector.addTools(newTools);
	const toolGuidance = injector.build();

	// If no actual guidance content (tools have no prompt files), still acknowledge
	const toolList = newTools.join(", ");

	if (!toolGuidance.trim()) {
		// Tools discovered but no specific guidance - just acknowledge availability
		return [
			{
				role: "user",
				content: `[TOOL GUIDANCE] New tools now available: ${toolList}

These tools are ready to use. Check their schema for parameters.`,
			},
			{
				role: "assistant",
				content: `I now have access to: ${toolList}. I'll use them as needed.`,
			},
		];
	}

	// Full guidance with prompts
	return [
		{
			role: "user",
			content: `[TOOL GUIDANCE] New tools now available: ${toolList}

Here are the usage guidelines:

${toolGuidance}

Please follow these guidelines when using these tools.`,
		},
		{
			role: "assistant",
			content: `I understand. I now have access to: ${toolList}. I'll follow the provided guidelines when using these tools.`,
		},
	];
}

/**
 * Create a compact tool reminder message
 *
 * Lightweight - just lists available tools without full guidance.
 * Use when you want to remind the agent of available tools
 * without the full prompt content.
 */
export function createToolReminderMessage(availableTools: string[]): ModelMessage {
	return {
		role: "user",
		content: `[AVAILABLE TOOLS] ${availableTools.join(", ")}`,
	};
}

/**
 * Create initial tool guidance for core tools
 *
 * Called once at session start to provide guidance for always-available tools.
 * This is optional - core tools often don't need explicit guidance.
 */
export function createCoreToolGuidanceMessages(coreTools: string[]): ModelMessage[] {
	const injector = new ToolPromptInjector();
	injector.addCoreTools(coreTools);
	const guidance = injector.build();

	if (!guidance.trim()) {
		return []; // Core tools don't need explicit guidance
	}

	return [
		{
			role: "user",
			content: `[TOOL GUIDANCE] Core tools always available:

${guidance}`,
		},
		{
			role: "assistant",
			content: `I understand the core tools. Ready to assist.`,
		},
	];
}

// ============================================================================
// Export
// ============================================================================

export const toolGuidanceMessages = {
	createToolGuidanceMessages,
	createToolReminderMessage,
	createCoreToolGuidanceMessages,
};
