/**
 * Prompt Loader
 *
 * Centralized loading of all prompt files with hot-reload support.
 * In dev mode: Always reads fresh from disk
 * In prod mode: Caches compiled templates
 *
 * Prompt files use XML format (.xml extension)
 */

import Handlebars from "handlebars";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== "production";

// Cache for compiled templates (production only)
const templateCache = new Map<string, ReturnType<typeof Handlebars.compile>>();

/**
 * Load a prompt file from disk
 */
function loadPromptFile(relativePath: string): string {
	const fullPath = path.join(__dirname, relativePath);
	if (!fs.existsSync(fullPath)) {
		throw new Error(`Prompt file not found: ${fullPath}`);
	}
	return fs.readFileSync(fullPath, "utf-8");
}

/**
 * Get a compiled Handlebars template for a prompt file
 * In dev mode: Always recompiles from disk (hot-reload)
 * In prod mode: Returns cached compiled template
 */
function getCompiledTemplate(
	relativePath: string,
): ReturnType<typeof Handlebars.compile> {
	// Dev mode: always read fresh
	if (isDev) {
		const content = loadPromptFile(relativePath);
		return Handlebars.compile(content);
	}

	// Prod mode: use cache
	if (!templateCache.has(relativePath)) {
		const content = loadPromptFile(relativePath);
		templateCache.set(relativePath, Handlebars.compile(content));
	}
	return templateCache.get(relativePath)!;
}

// ============================================================================
// Agent Prompts
// ============================================================================

export interface AgentPromptContext {
	currentDate: string;
	workingMemory?: string;
	activeProtocols?: string;
}

/**
 * Load the main agent prompt with context variables
 */
export function loadAgentPrompt(context: AgentPromptContext): string {
	const template = getCompiledTemplate("agent/main-agent-prompt.xml");
	return template({
		...context,
		workingMemory: context.workingMemory || "",
		activeProtocols: context.activeProtocols || "",
	});
}

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

	// Dev mode: always read fresh
	if (isDev) {
		return fs.readFileSync(fullPath, "utf-8");
	}

	// Prod mode: use simple string cache (not Handlebars, tool prompts are static)
	const cacheKey = `tool:${toolName}`;
	if (!templateCache.has(cacheKey)) {
		const content = fs.readFileSync(fullPath, "utf-8");
		templateCache.set(cacheKey, (() => content) as any);
	}
	return fs.readFileSync(fullPath, "utf-8");
}

/**
 * Load prompts for multiple tools, formatted for injection into activeProtocols
 * Only loads prompts that exist - tools without prompts are skipped
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
 * Clear the template cache (useful for testing or forcing reload)
 */
export function clearPromptCache(): void {
	templateCache.clear();
}

/**
 * Check if a prompt file exists
 */
export function promptExists(relativePath: string): boolean {
	const fullPath = path.join(__dirname, relativePath);
	return fs.existsSync(fullPath);
}
