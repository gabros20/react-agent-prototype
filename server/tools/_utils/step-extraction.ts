/**
 * Step Extraction Utilities
 *
 * Extracts tool information from AI SDK step results.
 * Used by prepareStep to determine which tools were discovered during execution.
 */

/** Tool search result structure - matches searchTools output */
interface SearchToolsResult {
	tools?: string[];
	message?: string;
}

/** AI SDK 6 StepResult structure (simplified for our needs) */
interface StepResult {
	toolResults?: Array<{
		toolName: string;
		output: unknown;  // AI SDK 6 uses 'output' not 'result'
	}>;
}

/**
 * Extract discovered tools from current execution steps.
 * Steps contain searchTools results from CURRENT multi-step execution.
 */
export function extractToolsFromSteps(steps: StepResult[]): string[] {
	const tools = new Set<string>();

	for (const step of steps) {
		// Check tool results for searchTools calls
		const searchResults = step.toolResults?.filter(
			(tr) => tr.toolName === "searchTools"
		);

		searchResults?.forEach((sr) => {
			// AI SDK 6 uses 'output' instead of 'result'
			const output = sr.output as SearchToolsResult | undefined;
			// searchTools returns string[] directly
			output?.tools?.forEach((toolName) => {
				if (toolName && typeof toolName === "string") {
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
		step.toolResults?.forEach((tr) => {
			// Exclude meta-tools from "used" tracking
			if (!["searchTools", "finalAnswer", "acknowledgeRequest"].includes(tr.toolName)) {
				tools.add(tr.toolName);
			}
		});
	}

	return Array.from(tools);
}

// Re-export for debugging
export type { StepResult, SearchToolsResult };
