/**
 * Tool Prompt Loader
 *
 * Loads tool-specific prompts from prompts/tools/{toolName}-prompt.xml files.
 * These prompts are injected into the system prompt via {{{activeProtocols}}}.
 *
 * Hot-reload: In dev mode, always reads fresh from disk.
 * In production, caches prompts for performance.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== "production";
const toolPromptCache = new Map<string, string | null>();

/**
 * Read a tool prompt file from disk
 */
function readToolPromptFile(toolName: string): string | null {
	const promptPath = path.join(
		__dirname,
		"../../prompts/tools",
		`${toolName}-prompt.xml`,
	);

	if (!fs.existsSync(promptPath)) {
		return null; // No prompt for this tool (schema + description are sufficient)
	}

	return fs.readFileSync(promptPath, "utf-8");
}

/**
 * Load tool prompt for a tool (hot-reload in dev)
 *
 * @param toolName - Name of the tool (e.g., "cms_createPost")
 * @returns Prompt content or null if no prompt file exists
 */
export function loadToolPrompt(toolName: string): string | null {
	// Dev mode: always read fresh from disk
	if (isDev) {
		return readToolPromptFile(toolName);
	}

	// Production: use cache
	if (!toolPromptCache.has(toolName)) {
		toolPromptCache.set(toolName, readToolPromptFile(toolName));
	}
	return toolPromptCache.get(toolName) || null;
}

/**
 * Get prompts for multiple tools, formatted for system prompt injection.
 * Returns combined prompts for all tools that have prompt files.
 *
 * @param toolNames - Array of tool names to get prompts for
 * @returns Combined prompt string for injection into {{{activeProtocols}}}
 */
export function getToolPrompts(toolNames: string[]): string {
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
export function listToolPromptFiles(): string[] {
	const toolsDir = path.join(__dirname, "../../prompts/tools");

	if (!fs.existsSync(toolsDir)) {
		return [];
	}

	return fs
		.readdirSync(toolsDir)
		.filter((file) => file.endsWith("-prompt.xml"))
		.map((file) => file.replace("-prompt.xml", ""));
}

/**
 * Clear the tool prompt cache (useful for testing)
 */
export function clearToolPromptCache(): void {
	toolPromptCache.clear();
}
