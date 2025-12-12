/**
 * Compaction Service
 *
 * Generates conversation summaries for context continuity.
 * Triggered when overflow is detected after pruning.
 *
 * Key Pattern: User-Assistant Compaction Pair
 * - Summary is injected as a natural conversation turn
 * - User: "What have we accomplished so far?"
 * - Assistant: [LLM-generated summary]
 * - This preserves LLM cache (system prompt unchanged)
 */

import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import type {
  RichMessage,
  UserMessage,
  AssistantMessage,
  CompactionResult,
  CompactionConfig,
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from "./types";
import { DEFAULT_COMPACTION_CONFIG } from "./types";
import { countTotalTokens, countMessageTokens } from "./token-service";

// ============================================================================
// Configuration
// ============================================================================

// Use a fast, cheap model for summarization
const COMPACTION_MODEL = "openai/gpt-4o-mini";

// Load compaction prompt
function loadCompactionPrompt(): string {
  try {
    // Get the directory of this file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const promptPath = join(__dirname, "../../prompts/compaction/compaction-prompt.xml");
    const content = readFileSync(promptPath, "utf-8");
    // Extract content between <system> tags
    const match = content.match(/<system>([\s\S]*?)<\/system>/);
    return match ? match[1].trim() : content;
  } catch {
    // Fallback prompt if file not found
    return `You are summarizing a CMS agent conversation to help continue it in a new context window.

The AI continuing this conversation will NOT have access to the original messages.
Your summary becomes the starting context - make it actionable and specific.

Provide a detailed but concise summary that captures:
1. What was accomplished (pages, sections, content created/modified)
2. Current state (what's being worked on now)
3. User preferences (design choices, rejected options)
4. What comes next (remaining tasks)
5. Technical context (relevant IDs, error states)

Be specific. Use actual names, IDs, and values. Keep under 2000 tokens.
Format your response as a continuation prompt.`;
  }
}

// ============================================================================
// Compaction Service
// ============================================================================

export class CompactionService {
  private systemPrompt: string;
  private openrouter: ReturnType<typeof createOpenRouter>;

  constructor() {
    this.systemPrompt = loadCompactionPrompt();
    this.openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  /**
   * Generate a summary of the conversation and create compaction pair
   *
   * @param messages - Messages to summarize
   * @param config - Compaction configuration
   * @returns CompactionResult with trigger message, summary message, and remaining messages
   */
  async compact(
    messages: RichMessage[],
    config: Partial<CompactionConfig> = {}
  ): Promise<CompactionResult> {
    const cfg = { ...DEFAULT_COMPACTION_CONFIG, ...config };
    const originalTokens = countTotalTokens(messages);

    // Filter out pure error messages before summarization (OpenCode pattern)
    const filteredMessages = this.filterMessagesForCompaction(messages);

    // Convert messages to text for summarization
    const conversationText = this.messagesToText(filteredMessages);

    // Generate summary using LLM
    const result = await generateText({
      model: this.openrouter.languageModel(COMPACTION_MODEL),
      system: this.systemPrompt,
      prompt: `Summarize this CMS conversation:\n\n${conversationText}\n\nProvide a continuation prompt:`,
      maxOutputTokens: 2000,
    });

    const summaryText = result.text;
    const sessionId = messages[0]?.sessionId || "";

    // Create the compaction trigger (user message)
    const triggerMessage: UserMessage = {
      id: randomUUID(),
      sessionId,
      role: "user",
      parts: [
        {
          id: randomUUID(),
          type: "text",
          text: "What have we accomplished in our conversation so far? Summarize our progress, current state, and next steps.",
        },
      ],
      isCompactionTrigger: true,
      createdAt: Date.now(),
      tokens: 0, // Will be calculated
    };
    triggerMessage.tokens = countMessageTokens(triggerMessage);

    // Create the summary response (assistant message)
    const summaryMessage: AssistantMessage = {
      id: randomUUID(),
      sessionId,
      role: "assistant",
      parts: [
        {
          id: randomUUID(),
          type: "text",
          text: summaryText,
        },
      ],
      isSummary: true,
      createdAt: Date.now(),
      tokens: 0, // Will be calculated
    };
    summaryMessage.tokens = countMessageTokens(summaryMessage);

    // Keep recent turns after the summary (minTurnsToKeep)
    const recentMessages = this.getRecentTurns(messages, cfg.minTurnsToKeep);

    // Final message array: [trigger, summary, ...recent]
    const finalMessages: RichMessage[] = [triggerMessage, summaryMessage, ...recentMessages];
    const finalTokens = countTotalTokens(finalMessages);

    return {
      triggerMessage,
      summaryMessage,
      messages: finalMessages,
      messagesCompacted: messages.length - recentMessages.length,
      tokensSaved: originalTokens - finalTokens,
    };
  }

  /**
   * Filter out error messages that aren't useful for summarization
   * OpenCode pattern: discard pure error messages with no useful content
   */
  private filterMessagesForCompaction(messages: RichMessage[]): RichMessage[] {
    return messages.filter((msg) => {
      // Keep all user messages
      if (msg.role === "user") return true;

      // Keep tool messages
      if (msg.role === "tool") return true;

      // For assistant messages, check if they have errors
      if (msg.role === "assistant") {
        const asst = msg as AssistantMessage;

        // If no error, keep
        if (!asst.error) return true;

        // If error but has actual content (text or tool calls), keep
        const hasContent = asst.parts.some(
          (p) => p.type === "text" || p.type === "tool-call"
        );
        if (hasContent) return true;

        // Otherwise discard - no useful context
        return false;
      }

      return true;
    });
  }

  /**
   * Convert messages to readable text for summarization
   */
  private messagesToText(messages: RichMessage[]): string {
    return messages
      .map((msg) => {
        const role = msg.role.toUpperCase();
        const content = msg.parts
          .map((part) => {
            switch (part.type) {
              case "text":
                return (part as TextPart).text;

              case "tool-call": {
                const tc = part as ToolCallPart;
                return `[Called ${tc.toolName} with: ${JSON.stringify(tc.args)}]`;
              }

              case "tool-result": {
                const tr = part as ToolResultPart;
                if (tr.compactedAt) {
                  return `[${tr.toolName} result: cleared]`;
                }
                // Truncate long outputs
                const outputStr = JSON.stringify(tr.output);
                if (outputStr.length > 500) {
                  return `[${tr.toolName} result: ${outputStr.slice(0, 500)}...]`;
                }
                return `[${tr.toolName} result: ${outputStr}]`;
              }

              case "compaction-marker":
                return "[Previous conversation summary]";

              default:
                return "";
            }
          })
          .filter(Boolean)
          .join("\n");

        return `${role}:\n${content}`;
      })
      .join("\n\n---\n\n");
  }

  /**
   * Get the most recent N turns (user message + all following assistant/tool messages)
   */
  private getRecentTurns(messages: RichMessage[], n: number): RichMessage[] {
    if (n <= 0) return [];

    const result: RichMessage[] = [];
    let turns = 0;

    // Go backwards through messages
    for (let i = messages.length - 1; i >= 0 && turns < n; i--) {
      result.unshift(messages[i]);
      if (messages[i].role === "user") {
        turns++;
      }
    }

    return result;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let _compactionService: CompactionService | null = null;

export function getCompactionService(): CompactionService {
  if (!_compactionService) {
    _compactionService = new CompactionService();
  }
  return _compactionService;
}
