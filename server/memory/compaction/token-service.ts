/**
 * Token Service
 *
 * Centralized token counting for messages and parts.
 * Uses gpt-tokenizer for accurate counting with fallback.
 */

import { countTokens } from '../../../lib/tokenizer';
import type {
  RichMessage,
  MessagePart,
  ModelLimits,
} from './types';

// ============================================================================
// Compaction Defaults (centralized for easy testing/tuning)
// ============================================================================

/** Default context limit when model info unavailable */
export const DEFAULT_CONTEXT_LIMIT = 16_000;

/** Default max output tokens */
export const DEFAULT_MAX_OUTPUT = 4_096;

/**
 * Compaction trigger threshold (0.0 - 1.0)
 * When context usage exceeds this % of available space, compaction kicks in.
 * Lower = more aggressive compaction, Higher = later compaction
 */
export const COMPACTION_THRESHOLD = 0.9;

// ============================================================================
// Model Limits Registry (fallback when session context length unavailable)
// ============================================================================

/**
 * Known model context limits.
 * Uses OpenRouter model ID format.
 * NOTE: Prefer using session's modelContextLength from OpenRouter API.
 */
const MODEL_LIMITS: Record<string, ModelLimits> = {
  // OpenAI
  'openai/gpt-4o': { contextLimit: 128_000, maxOutput: 16_384 },
  'openai/gpt-4o-mini': { contextLimit: 128_000, maxOutput: 16_384 },
  'openai/gpt-4-turbo': { contextLimit: 128_000, maxOutput: 4_096 },
  'openai/gpt-4': { contextLimit: 8_192, maxOutput: 4_096 },
  'openai/gpt-3.5-turbo': { contextLimit: 16_385, maxOutput: 4_096 },
  'openai/o1': { contextLimit: 200_000, maxOutput: 100_000 },
  'openai/o1-mini': { contextLimit: 128_000, maxOutput: 65_536 },
  'openai/o1-preview': { contextLimit: 128_000, maxOutput: 32_768 },

  // Anthropic
  'anthropic/claude-sonnet-4-20250514': { contextLimit: 200_000, maxOutput: 16_000 },
  'anthropic/claude-3.5-sonnet': { contextLimit: 200_000, maxOutput: 8_192 },
  'anthropic/claude-3-5-sonnet-20241022': { contextLimit: 200_000, maxOutput: 8_192 },
  'anthropic/claude-3-opus': { contextLimit: 200_000, maxOutput: 4_096 },
  'anthropic/claude-3-sonnet': { contextLimit: 200_000, maxOutput: 4_096 },
  'anthropic/claude-3-haiku': { contextLimit: 200_000, maxOutput: 4_096 },

  // Google
  'google/gemini-pro': { contextLimit: 32_000, maxOutput: 8_192 },
  'google/gemini-1.5-pro': { contextLimit: 1_000_000, maxOutput: 8_192 },
  'google/gemini-2.0-flash-exp': { contextLimit: 1_000_000, maxOutput: 8_192 },

  // DeepSeek
  'deepseek/deepseek-chat': { contextLimit: 64_000, maxOutput: 8_192 },
  'deepseek/deepseek-coder': { contextLimit: 64_000, maxOutput: 8_192 },
  'deepseek/deepseek-r1': { contextLimit: 64_000, maxOutput: 8_192 },
};

/**
 * Get model limits with fallback chain:
 * 1. Session's modelContextLength (from OpenRouter API) - most accurate
 * 2. Hardcoded MODEL_LIMITS lookup (for known models)
 * 3. DEFAULT_CONTEXT_LIMIT (safe fallback)
 *
 * @param modelId - Model identifier (e.g., 'openai/gpt-4o-mini')
 * @param sessionContextLength - Context length from session (from OpenRouter)
 */
