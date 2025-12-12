/**
 * Prompt Builder Module - Type-safe prompt construction
 *
 * Provides a clean API for building agent prompts with explicit injection points.
 * Replaces fragile regex matching with structured, typed injections.
 */

// Injection points (type definitions and patterns)
export {
  INJECTION_POINTS,
  type InjectionPointName,
  type InjectionData,
  formatInjection,
  validateTemplate,
  getInjectionPointNames,
} from './injection-points';

// Prompt builder (immutable builder pattern)
export {
  PromptBuilder,
  buildPrompt,
} from './prompt-builder';

// Tool prompt injector (deduplicating loader)
export {
  ToolPromptInjector,
  getToolPrompt,
  getToolPrompts,
  listAvailableToolPrompts,
  clearToolPromptCache,
} from './tool-prompt-injector';
