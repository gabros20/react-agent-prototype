/**
 * Tool Output Pruner
 *
 * Prunes old tool outputs while preserving:
 * - Tool call information (name, input)
 * - Recent tool outputs (within PRUNE_PROTECT threshold)
 * - Message sequence integrity
 *
 * Based on OpenCode's pruning strategy.
 */

import {
  CompactionConfig,
  DEFAULT_COMPACTION_CONFIG,
  RichMessage,
  ToolResultPart,
  PruneResult,
  isToolResultPart,
} from './types';
import { countPartTokens } from './token-service';

/**
 * Prune old tool outputs from messages
 *
 * Strategy:
 * 1. Go backwards through messages
 * 2. Skip first minTurnsToKeep turns
 * 3. Accumulate tool output tokens
 * 4. Once past PRUNE_PROTECT threshold, start clearing outputs
 * 5. Mark cleared outputs with compactedAt timestamp
 *
 * @param messages - Rich message array to prune
 * @param config - Compaction configuration
 * @returns PruneResult with pruned messages and stats
 */
export function pruneToolOutputs(
  messages: RichMessage[],
  config: Partial<CompactionConfig> = {}
): PruneResult {
  const cfg = { ...DEFAULT_COMPACTION_CONFIG, ...config };

  // Clone messages to avoid mutation
  const result = structuredClone(messages);

  let totalToolTokens = 0;
  let prunedTokens = 0;
  let outputsPruned = 0;
  const prunedTools: string[] = [];
  let turns = 0;

  // Go backwards through messages
  for (let i = result.length - 1; i >= 0; i--) {
    const msg = result[i];

    // Count turns (user messages)
    if (msg.role === 'user') {
      turns++;
    }

    // Skip recent turns (minTurnsToKeep)
    if (turns < cfg.minTurnsToKeep) {
      continue;
    }

    // Stop if we hit a compaction summary (previous compaction point)
    if (msg.role === 'assistant' && 'isSummary' in msg && msg.isSummary) {
      break;
    }

    // Process tool results in assistant and tool messages
    if (msg.role === 'assistant' || msg.role === 'tool') {
      for (let j = msg.parts.length - 1; j >= 0; j--) {
        const part = msg.parts[j];

        if (isToolResultPart(part) && !part.compactedAt) {
          const partTokens = countPartTokens(part);
          totalToolTokens += partTokens;

          // If past protection threshold, prune this output
          if (totalToolTokens > cfg.pruneProtect) {
            const toolPart = part as ToolResultPart;

            // Store original token count for debugging
            toolPart.originalTokens = partTokens;

            // Clear the output
            toolPart.output = '[Tool output cleared - see conversation summary]';
            toolPart.compactedAt = Date.now();

            // Calculate saved tokens (original - new placeholder)
            const newTokens = countPartTokens(toolPart);
            prunedTokens += partTokens - newTokens;
            outputsPruned++;

            if (!prunedTools.includes(toolPart.toolName)) {
              prunedTools.push(toolPart.toolName);
            }
          }
        }
      }
    }
  }

  // Only report as pruned if we actually saved significant tokens
  const wasPruned = prunedTokens >= cfg.pruneMinimum;

  return {
    messages: result,
    outputsPruned: wasPruned ? outputsPruned : 0,
    tokensSaved: wasPruned ? prunedTokens : 0,
    prunedTools: wasPruned ? prunedTools : [],
  };
}

/**
 * Check if messages need pruning
 *
 * Returns true if:
 * - Tool output tokens exceed (pruneProtect + pruneMinimum) threshold
 * - This indicates there's enough to prune to be worthwhile
 */
export function needsPruning(
  messages: RichMessage[],
  config: Partial<CompactionConfig> = {}
): boolean {
  const cfg = { ...DEFAULT_COMPACTION_CONFIG, ...config };

  let toolOutputTokens = 0;
  let turns = 0;

  // Go backwards, counting tool output tokens (excluding protected recent turns)
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];

    if (msg.role === 'user') turns++;
    if (turns < cfg.minTurnsToKeep) continue;

    // Stop at previous compaction point
    if (msg.role === 'assistant' && 'isSummary' in msg && msg.isSummary) {
      break;
    }

    if (msg.role === 'assistant' || msg.role === 'tool') {
      for (const part of msg.parts) {
        if (isToolResultPart(part) && !part.compactedAt) {
          toolOutputTokens += countPartTokens(part);
        }
      }
    }
  }

  // Need pruning if we have more than protection threshold + minimum savings
  return toolOutputTokens > cfg.pruneProtect + cfg.pruneMinimum;
}

/**
 * Calculate potential savings from pruning
 *
 * @param messages - Messages to analyze
 * @param config - Compaction configuration
 * @returns Estimated token savings
 */
export function estimatePruneSavings(
  messages: RichMessage[],
  config: Partial<CompactionConfig> = {}
): { prunableTokens: number; totalToolTokens: number; outputsCount: number } {
  const cfg = { ...DEFAULT_COMPACTION_CONFIG, ...config };

  let prunableTokens = 0;
  let totalToolTokens = 0;
  let outputsCount = 0;
  let turns = 0;
  let accumulatedTokens = 0;

  // Go backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];

    if (msg.role === 'user') turns++;
    if (turns < cfg.minTurnsToKeep) continue;

    // Stop at previous compaction point
    if (msg.role === 'assistant' && 'isSummary' in msg && msg.isSummary) {
      break;
    }

    if (msg.role === 'assistant' || msg.role === 'tool') {
      for (const part of msg.parts) {
        if (isToolResultPart(part) && !part.compactedAt) {
          const partTokens = countPartTokens(part);
          totalToolTokens += partTokens;
          accumulatedTokens += partTokens;
          outputsCount++;

          // Count tokens past protection threshold as prunable
          if (accumulatedTokens > cfg.pruneProtect) {
            // Estimate savings (original - placeholder)
            prunableTokens += partTokens - 4; // ~4 tokens for placeholder
          }
        }
      }
    }
  }

  return { prunableTokens, totalToolTokens, outputsCount };
}
