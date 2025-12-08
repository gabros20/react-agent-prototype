/**
 * Discovery Utilities
 *
 * Helper functions for tool discovery system.
 * - Extract discovered tools from working memory (previous turns)
 * - Extract discovered tools from current execution steps
 * - Extract used tools from current execution steps
 *
 * Implements Phase 7.2.2 from DYNAMIC_TOOL_INJECTION_PLAN.md
 */

import type { CoreMessage, ToolResultPart } from "ai";

// ============================================================================
// Types
// ============================================================================

/** AI SDK 6 StepResult structure (simplified for our needs) */
interface StepResult {
	toolCalls?: Array<{
		toolName: string;
		input: unknown; // AI SDK 5+ renamed args → input
	}>;
	toolResults?: Array<{
		toolName: string;
		output: unknown; // AI SDK 5+ renamed result → output
	}>;
	text?: string;
}

/** Tool search result structure - matches tool-search.ts output */
interface ToolSearchResult {
	tools?: string[];  // tool_search returns string array, not { name: string }[]
	message?: string;
}

// ============================================================================
// Extract from Working Memory
// ============================================================================

/**
 * Extract discovered tools from working memory in system message.
 * Working memory contains tools from PREVIOUS conversation turns.
 *
 * Working memory format in system prompt:
 * ```
 * **Available Tools:** discoveredTools: ["cms_getPage", "cms_updatePage", ...]
 * ```
 */
export function extractToolsFromWorkingMemory(
	systemMessage: CoreMessage | undefined
): string[] {
	if (!systemMessage || systemMessage.role !== "system") {
		return [];
	}

	// Get content as string - system messages can have string or array content
	const rawContent = systemMessage.content as unknown;
	let content = "";

	if (typeof rawContent === "string") {
		content = rawContent;
	} else if (Array.isArray(rawContent)) {
		// Handle array of content parts
		content = rawContent
			.filter((p: any) => p?.type === "text" && typeof p?.text === "string")
			.map((p: any) => p.text as string)
			.join("");
	}

	if (!content) {
		return [];
	}

	// Match discoveredTools array in working memory
	// Format: discoveredTools: ["tool1", "tool2", ...]
	const match = content.match(/discoveredTools:\s*\[([^\]]*)\]/);
	if (!match) {
		return [];
	}

	// Parse the array contents
	return match[1]
		.split(",")
		.map((s: string) => s.trim().replace(/['"]/g, ""))
		.filter(Boolean);
}

// ============================================================================
// Extract from Steps
// ============================================================================

/**
 * Extract discovered tools from current execution steps.
 * Steps contain tool_search results from CURRENT multi-step execution.
 */
export function extractToolsFromSteps(steps: StepResult[]): string[] {
	const tools = new Set<string>();

	for (const step of steps) {
		// Check tool results for tool_search calls
		const searchResults = step.toolResults?.filter(
			(tr) => tr.toolName === "tool_search"
		);

		searchResults?.forEach((sr) => {
			// AI SDK 5+ uses 'output' instead of 'result'
			const output = sr.output as ToolSearchResult | undefined;
			// tool_search returns string[] not { name: string }[]
			output?.tools?.forEach((toolName) => {
				if (toolName && typeof toolName === 'string') {
					tools.add(toolName);
				}
			});
		});
	}

	return Array.from(tools);
}

/**
 * Extract used tools from current execution steps.
 * Tracks which tools were actually called (not just discovered).
 */
export function extractUsedToolsFromSteps(steps: StepResult[]): string[] {
	const tools = new Set<string>();

	for (const step of steps) {
		step.toolCalls?.forEach((tc) => {
			// Don't count tool_search itself as a "used" tool
			if (tc.toolName !== "tool_search") {
				tools.add(tc.toolName);
			}
		});
	}

	return Array.from(tools);
}

// ============================================================================
// Combine Discovery Sources
// ============================================================================

/**
 * Get all discovered tools from both working memory and current steps.
 * This is the main function used by prepareStep.
 */
export function getAllDiscoveredTools(
	messages: CoreMessage[],
	steps: StepResult[]
): string[] {
	// Working memory contains tools from previous turns
	const workingMemoryTools = extractToolsFromWorkingMemory(messages[0]);

	// Steps contain tools discovered in current execution
	const currentStepTools = extractToolsFromSteps(steps);

	// Combine and deduplicate
	return [...new Set([...workingMemoryTools, ...currentStepTools])];
}
