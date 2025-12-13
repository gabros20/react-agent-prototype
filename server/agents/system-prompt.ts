/**
 * System Prompt Generator - Cache-Safe Static Version
 *
 * IMPORTANT: This module provides a STATIC system prompt.
 * Dynamic content (working memory, tool prompts) is now injected
 * as conversation history, NOT into the system prompt.
 *
 * Why static?
 * - All LLM providers use prefix-based caching
 * - Changing system prompt = cache invalidated = NO cost savings
 * - Static prompt = cached prefix = 50-90% cost reduction
 *
 * See: docs/plans/CACHE_SAFE_DYNAMIC_INJECTION_PLAN.md
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePromptText } from "../utils/prompt-normalizer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Static Prompt Cache
// ============================================================================

/**
 * Cached static prompt (loaded once, never changes)
 * In dev mode, we still cache but provide a way to reload.
 */
let cachedStaticPrompt: string | null = null;

const isDev = process.env.NODE_ENV !== "production";

// ============================================================================
// Static Prompt Loading
// ============================================================================

/**
 * Load the static agent prompt from disk
 */
function loadStaticPrompt(): string {
	const promptPath = path.join(__dirname, "../prompts/agent/main-agent-prompt.xml");

	if (!fs.existsSync(promptPath)) {
		throw new Error(`Static agent prompt not found at: ${promptPath}\n` + "Run the migration to create main-agent-prompt.xml");
	}

	return normalizePromptText(fs.readFileSync(promptPath, "utf-8"));
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the static agent system prompt (cached)
 *
 * IMPORTANT: This prompt is completely static.
 * Dynamic content (working memory, tool guidance) is injected
 * as conversation history via message factories, NOT here.
 *
 * In dev mode: Reloads from disk on each call (hot-reload)
 * In prod mode: Cached after first load
 */
export function getStaticSystemPrompt(): string {
	// Dev mode: always fresh (enables hot-reload)
	if (isDev) {
		return loadStaticPrompt();
	}

	// Prod mode: cache after first load
	if (!cachedStaticPrompt) {
		cachedStaticPrompt = loadStaticPrompt();
	}

	return cachedStaticPrompt;
}

/**
 * Alias for backward compatibility
 * Note: The context parameter is IGNORED - prompt is static
 *
 * @deprecated Use getStaticSystemPrompt() instead
 */
export function getSystemPrompt(_context?: unknown): string {
	// Log warning in dev mode
	if (isDev && _context !== undefined) {
		console.warn(
			"[system-prompt] getSystemPrompt context parameter is deprecated. " +
				"Dynamic content should be injected as conversation history. " +
				"See CACHE_SAFE_DYNAMIC_INJECTION_PLAN.md"
		);
	}
	return getStaticSystemPrompt();
}

/**
 * Alias for clarity
 */
export const getAgentSystemPrompt = getStaticSystemPrompt;

/**
 * Force reload of prompt (for development/testing)
 */
export function clearPromptCache(): void {
	cachedStaticPrompt = null;
}

/**
 * @deprecated Use message factories instead
 * @see server/prompts/messages/tool-guidance-messages.ts
 */
export function getSystemPromptWithContext(_context: unknown): never {
	throw new Error(
		"[DEPRECATED] getSystemPromptWithContext is deprecated. " +
			"Dynamic context should be injected as conversation history, not system prompt. " +
			"Use createToolGuidanceMessages() instead. " +
			"See CACHE_SAFE_DYNAMIC_INJECTION_PLAN.md"
	);
}
