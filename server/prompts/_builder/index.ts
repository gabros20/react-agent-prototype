/**
 * Prompt Builder Module
 *
 * Only ToolPromptInjector is actively used by tool-guidance-messages.ts.
 *
 * NOTE: PromptBuilder and injection-points are unused legacy code from when
 * system prompts were dynamically built. Now the system prompt is STATIC
 * (see system-prompt.ts) and tool guidance is injected as conversation messages.
 */

// Tool prompt injector (deduplicating loader) - ACTIVELY USED
export {
  ToolPromptInjector,
  getToolPrompt,
  getToolPrompts,
  listAvailableToolPrompts,
  clearToolPromptCache,
} from './tool-prompt-injector';

// Legacy exports - kept for backwards compatibility but unused
// TODO: Remove these exports in a future cleanup
export {
  INJECTION_POINTS,
  type InjectionPointName,
  type InjectionData,
  formatInjection,
  validateTemplate,
  getInjectionPointNames,
} from './injection-points';

export {
  PromptBuilder,
  buildPrompt,
} from './prompt-builder';
