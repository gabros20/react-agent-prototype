/**
 * Context Preparation
 *
 * Orchestrates the full context preparation flow:
 * 1. Check if overflow is approaching
 * 2. Prune tool outputs if needed (PRUNE_PROTECT pattern)
 * 3. Compact/summarize if still overflowing (LLM summarization)
 * 4. Return prepared messages ready for LLM
 *
 * Enabled via ENABLE_COMPACTION=true environment variable.
 */

import type { ModelMessage } from "ai";
import type {
  RichMessage,
  CompactionConfig,
  ContextPrepareResult,
  OverflowCheckResult,
} from "./types";
import { DEFAULT_COMPACTION_CONFIG } from "./types";
import {
  getModelLimits,
  countTotalTokens,
  isApproachingOverflow,
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
}

/**
 * Check if context is approaching overflow
 */
export function checkOverflow(
  messages: RichMessage[],
  modelId: string,
  outputReserve?: number,
  sessionContextLength?: number | null
): OverflowCheckResult {
  const limits = getModelLimits(modelId, sessionContextLength);
  const reserve = outputReserve ?? limits.maxOutput;
  const currentTokens = countTotalTokens(messages);
  const usable = limits.contextLimit - reserve;

  return {
    isOverflow: currentTokens > usable * COMPACTION_THRESHOLD,
    currentTokens,
    availableTokens: usable - currentTokens,
    modelLimit: limits.contextLimit,
    outputReserve: reserve,
  };
}

/**
 * Prepare context by pruning and/or compacting as needed
 *
 * Flow:
 * 1. Convert AI SDK messages to RichMessage format
 * 2. Check if approaching overflow
 * 3. If yes, try pruning tool outputs first
 * 4. If still overflowing, generate summary and compact
 * 5. Convert back to AI SDK format
 *
 * @param modelMessages - Current AI SDK message array
 * @param options - Preparation options
 * @returns ContextPrepareResult with prepared messages and stats
 */
export async function prepareContext(
  modelMessages: ModelMessage[],
  options: ContextPrepareOptions
): Promise<ContextPrepareResult> {
  const { sessionId, modelId, sessionContextLength, config = {}, onProgress, force = false } = options;
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

  const tokensBefore = countTotalTokens(messages);

  // Step 2: Check if we're approaching overflow (or forced)
  const overflowCheck = checkOverflow(messages, modelId, cfg.outputReserve, sessionContextLength);

  if (!overflowCheck.isOverflow && !force) {
    // No action needed
    return {
      messages,
      wasPruned: false,
      wasCompacted: false,
      tokens: {
        before: tokensBefore,
        afterPrune: tokensBefore,
        afterCompact: tokensBefore,
        final: tokensBefore,
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

  const tokensAfterPrune = countTotalTokens(messages);

  // Step 4: Check if still overflowing after pruning
  const postPruneCheck = checkOverflow(messages, modelId, cfg.outputReserve, sessionContextLength);

  if (!postPruneCheck.isOverflow) {
    // Pruning was enough
    return {
      messages,
      wasPruned,
      wasCompacted: false,
      tokens: {
        before: tokensBefore,
        afterPrune: tokensAfterPrune,
        afterCompact: tokensAfterPrune,
        final: tokensAfterPrune,
      },
      debug,
    };
  }

  // Step 5: Need compaction (expensive LLM call)
  onProgress?.("Generating summary...");
  const compactionService = getCompactionService();
  const compactResult = await compactionService.compact(messages, cfg);

  messages = compactResult.messages;
  debug.compactedMessages = compactResult.messagesCompacted;

  const tokensAfterCompact = countTotalTokens(messages);

  return {
    messages,
    wasPruned,
    wasCompacted: true,
    tokens: {
      before: tokensBefore,
      afterPrune: tokensAfterPrune,
      afterCompact: tokensAfterCompact,
      final: tokensAfterCompact,
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
