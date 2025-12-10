/**
 * Discovery Utilities
 *
 * Extract discovered tools from current execution steps.
 * Used by prepareStep to get tools discovered via tool_search in the current turn.
 *
 * Note: Cross-turn tool persistence is handled by ContextManager and WorkingContext.
 * Tools from previous turns are passed directly via options.discoveredTools.
 */

// ============================================================================
// Types
// ============================================================================

/** AI SDK 6 StepResult structure (simplified for our needs) */
interface StepResult {
	toolResults?: Array<{
		toolName: string;
		output: unknown;
	}>;
}

/** Tool search result structure - matches tool-search.ts output */
interface ToolSearchResult {
	tools?: string[];
	message?: string;
}

// ============================================================================
// Extract from Steps
// ============================================================================

/**
 * Extract discovered tools from current execution steps.
 * Finds tool_search results and extracts the returned tool names.
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
