/**
 * Context Manager
 *
 * Turn-based context management that maintains valid message sequences.
 *
 * CRITICAL CONSTRAINT (OpenAI API requirement):
 * A message with role 'tool' MUST immediately follow an 'assistant' message
 * that contains 'tool_calls'. The tool_call IDs must match tool_result IDs.
 * Breaking this sequence causes API 400 errors.
 *
 * Strategy:
 * 1. Parse messages into atomic ConversationTurns (user + assistant exchanges)
 * 2. Validate each turn for proper tool call/result pairing
 * 3. Remove invalid turns entirely (Option B - clean removal)
 * 4. Prune oldest turns to fit within maxMessages limit
 * 5. Flatten back to messages and sync tool cleanup
 *
 * Usage:
 *   const manager = new ContextManager({ maxMessages: 20, minTurnsToKeep: 2 });
 *   const result = manager.trimContext(messages, workingContext);
 */

import { pruneMessages, type ModelMessage } from 'ai';
import type { WorkingContext } from '../working-memory';
import type {
  ContextManagerConfig,
  TrimResult,
  ParseResult,
  ConversationTurn,
  AssistantExchange,
  ValidationResult,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: ContextManagerConfig = {
  maxMessages: 30,
  minTurnsToKeep: 2,
};

// ============================================================================
// Helper Functions - Tool ID Extraction
// ============================================================================

/**
 * Extract tool call IDs from an assistant message.
 * Handles both single and multiple parallel tool calls.
 */
function extractToolCallIds(message: ModelMessage): Set<string> {
  const ids = new Set<string>();
  const content = message.content;

  if (!Array.isArray(content)) return ids;

  for (const part of content) {
    if (
      part !== null &&
      typeof part === 'object' &&
      'type' in part &&
      (part as { type: string }).type === 'tool-call' &&
      'toolCallId' in part
    ) {
      ids.add((part as { toolCallId: string }).toolCallId);
    }
  }

  return ids;
}

/**
 * Extract tool result IDs from a tool message.
 * Handles multiple results in a single message.
 */
function extractToolResultIds(message: ModelMessage): Set<string> {
  const ids = new Set<string>();
  const content = message.content;

  if (!Array.isArray(content)) return ids;

  for (const part of content) {
    if (
      part !== null &&
      typeof part === 'object' &&
      'type' in part &&
      (part as { type: string }).type === 'tool-result' &&
      'toolCallId' in part
    ) {
      ids.add((part as { toolCallId: string }).toolCallId);
    }
  }

  return ids;
}

/**
 * Extract tool names from a message (for tool cleanup tracking).
 */
function extractToolNames(message: ModelMessage): string[] {
  const content = message.content;
  if (!Array.isArray(content)) return [];

  const names: string[] = [];
  for (const part of content) {
    if (
      part !== null &&
      typeof part === 'object' &&
      'type' in part &&
      'toolName' in part &&
      ((part as { type: string }).type === 'tool-call' ||
        (part as { type: string }).type === 'tool-result')
    ) {
      names.push((part as { toolName: string }).toolName);
    }
  }

  return names;
}


// ============================================================================
// Phase 2: Parsing - Group messages into conversation turns
// ============================================================================

/**
 * Parse flat message array into structured conversation turns.
 *
 * A turn starts with a user message and includes all following
 * assistant/tool messages until the next user message.
 */
function parseConversationTurns(messages: ModelMessage[]): ParseResult {
  let systemMessage: ModelMessage | null = null;
  const turns: ConversationTurn[] = [];
  const orphanedMessages: ModelMessage[] = [];

  let currentTurn: ConversationTurn | null = null;
  let pendingAssistant: ModelMessage | null = null;

  for (const msg of messages) {
    switch (msg.role) {
      case 'system':
        // System prompt - store separately (always kept)
        systemMessage = msg;
        break;

      case 'user':
        // Finalize previous assistant if it exists without a tool message
        if (pendingAssistant && currentTurn) {
          currentTurn.exchanges.push(createExchange(pendingAssistant, null));
          currentTurn.messageCount++;
          pendingAssistant = null;
        }

        // Finalize previous turn if exists
        if (currentTurn) {
          turns.push(currentTurn);
        }

        // Start new turn
        currentTurn = {
          userMessage: msg,
          exchanges: [],
          isValid: true,
          messageCount: 1,
        };
        break;

      case 'assistant':
        // If no current turn, this is an orphaned assistant (before any user message)
        if (!currentTurn) {
          // Create a preamble turn (no user message)
          currentTurn = {
            userMessage: null,
            exchanges: [],
            isValid: true,
            messageCount: 0,
          };
        }

        // Finalize previous assistant if it didn't get a tool message
        if (pendingAssistant) {
          currentTurn.exchanges.push(createExchange(pendingAssistant, null));
          currentTurn.messageCount++;
        }

        pendingAssistant = msg;
        currentTurn.messageCount++;
        break;

      case 'tool':
        if (pendingAssistant && currentTurn) {
          // Complete the exchange - pair assistant with tool
          currentTurn.exchanges.push(createExchange(pendingAssistant, msg));
          currentTurn.messageCount++;
          pendingAssistant = null;
        } else {
          // Orphaned tool message - no preceding assistant
          orphanedMessages.push(msg);
        }
        break;

      default:
        // Unknown role - treat as orphaned
        orphanedMessages.push(msg);
    }
  }

  // Finalize last pending assistant
  if (pendingAssistant && currentTurn) {
    currentTurn.exchanges.push(createExchange(pendingAssistant, null));
    currentTurn.messageCount++;
  }

  // Finalize last turn
  if (currentTurn) {
    turns.push(currentTurn);
  }

  return { systemMessage, turns, orphanedMessages };
}

/**
 * Create an AssistantExchange with extracted tool IDs.
 */
function createExchange(
  assistantMessage: ModelMessage,
  toolMessage: ModelMessage | null
): AssistantExchange {
  return {
    assistantMessage,
    toolMessage,
    toolCallIds: extractToolCallIds(assistantMessage),
    toolResultIds: toolMessage ? extractToolResultIds(toolMessage) : new Set(),
  };
}

// ============================================================================
// Phase 3: Validation - Check tool call/result pairing
// ============================================================================

/**
 * Validate a single assistant exchange.
 *
 * Rules:
 * 1. If assistant has no tool calls → no tool message should follow (or it's ok if null)
 * 2. If assistant has tool calls → tool message MUST exist
 * 3. Every tool call ID must have a matching tool result ID
 * 4. No orphaned tool results (results without matching calls)
 */
function validateExchange(exchange: AssistantExchange): ValidationResult {
  const { toolMessage, toolCallIds, toolResultIds } = exchange;
  const issues: string[] = [];

  // Case 1: Assistant has no tool calls
  if (toolCallIds.size === 0) {
    // Tool message shouldn't exist, but if it does with no results, that's ok
    if (toolMessage && toolResultIds.size > 0) {
      issues.push('Tool results exist but assistant has no tool calls');
    }
    return { isValid: issues.length === 0, issues };
  }

  // Case 2: Assistant has tool calls but no tool message
  if (!toolMessage) {
    issues.push(
      `Assistant has ${toolCallIds.size} tool call(s) but no tool message follows`
    );
    return { isValid: false, issues };
  }

  // Case 3: Check all tool call IDs have matching results
  for (const callId of toolCallIds) {
    if (!toolResultIds.has(callId)) {
      issues.push(`Missing tool result for call ID: ${callId}`);
    }
  }

  // Case 4: Check for orphaned results
  for (const resultId of toolResultIds) {
    if (!toolCallIds.has(resultId)) {
      issues.push(`Orphaned tool result with ID: ${resultId}`);
    }
  }

  return { isValid: issues.length === 0, issues };
}

/**
 * Validate an entire conversation turn.
 */
function validateTurn(turn: ConversationTurn): ValidationResult {
  const allIssues: string[] = [];

  for (let i = 0; i < turn.exchanges.length; i++) {
    const result = validateExchange(turn.exchanges[i]);
    if (!result.isValid) {
      allIssues.push(`Exchange ${i}: ${result.issues.join(', ')}`);
    }
  }

  return {
    isValid: allIssues.length === 0,
    issues: allIssues,
  };
}

// ============================================================================
// Phase 4 & 5: Pruning and Repair
// ============================================================================

/**
 * Remove invalid turns from the list.
 * Option B: Remove entire turn if invalid (cleaner, loses some context).
 */
function removeInvalidTurns(turns: ConversationTurn[]): {
  validTurns: ConversationTurn[];
  removedCount: number;
} {
  const validTurns: ConversationTurn[] = [];
  let removedCount = 0;

  for (const turn of turns) {
    const validation = validateTurn(turn);
    if (validation.isValid) {
      turn.isValid = true;
      validTurns.push(turn);
    } else {
      turn.isValid = false;
      removedCount++;
      // Log for debugging (in production, this could go to a logger)
      console.warn(
        '[ContextManager] Removing invalid turn:',
        validation.issues
      );
    }
  }

  return { validTurns, removedCount };
}

/**
 * Prune turns to fit within message budget.
 *
 * Strategy:
 * 1. Always keep at least minTurnsToKeep recent turns
 * 2. Remove oldest turns first (FIFO)
 * 3. Count messages: system(1) + sum(turn.messageCount)
 */
function pruneToLimit(
  systemMessage: ModelMessage | null,
  turns: ConversationTurn[],
  maxMessages: number,
  minTurnsToKeep: number
): { keptTurns: ConversationTurn[]; removedCount: number } {
  // Calculate current message count
  const systemCount = systemMessage ? 1 : 0;
  let totalMessages =
    systemCount + turns.reduce((sum, t) => sum + t.messageCount, 0);

  // If under limit, keep all
  if (totalMessages <= maxMessages) {
    return { keptTurns: turns, removedCount: 0 };
  }

  // Remove oldest turns until under limit (but keep minTurnsToKeep)
  const keptTurns = [...turns];
  let removedCount = 0;

  while (
    totalMessages > maxMessages &&
    keptTurns.length > minTurnsToKeep
  ) {
    const removed = keptTurns.shift();
    if (removed) {
      totalMessages -= removed.messageCount;
      removedCount++;
    }
  }

  return { keptTurns, removedCount };
}

// ============================================================================
// Phase 6: Flatten and Tool Sync
// ============================================================================

/**
 * Flatten turns back into a message array.
 */
function flattenTurns(
  systemMessage: ModelMessage | null,
  turns: ConversationTurn[]
): ModelMessage[] {
  const messages: ModelMessage[] = [];

  // System message first
  if (systemMessage) {
    messages.push(systemMessage);
  }

  // Then each turn's messages in order
  for (const turn of turns) {
    // User message (if exists)
    if (turn.userMessage) {
      messages.push(turn.userMessage);
    }

    // Each exchange's assistant and tool messages
    for (const exchange of turn.exchanges) {
      messages.push(exchange.assistantMessage);
      if (exchange.toolMessage) {
        messages.push(exchange.toolMessage);
      }
    }
  }

  return messages;
}

/**
 * Extract all tool names referenced in the kept turns.
 */
function extractToolsFromTurns(turns: ConversationTurn[]): Set<string> {
  const tools = new Set<string>();

  for (const turn of turns) {
    for (const exchange of turn.exchanges) {
      // From assistant message
      for (const name of extractToolNames(exchange.assistantMessage)) {
        tools.add(name);
      }
      // From tool message
      if (exchange.toolMessage) {
        for (const name of extractToolNames(exchange.toolMessage)) {
          tools.add(name);
        }
      }
    }
  }

  return tools;
}

// ============================================================================
// Main Class
// ============================================================================

export class ContextManager {
  private config: ContextManagerConfig;

  constructor(config?: Partial<ContextManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Trim context while maintaining valid message sequences.
   *
   * @param messages - Full message history
   * @param workingContext - Working context with discovered tools
   * @returns Trimmed messages and cleanup info
   */
  trimContext(
    messages: ModelMessage[],
    workingContext: WorkingContext
  ): TrimResult {
    const initialLength = messages.length;

    // Early exit if under limit and we trust the messages are valid
    // (Skip validation for performance if messages are fresh from current session)
    if (messages.length <= this.config.maxMessages) {
      return {
        messages,
        removedTools: [],
        activeTools: workingContext.getDiscoveredTools(),
        messagesRemoved: 0,
        turnsRemoved: 0,
        invalidTurnsRemoved: 0,
      };
    }

    // Extract tools BEFORE any modifications
    const toolsBefore = new Set<string>();
    for (const msg of messages) {
      for (const name of extractToolNames(msg)) {
        toolsBefore.add(name);
      }
    }

    // Step 1: First pass with AI SDK's pruneMessages for safe tool content removal
    // This removes tool call content from old messages while keeping pairs intact
    const prunedMessages = pruneMessages({
      messages,
      toolCalls: 'before-last-2-messages',
      emptyMessages: 'remove',
    });

    // Step 2: Parse into conversation turns
    const parseResult = parseConversationTurns(prunedMessages);

    // Step 3: Validate and remove invalid turns
    const { validTurns, removedCount: invalidTurnsRemoved } = removeInvalidTurns(
      parseResult.turns
    );

    // Step 4: Prune to fit within message limit
    const { keptTurns, removedCount: turnsRemoved } = pruneToLimit(
      parseResult.systemMessage,
      validTurns,
      this.config.maxMessages,
      this.config.minTurnsToKeep
    );

    // Step 5: Flatten back to messages
    const result = flattenTurns(parseResult.systemMessage, keptTurns);

    // Step 6: Calculate tools to remove
    const toolsAfter = extractToolsFromTurns(keptTurns);
    const toolsToRemove = [...toolsBefore].filter(t => !toolsAfter.has(t));

    // Update WorkingContext
    if (toolsToRemove.length > 0) {
      workingContext.removeTools(toolsToRemove);
    }

    return {
      messages: result,
      removedTools: toolsToRemove,
      activeTools: workingContext.getDiscoveredTools(),
      messagesRemoved: initialLength - result.length,
      turnsRemoved,
      invalidTurnsRemoved,
    };
  }

  /**
   * Validate messages without trimming.
   * Useful for checking persisted messages before use.
   */
  validateMessages(messages: ModelMessage[]): {
    isValid: boolean;
    issues: string[];
  } {
    const parseResult = parseConversationTurns(messages);
    const allIssues: string[] = [];

    // Check for orphaned messages
    if (parseResult.orphanedMessages.length > 0) {
      allIssues.push(
        `Found ${parseResult.orphanedMessages.length} orphaned message(s)`
      );
    }

    // Validate each turn
    for (let i = 0; i < parseResult.turns.length; i++) {
      const validation = validateTurn(parseResult.turns[i]);
      if (!validation.isValid) {
        allIssues.push(`Turn ${i}: ${validation.issues.join('; ')}`);
      }
    }

    return {
      isValid: allIssues.length === 0,
      issues: allIssues,
    };
  }
}

// Re-export types
export type {
  ContextManagerConfig,
  TrimResult,
  ParseResult,
  ConversationTurn,
  AssistantExchange,
  ValidationResult,
} from './types';
