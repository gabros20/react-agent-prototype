/**
 * Step Extraction Utilities
 *
 * Extracts tool information from AI SDK step results.
 * Used by prepareStep to determine which tools were discovered during execution.
 */

interface SearchToolsResult {
	tools?: string[];  // searchTools returns string[] not { name: string }[]
	message?: string;
}

interface ToolResult {
	toolName: string;
	result: unknown;
}

interface StepResult {
	toolResults?: ToolResult[];
}

/**
 * Extract discovered tools from current execution steps.
 * Steps contain searchTools results from CURRENT multi-step execution.
 */
export function extractToolsFromSteps(steps: StepResult[]): string[] {
	const tools = new Set<string>();

	for (const step of steps) {
		const searchResults = step.toolResults?.filter((tr) => tr.toolName === "searchTools");
		searchResults?.forEach((sr) => {
			const result = sr.result as SearchToolsResult;
			// searchTools returns tools as string[] directly
			result?.tools?.forEach((toolName) => tools.add(toolName));
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
