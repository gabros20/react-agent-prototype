/**
 * Context Messages Factory
 *
 * Creates user-assistant message pairs for context injection.
 * This preserves LLM cache (system prompt stays static).
 *
 * NOTE: createContextRestorationMessages was removed - the condition
 * for using it (previousMessages.length === 0 && workingContext.size() > 0)
 * never fires in practice. New sessions have empty workingContext,
 * existing sessions have messages.
 */

import type { ModelMessage } from "ai";

// ============================================================================
// Date/Time Context
// ============================================================================

/**
 * Create a datetime context message
 * Injected at the start of each new turn (after context restoration)
 *
 * This is lightweight and doesn't need an assistant response.
 */
export function createDatetimeMessage(date: Date = new Date()): ModelMessage {
  return {
    role: "user",
    content: `[CURRENT TIME] ${date.toISOString()}`,
  };
}

// ============================================================================
// Export
// ============================================================================

export const contextMessages = {
  createDatetimeMessage,
};
