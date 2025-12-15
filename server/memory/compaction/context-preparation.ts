/**
 * Context Preparation
 *
 * Orchestrates the full context preparation flow:
 * 1. Check if overflow is approaching (using provider tokens)
 * 2. Prune tool outputs if needed (PRUNE_PROTECT pattern)
 * 3. Compact/summarize (LLM summarization)
 * 4. Return prepared messages ready for LLM
 *
 * NOTE: Provider tokens are the ONLY source of truth for overflow decisions.
 * Local token counting has been removed.
 *
 * Enabled via ENABLE_COMPACTION=true environment variable.
 */

import type { ModelMessage } from "ai";
import type {
  RichMessage,
  CompactionConfig,
  ContextPrepareResult,
} from "./types";
import { DEFAULT_COMPACTION_CONFIG } from "./types";
import {
  getModelLimits,
  COMPACTION_THRESHOLD,
} from "./token-service";
import { pruneToolOutputs, needsPruning } from "./tool-pruner";
import { getCompactionService } from "./compaction-service";
import {
  modelMessagesToRich,
  richMessagesToModel,
} from "./message-converter";

// ============================================================================
// Context Preparation
// ============================================================================

export interface ContextPrepareOptions {
  /** Session ID for new messages */
  sessionId: string;
  /** Model ID for context limits */
  modelId: string;
  /** Model context length from session (from OpenRouter) */
  sessionContextLength?: number | null;
  /** Configuration overrides */
  config?: Partial<CompactionConfig>;
  /** Callback for progress/status updates */
  onProgress?: (status: string) => void;
  /** Force compaction even if not approaching overflow */
  force?: boolean;
  /** Provider-reported tokens (REQUIRED - source of truth for overflow decisions) */
  providerTokens: { input: number; output: number };
}

/**
 * Prepare context by pruning and/or compacting as needed
 *
 * Flow:
 * 1. Convert AI SDK messages to RichMessage format
 * 2. Check if approaching overflow using provider tokens
 * 3. If yes, try pruning tool outputs first
 * 4. Always summarize if provider triggered compaction (pruning is best-effort)
 * 5. Convert back to AI SDK format
 *
 * NOTE: Provider tokens are the ONLY source of truth. No fallback to local counting.
 *
 * @param modelMessages - Current AI SDK message array
 * @param options - Preparation options (providerTokens REQUIRED)
 * @returns ContextPrepareResult with prepared messages and stats
 */
export async function prepareContext(
  modelMessages: ModelMessage[],
  options: ContextPrepareOptions
): Promise<ContextPrepareResult> {
  const { sessionId, modelId, sessionContextLength, config = {}, onProgress, force = false, providerTokens } = options;
  const cfg = { ...DEFAULT_COMPACTION_CONFIG, ...config };

  // Track debug info
  const debug = {
    prunedOutputs: 0,
    compactedMessages: 0,
    removedTools: [] as string[],
  };

  // Step 1: Convert to RichMessage format
  onProgress?.("Converting messages...");
  let messages = modelMessagesToRich(modelMessages, sessionId);

  // Step 2: Check if we're approaching overflow using provider tokens (source of truth)
  const limits = getModelLimits(modelId, sessionContextLength);
  const usableContext = limits.contextLimit - limits.maxOutput;
  const providerTotal = providerTokens.input + providerTokens.output;
  const isOverflow = providerTotal > usableContext * COMPACTION_THRESHOLD;

  if (!isOverflow && !force) {
    // No action needed
    return {
      messages,
      wasPruned: false,
      wasCompacted: false,
      tokens: {
        before: providerTotal,
        afterPrune: providerTotal,
        afterCompact: providerTotal,
        final: providerTotal,
      },
      debug,
    };
  }

  // Step 3: Try pruning first (cheap)
  onProgress?.("Pruning tool outputs...");
  let wasPruned = false;

  if (needsPruning(messages, cfg)) {
    const pruneResult = pruneToolOutputs(messages, cfg);
    messages = pruneResult.messages;
    wasPruned = pruneResult.outputsPruned > 0;
    debug.prunedOutputs = pruneResult.outputsPruned;
    debug.removedTools = pruneResult.prunedTools;
  }

  // Step 4: Always summarize when provider triggered compaction
  // NOTE: We can't accurately estimate post-prune tokens without calling the provider.
  // Since provider triggered compaction, we do full summarization.
  // Pruning is just a "best effort" first pass to reduce context before summarization.
  onProgress?.("Generating summary...");
  const compactionService = getCompactionService();
  const compactResult = await compactionService.compact(messages, cfg);

  messages = compactResult.messages;
  debug.compactedMessages = compactResult.messagesCompacted;

  return {
    messages,
    wasPruned,
    wasCompacted: true,
    tokens: {
      before: providerTotal,
      afterPrune: providerTotal, // Can't measure without provider
      afterCompact: providerTotal, // Next response will have accurate count
      final: providerTotal,
    },
    debug,
  };
}

/**
 * Prepare context and convert back to AI SDK format
 *
 * This is the main entry point for integration with the orchestrator.
 */
export async function prepareContextForLLM(
  modelMessages: ModelMessage[],
  options: ContextPrepareOptions
): Promise<{
  messages: ModelMessage[];
  result: ContextPrepareResult;
}> {
  const result = await prepareContext(modelMessages, options);

  return {
    messages: richMessagesToModel(result.messages),
    result,
  };
}
