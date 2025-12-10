/**
 * System Prompt Generator
 *
 * Generates the system prompt for the CMS agent using agent.xml.
 * Uses Handlebars for template variable injection.
 *
 * The agent uses dynamic tool injection via tool_search - starts with
 * minimal prompt (~1400 tokens) and discovers tools on demand.
 *
 * Hot-reload: In development mode, templates are reloaded from disk on each call.
 * In production, templates are cached for performance.
 */

import Handlebars from "handlebars";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePromptText } from "../utils/prompt-normalizer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== "production";

export interface SystemPromptContext {
	currentDate: string;
	workingMemory?: string;
	activeProtocols?: string;
}

// Cached compiled template (only used in production)
let compiledTemplate: ReturnType<typeof Handlebars.compile> | null = null;

/**
 * Load the agent prompt template from agent.xml
 */
function loadAgentPrompt(): string {
	const agentPath = path.join(__dirname, "../prompts/core/agent.xml");
	return fs.readFileSync(agentPath, "utf-8");
}

/**
 * Get the agent system prompt (~1400 tokens)
 * Agent discovers tools dynamically via tool_search
 *
 * In dev mode: Always reads fresh from disk (hot-reload)
 * In prod mode: Uses cached compiled template
 */
export function getSystemPrompt(context: SystemPromptContext): string {
	// Dev mode: always read fresh from disk for hot-reload
	if (isDev) {
		const template = loadAgentPrompt();
		const compiled = Handlebars.compile(template);
		const prompt = compiled({
			...context,
			workingMemory: context.workingMemory || "",
			activeProtocols: context.activeProtocols || "",
		});
		return normalizePromptText(prompt);
	}

	// Production: use cached template
	if (!compiledTemplate) {
		const template = loadAgentPrompt();
		compiledTemplate = Handlebars.compile(template);
	}

	return normalizePromptText(
		compiledTemplate({
			...context,
			workingMemory: context.workingMemory || "",
			activeProtocols: context.activeProtocols || "",
		})
	);
}

// Alias for clarity
export const getAgentSystemPrompt = getSystemPrompt;

/**
 * Force reload of prompt template (useful for development)
 * Note: In dev mode, templates are already reloaded on each call.
 * This is kept for explicit cache clearing in production if needed.
 */
export function reloadPromptModules(): void {
	compiledTemplate = null;
}
