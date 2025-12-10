/**
 * Normalize prompt text for LLM delivery.
 * - Collapse multiple blank lines to a single newline
 * - Trim leading/trailing whitespace
 * - Remove trailing spaces before newlines
 */
export function normalizePromptText(text: string): string {
	return text
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{2,}/g, "\n")
		.trim();
}
