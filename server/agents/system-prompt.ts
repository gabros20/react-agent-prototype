/**
 * System Prompt Generator
 *
 * Generates the system prompt for the main agent using prompts/agent/main-agent-prompt.xml.
 * Uses Handlebars for template variable injection.
 *
 * The agent uses dynamic tool injection via searchTools - starts with
 * minimal prompt (~1700 tokens) and discovers tools on demand.
 *
 * Hot-reload: In development mode, templates are reloaded from disk on each call.
 * In production, templates are cached for performance.
 */

import { loadAgentPrompt, type AgentPromptContext, clearPromptCache } from "../prompts/_index";
import { normalizePromptText } from "../utils/prompt-normalizer";

export interface SystemPromptContext {
	currentDate: string;
	workingMemory?: string;
	activeProtocols?: string;
}

/**
 * Get the agent system prompt (~1700 tokens)
 * Agent discovers tools dynamically via searchTools
 *
 * In dev mode: Always reads fresh from disk (hot-reload)
 * In prod mode: Uses cached compiled template
 */
export function getSystemPrompt(context: SystemPromptContext): string {
	const prompt = loadAgentPrompt(context as AgentPromptContext);
	return normalizePromptText(prompt);
}

// Alias for clarity
export const getAgentSystemPrompt = getSystemPrompt;

/**
 * Force reload of prompt template (useful for development)
 * Note: In dev mode, templates are already reloaded on each call.
 * This is kept for explicit cache clearing in production if needed.
 */
export function reloadPromptModules(): void {
	clearPromptCache();
}
