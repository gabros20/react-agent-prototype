/**
 * Message Factories for Cache-Safe Dynamic Injection
 *
 * These factories create user-assistant message pairs for injecting
 * dynamic content into conversation history (NOT system prompt).
 *
 * This preserves LLM provider caching:
 * - System prompt stays static (cached)
 * - Dynamic content as conversation (variable suffix)
 * - 50-90% cost savings from prefix caching
 */

export { createDatetimeMessage, contextMessages } from "./context-messages";

export {
  createToolGuidanceMessages,
  createToolReminderMessage,
  createCoreToolGuidanceMessages,
  toolGuidanceMessages,
} from "./tool-guidance-messages";