export function getModelLimits(modelId: string, sessionContextLength?: number | null): ModelLimits {
  // Priority 1: Use session's stored context length (from OpenRouter)
  if (sessionContextLength && sessionContextLength > 0) {
    return {
      contextLimit: sessionContextLength,
      // Estimate max output as 1/8 of context, capped at 16K
      maxOutput: Math.min(Math.floor(sessionContextLength / 8), 16_384),
    };
  }

  // Priority 2: Try exact match in hardcoded table
  if (MODEL_LIMITS[modelId]) {
    return MODEL_LIMITS[modelId];
  }

  // Try prefix match (e.g., 'openai/gpt-4o-2024-01-01' → 'openai/gpt-4o')
  for (const key of Object.keys(MODEL_LIMITS)) {
    if (modelId.startsWith(key)) {
      return MODEL_LIMITS[key];
    }
  }

  // Try matching by provider family
  if (modelId.includes('claude')) {
    return MODEL_LIMITS['anthropic/claude-3.5-sonnet'];
  }
  if (modelId.includes('gpt-4')) {
    return MODEL_LIMITS['openai/gpt-4o'];
  }
  if (modelId.includes('gemini')) {
    return MODEL_LIMITS['google/gemini-1.5-pro'];
  }

  // Priority 3: Fallback defaults
  return { contextLimit: DEFAULT_CONTEXT_LIMIT, maxOutput: DEFAULT_MAX_OUTPUT };
}

// ============================================================================
// Token Counting
// ============================================================================

/**
 * Count tokens in a message part
 */
export function countPartTokens(part: MessagePart): number {
  switch (part.type) {
    case 'text':
    case 'reasoning':
      return countTokens(part.text);

    case 'tool-call':
      // Tool name + JSON input
      return countTokens(part.toolName) + countTokens(JSON.stringify(part.input));

    case 'tool-result':
      // If compacted, output is just a placeholder
      if (part.compactedAt) {
        return countTokens('[Output cleared]');
      }
      return countTokens(JSON.stringify(part.output));

    case 'step-start':
      return 4; // Minimal overhead

    case 'compaction-marker':
      return countTokens(part.summary);

    default:
      return 0;
  }
}

/**
 * Count tokens in a rich message
 */
export function countMessageTokens(message: RichMessage): number {
  const roleOverhead = 4; // Token overhead for role markers
  const partsTotal = message.parts.reduce((sum, part) => sum + countPartTokens(part), 0);
  return roleOverhead + partsTotal;
}

/**
 * Count total tokens in message array
 */
export function countTotalTokens(messages: RichMessage[]): number {
  return messages.reduce((sum, msg) => sum + countMessageTokens(msg), 0);
}

/**
 * Estimate tokens for a string (quick estimate without encoding)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens with model-specific adjustment.
 * Non-OpenAI models may have different tokenization, so add safety margin.
 */
export function countTokensWithModelAdjustment(text: string, modelId: string): number {
  const baseCount = countTokens(text);

  // Add 10% safety margin for non-OpenAI models
  if (!modelId.startsWith('openai/')) {
    return Math.ceil(baseCount * 1.1);
  }

  return baseCount;
}

// ============================================================================
// Token Budget Calculations
// ============================================================================

/**
 * Calculate available tokens for conversation given model and current usage
 */
export function calculateAvailableTokens(
  modelId: string,
  currentTokens: number,
  outputReserve?: number,
  sessionContextLength?: number | null
): number {
  const limits = getModelLimits(modelId, sessionContextLength);
  const reserve = outputReserve ?? limits.maxOutput;
  const usable = limits.contextLimit - reserve;
  return usable - currentTokens;
}

/**
 * Check if we're approaching overflow
 */
export function isApproachingOverflow(
  modelId: string,
  currentTokens: number,
  outputReserve?: number,
  sessionContextLength?: number | null,
  threshold = COMPACTION_THRESHOLD
): boolean {
  const limits = getModelLimits(modelId, sessionContextLength);
  const reserve = outputReserve ?? limits.maxOutput;
  const usable = limits.contextLimit - reserve;
  return currentTokens > usable * threshold;
}

/**
 * Calculate context usage percentage
 */
export function calculateContextUsagePercent(
  modelId: string,
  currentTokens: number,
  outputReserve?: number,
  sessionContextLength?: number | null
): number {
  const limits = getModelLimits(modelId, sessionContextLength);
  const reserve = outputReserve ?? limits.maxOutput;
  const usable = limits.contextLimit - reserve;
  return (currentTokens / usable) * 100;
}
