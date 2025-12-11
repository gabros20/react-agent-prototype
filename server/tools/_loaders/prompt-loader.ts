/**
 * Generic Prompt Loader
 *
 * Generic utilities for loading prompt files with hot-reload support.
 * Specific loaders (tool-prompt-loader.ts) build on these primitives.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== "production";

// Cache for prompt files (production only)
const promptCache = new Map<string, string>();

/**
 * Base prompts directory
 */
const PROMPTS_DIR = path.join(__dirname, "../../prompts");

/**
 * Load a prompt file from disk.
 *
 * @param relativePath - Path relative to server/prompts/
 * @returns File contents or null if not found
 *
 * @example
 * const agentPrompt = loadPromptFile('agent/main-agent-prompt.xml')
 * const toolPrompt = loadPromptFile('tools/createPost-prompt.xml')
 */
export function loadPromptFile(relativePath: string): string | null {
	const fullPath = path.join(PROMPTS_DIR, relativePath);

	if (!fs.existsSync(fullPath)) {
		return null;
	}

	// Dev mode: always read fresh
	if (isDev) {
		return fs.readFileSync(fullPath, "utf-8");
	}

	// Production: use cache
	if (!promptCache.has(relativePath)) {
		promptCache.set(relativePath, fs.readFileSync(fullPath, "utf-8"));
	}

	return promptCache.get(relativePath) || null;
}

/**
 * Check if a prompt file exists
 *
 * @param relativePath - Path relative to server/prompts/
 */
export function promptFileExists(relativePath: string): boolean {
	const fullPath = path.join(PROMPTS_DIR, relativePath);
	return fs.existsSync(fullPath);
}

/**
 * List all files in a prompt directory matching a pattern
 *
 * @param dirPath - Directory path relative to server/prompts/
 * @param suffix - File suffix to match (e.g., "-prompt.xml")
 * @returns Array of file basenames without the suffix
 *
 * @example
 * // Lists all tool prompts
 * const tools = listPromptFiles('tools', '-prompt.xml')
 * // Returns: ['createPost', 'getPage', ...]
 */
export function listPromptFiles(dirPath: string, suffix: string): string[] {
	const fullPath = path.join(PROMPTS_DIR, dirPath);

	if (!fs.existsSync(fullPath)) {
		return [];
	}

	return fs
		.readdirSync(fullPath)
		.filter((file) => file.endsWith(suffix))
		.map((file) => file.replace(suffix, ""));
}

/**
 * Clear the prompt cache (useful for testing)
 */
export function clearPromptCache(): void {
	promptCache.clear();
}

/**
 * Get the prompts directory path
 */
export function getPromptsDir(): string {
	return PROMPTS_DIR;
}
