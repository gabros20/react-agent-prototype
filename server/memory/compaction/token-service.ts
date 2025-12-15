/**
 * Token Service
 *
 * Provider-only token management for compaction decisions.
 * All compaction decisions use provider-reported tokens (source of truth).
 *
 * NOTE: Local token counting has been removed - provider tokens are the
 * single source of truth for context window usage.
 */

import { countTokens } from "../../../lib/tokenizer";
import type { MessagePart, ModelLimits } from "./types";

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
export const COMPACTION_THRESHOLD = 0.5;

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
	"openai/gpt-4o": { contextLimit: 128_000, maxOutput: 16_384 },
	"openai/gpt-4o-mini": { contextLimit: 128_000, maxOutput: 16_384 },
	"openai/gpt-4-turbo": { contextLimit: 128_000, maxOutput: 4_096 },
	"openai/gpt-4": { contextLimit: 8_192, maxOutput: 4_096 },
	"openai/gpt-3.5-turbo": { contextLimit: 16_385, maxOutput: 4_096 },
	"openai/o1": { contextLimit: 200_000, maxOutput: 100_000 },
	"openai/o1-mini": { contextLimit: 128_000, maxOutput: 65_536 },
	"openai/o1-preview": { contextLimit: 128_000, maxOutput: 32_768 },

	// Anthropic
	"anthropic/claude-sonnet-4-20250514": { contextLimit: 200_000, maxOutput: 16_000 },
	"anthropic/claude-3.5-sonnet": { contextLimit: 200_000, maxOutput: 8_192 },
	"anthropic/claude-3-5-sonnet-20241022": { contextLimit: 200_000, maxOutput: 8_192 },
	"anthropic/claude-3-opus": { contextLimit: 200_000, maxOutput: 4_096 },
	"anthropic/claude-3-sonnet": { contextLimit: 200_000, maxOutput: 4_096 },
	"anthropic/claude-3-haiku": { contextLimit: 200_000, maxOutput: 4_096 },

	// Google
	"google/gemini-pro": { contextLimit: 32_000, maxOutput: 8_192 },
	"google/gemini-1.5-pro": { contextLimit: 1_000_000, maxOutput: 8_192 },
	"google/gemini-2.0-flash-exp": { contextLimit: 1_000_000, maxOutput: 8_192 },

	// DeepSeek
	"deepseek/deepseek-chat": { contextLimit: 64_000, maxOutput: 8_192 },
	"deepseek/deepseek-coder": { contextLimit: 64_000, maxOutput: 8_192 },
	"deepseek/deepseek-r1": { contextLimit: 64_000, maxOutput: 8_192 },
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
	if (modelId.includes("claude")) {
		return MODEL_LIMITS["anthropic/claude-3.5-sonnet"];
	}
	if (modelId.includes("gpt-4")) {
		return MODEL_LIMITS["openai/gpt-4o"];
	}
	if (modelId.includes("gemini")) {
		return MODEL_LIMITS["google/gemini-1.5-pro"];
	}

	// Priority 3: Fallback defaults
	return { contextLimit: DEFAULT_CONTEXT_LIMIT, maxOutput: DEFAULT_MAX_OUTPUT };
}

// ============================================================================
// Provider Token Types and Functions (Source of Truth)
// ============================================================================

/**
 * Provider-reported tokens for compaction decisions.
 * This is the source of truth - no local estimation needed.
 */
export interface ProviderTokens {
	input: number;
	output: number;
}

/**
 * Check if context is overflowing using provider-reported tokens.
 *
 * Following OpenCode pattern: use provider tokens as source of truth.
 * Formula: (input + output) > (contextLimit - maxOutput) * threshold
 *
 * @param tokens - Provider-reported tokens from last assistant message
 * @param limits - Model context limits
 * @param threshold - Compaction trigger threshold (default: COMPACTION_THRESHOLD)
 * @returns true if compaction should be triggered
 */
export function isOverflowFromProviderTokens(tokens: ProviderTokens, limits: ModelLimits, threshold = COMPACTION_THRESHOLD): boolean {
	const used = tokens.input + tokens.output;
	const usable = limits.contextLimit - limits.maxOutput;
	return used > usable * threshold;
}

// ============================================================================
// Part Token Counting (for tool pruning heuristics only)
// ============================================================================

/**
 * Count tokens in a message part.
 *
 * NOTE: This is ONLY used for tool pruning heuristics, NOT for compaction decisions.
 * Compaction decisions use provider-reported tokens exclusively.
 *
 * @param part - Message part to count
 * @returns Estimated token count (used as heuristic for pruning)
 */
export function countPartTokens(part: MessagePart): number {
	switch (part.type) {
		case "text":
		case "reasoning":
			return countTokens(part.text);

		case "tool-call":
			// Tool name + JSON input
			return countTokens(part.toolName) + countTokens(JSON.stringify(part.input));

		case "tool-result":
			// If compacted, output is just a placeholder
			if (part.compactedAt) {
				return countTokens("[Output cleared]");
			}
			return countTokens(JSON.stringify(part.output));

		case "step-start":
			return 4; // Minimal overhead

		case "compaction-marker":
			return countTokens(part.summary);

		default:
			return 0;
	}
}
