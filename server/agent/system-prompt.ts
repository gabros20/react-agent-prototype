/**
 * System Prompt Generator
 *
 * Generates the system prompt for the CMS agent using agent.xml.
 * Uses Handlebars for template variable injection.
 *
 * The agent uses dynamic tool injection via tool_search - starts with
 * minimal prompt (~1400 tokens) and discovers tools on demand.
 */

import Handlebars from "handlebars";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SystemPromptContext {
	currentDate: string;
	workingMemory?: string;
}

// Cached compiled template
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
 */
export function getSystemPrompt(context: SystemPromptContext): string {
	// Lazy load and compile template once
	if (!compiledTemplate) {
		const template = loadAgentPrompt();
		compiledTemplate = Handlebars.compile(template);
	}

	return compiledTemplate({
		...context,
		workingMemory: context.workingMemory || "",
	});
}

// Alias for clarity
export const getAgentSystemPrompt = getSystemPrompt;

/**
 * Force reload of prompt template (useful for development)
 */
export function reloadPromptModules(): void {
	compiledTemplate = null;
}
