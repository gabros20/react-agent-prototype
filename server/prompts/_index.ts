/**
 * Prompt Loader
 *
 * Loads tool prompt files with hot-reload support.
 * In dev mode: Always reads fresh from disk
 * In prod mode: Caches content
 *
 * Prompt files use XML format (.xml extension)
 *
 * NOTE: Agent system prompt is now STATIC and loaded via system-prompt.ts.
 * Tool guidance is injected as conversation messages via tool-guidance-messages.ts.
 */

// Re-export only actively used builder exports
// ToolPromptInjector is used by tool-guidance-messages.ts
export { ToolPromptInjector, getToolPrompt, getToolPrompts } from "./_builder";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== "production";

// Cache for prompt content (production only)
const promptCache = new Map<string, string>();

// ============================================================================
// Tool Prompts
// ============================================================================

/**
 * Load a tool-specific prompt file if it exists
 * Returns null if no prompt file exists for this tool
 */
export function loadToolPrompt(toolName: string): string | null {
	const promptPath = `tools/${toolName}-prompt.xml`;
	const fullPath = path.join(__dirname, promptPath);

	if (!fs.existsSync(fullPath)) {
		return null; // Tool doesn't have a prompt file (schema + description are sufficient)
	}

	// Dev mode: always read fresh (hot-reload)
	if (isDev) {
		return fs.readFileSync(fullPath, "utf-8");
	}

	// Prod mode: cache content
	const cacheKey = `tool:${toolName}`;
	if (!promptCache.has(cacheKey)) {
		promptCache.set(cacheKey, fs.readFileSync(fullPath, "utf-8"));
	}
	return promptCache.get(cacheKey)!;
}

/**
 * Load prompts for multiple tools
 * Only loads prompts that exist - tools without prompts are skipped
 *
 * Used by tool-guidance-messages.ts to inject tool guidance as conversation messages.
 */
export function loadToolPrompts(toolNames: string[]): string {
	return toolNames
		.map((name) => {
			const prompt = loadToolPrompt(name);
			if (!prompt) return null;
			// Prompt file already has <toolName>...</toolName> wrapper
			return prompt.trim();
		})
		.filter(Boolean)
		.join("\n\n");
}

/**
 * List all available tool prompt files
 */
export function listToolPrompts(): string[] {
	const toolsDir = path.join(__dirname, "tools");
	if (!fs.existsSync(toolsDir)) {
		return [];
	}

	return fs
		.readdirSync(toolsDir)
		.filter((file) => file.endsWith("-prompt.xml"))
		.map((file) => file.replace("-prompt.xml", ""));
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear the prompt cache (useful for testing or forcing reload)
 */
export function clearPromptCache(): void {
	promptCache.clear();
}

/**
 * Check if a prompt file exists
 */
export function promptExists(relativePath: string): boolean {
	const fullPath = path.join(__dirname, relativePath);
	return fs.existsSync(fullPath);
}
