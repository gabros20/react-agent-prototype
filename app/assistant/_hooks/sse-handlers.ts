/**
 * SSE Event Handlers
 *
 * Extracted from use-agent.ts for better separation of concerns.
 * Each handler is a pure function that receives event data and context.
 */

import type { TraceLogger } from "@/lib/debug-logger";

// ============================================================================
// Types
// ============================================================================

export interface SSEHandlerContext {
  // Trace logger (may be null before first traceId arrives)
  trace: TraceLogger | null;

  // Store actions
  store: {
    setAgentStatus: (status: { state: "thinking" | "tool-call"; toolName?: string } | null) => void;
    startStreamingMessage: (id: string) => void;
    appendToStreamingMessage: (delta: string) => void;
    finalizeStreamingMessage: () => void;
    clearStreamingMessage: () => void;
    setSessionId: (id: string) => void;
    setCurrentTraceId: (id: string) => void;
  };

  // Mutable refs (for cross-event state)
  refs: {
    streamingText: { current: string };
  };

  // Current state
  currentSessionId: string | null;
}

export interface SSEHandlerResult {
  traceId?: string;
  text?: string;
  error?: Error;
}

// ============================================================================
// Individual Handlers
// ============================================================================

export function handleLog(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const message = (data.message as string) || "";
  const metadata = data.metadata as Record<string, unknown> | undefined;
  const trace = ctx.trace;
  if (!trace) return;

  if (message.includes("Extracted entities to working memory")) {
    trace.workingMemoryUpdate((metadata?.entityCount as number) || 0, metadata);
  } else if (message.includes("Trimming message history")) {
    trace.memoryTrimmed((metadata?.originalCount as number) || 0, (metadata?.newCount as number) || 0);
  } else if (message.includes("Checkpoint saved")) {
    trace.checkpointSaved((metadata?.stepNumber as number) || 0);
  } else if (message.includes("Retry")) {
    trace.retryAttempt(message, metadata);
  } else if (message.includes("Loaded session history")) {
    trace.sessionLoaded((metadata?.messageCount as number) || 0);
  } else if (message.includes("Creating agent")) {
    trace.systemLog(`Agent created: ${metadata?.toolCount || 0} tools, model: ${metadata?.modelId || "unknown"}`, metadata);
  } else if ((data.level === "warn" || data.level === "error") && !message.includes("Tool") && !message.includes("failed")) {
    trace.warn(message, metadata);
  }
}

export function handleMessageStart(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const messageId = (data.messageId as string) || crypto.randomUUID();
  ctx.store.startStreamingMessage(messageId);
}

export function handleTextDelta(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): SSEHandlerResult {
  const delta = (data.delta as string) || (data.text as string) || "";
  ctx.refs.streamingText.current += delta;
  ctx.store.appendToStreamingMessage(delta);
  ctx.trace?.textDelta(delta);
  return { text: delta };
}

export function handleMessageComplete(ctx: SSEHandlerContext): void {
  ctx.store.finalizeStreamingMessage();
}

export function handleSystemPrompt(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  ctx.trace?.systemPrompt(
    data.prompt as string,
    (data.tokens as number) || 0,
    data.workingMemoryTokens as number | undefined
  );
}

export function handleUserPrompt(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  ctx.trace?.userPrompt(
    data.prompt as string,
    (data.tokens as number) || 0,
    data.messageHistoryTokens as number | undefined,
    data.messageCount as number | undefined,
    data.messages as Array<{ role: string; content: unknown }> | undefined
  );
}

// NOTE: tools-available event removed - backend never emits it
// Tool availability is now tracked via tools-discovered event

export function handleToolsDiscovered(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const tools = (data.tools as string[]) || [];
  ctx.trace?.toolsDiscovered(tools);
}

export function handleModelInfo(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  if (data.modelId) {
    const pricing = data.pricing as { prompt: number; completion: number } | null;
    ctx.trace?.modelInfo(data.modelId as string, pricing);
  }
}

export function handleToolCall(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  ctx.store.setAgentStatus({ state: "tool-call", toolName: data.toolName as string });
  const callId = (data.toolCallId as string) || crypto.randomUUID();
  ctx.trace?.toolCall(data.toolName as string, data.input, callId);
}

export function handleToolResult(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  ctx.store.setAgentStatus({ state: "thinking" });
  const callId = data.toolCallId as string;
  const result = (data.result as Record<string, unknown>) || {};

  if (result.requiresConfirmation === true) {
    ctx.trace?.toolConfirmation(callId, data.toolName as string, result);
  } else {
    ctx.trace?.toolResult(callId, result);
  }
}

export function handleToolError(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  ctx.store.setAgentStatus({ state: "thinking" });
  ctx.trace?.toolError(data.toolCallId as string, (data.error as string) || "Tool execution failed");
}

export function handleStepStart(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  ctx.trace?.stepStart(data.stepNumber as number, {
    activeTools: data.activeTools as string[] | undefined,
    discoveredTools: data.discoveredTools as string[] | undefined,
  });
  ctx.refs.streamingText.current = "";
}

export function handleInstructionsInjected(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const tools = (data.tools as string[]) || [];
  const instructions = (data.instructions as string) || "";
  const stepNumber = data.stepNumber as number;
  const updatedSystemPrompt = data.updatedSystemPrompt as string | undefined;
  ctx.trace?.instructionsInjected(stepNumber, tools, instructions, updatedSystemPrompt);
}

export function handleLLMContext(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const messages = (data.messages as Array<{ role: string; content: unknown }>) || [];
  const messageCount = (data.messageCount as number) || messages.length;
  const tokens = (data.tokens as number) || 0;
  ctx.trace?.llmContext(messages, messageCount, tokens);
}

export function handleContextCleanup(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const messagesRemoved = (data.messagesRemoved as number) || 0;
  const removedTools = (data.removedTools as string[]) || [];
  const activeTools = (data.activeTools as string[]) || [];
  ctx.trace?.contextCleanup(messagesRemoved, removedTools, activeTools);
}

export function handleCompactionStart(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const tokensBefore = (data.tokensBefore as number) || 0;
  const modelLimit = (data.modelLimit as number) || 0;
  ctx.trace?.compactionStart(tokensBefore, modelLimit);
}

export function handleCompactionProgress(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const stage = (data.stage as 'pruning' | 'summarizing') || 'pruning';
  const progress = (data.progress as number) || 0;
  ctx.trace?.compactionProgress(stage, progress);
}

export function handleCompactionComplete(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const tokensBefore = (data.tokensBefore as number) || 0;
  const tokensAfter = (data.tokensAfter as number) || 0;
  const tokensSaved = (data.tokensSaved as number) || 0;
  const compressionRatio = (data.compressionRatio as number) || 0;
  const wasPruned = (data.wasPruned as boolean) || false;
  const wasCompacted = (data.wasCompacted as boolean) || false;
  const prunedOutputs = (data.prunedOutputs as number) || 0;
  const compactedMessages = (data.compactedMessages as number) || 0;
  const removedTools = (data.removedTools as string[]) || [];

  ctx.trace?.compactionComplete({
    tokensBefore,
    tokensAfter,
    tokensSaved,
    compressionRatio,
    wasPruned,
    wasCompacted,
    prunedOutputs,
    compactedMessages,
    removedTools,
  });
}

export function handleStepFinish(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): void {
  const stepNumber = data.stepNumber as number;
  const finalText = ctx.refs.streamingText.current;

  if (finalText) {
    ctx.trace?.textFinalize(stepNumber, finalText, data.duration as number | undefined);
  } else {
    ctx.trace?.textRemoveEmpty(stepNumber);
  }
  ctx.refs.streamingText.current = "";

  const usage = data.usage as { promptTokens?: number; completionTokens?: number } | undefined;
  ctx.trace?.stepComplete(stepNumber, {
    duration: data.duration as number | undefined,
    tokens: usage ? { input: usage.promptTokens || 0, output: usage.completionTokens || 0 } : undefined,
  });
}

export function handleResult(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): SSEHandlerResult {
  const traceId = data.traceId as string;
  ctx.store.setCurrentTraceId(traceId);
  const text = (data.text as string) || "";

  if (data.sessionId && data.sessionId !== ctx.currentSessionId) {
    ctx.store.setSessionId(data.sessionId as string);
  }

  // Clear any remaining streaming message (safety net)
  ctx.store.clearStreamingMessage();

  const usage = data.usage as { promptTokens?: number; completionTokens?: number; inputTokens?: number; outputTokens?: number } | undefined;
  const inputTokens = usage?.promptTokens || usage?.inputTokens || 0;
  const outputTokens = usage?.completionTokens || usage?.outputTokens || 0;
  ctx.trace?.llmResponse(text, { input: inputTokens, output: outputTokens });

  return { traceId, text };
}

export function handleError(
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): SSEHandlerResult {
  const errorMsg = (data.error as string) || "Unknown error";
  ctx.trace?.error(errorMsg, data.stack as string | undefined);
  return { error: new Error(errorMsg) };
}

// ============================================================================
// Handler Map for Dispatch
// ============================================================================

export type SSEEventType =
  | "log"
  | "message-start"
  | "text-delta"
  | "message-complete"
  | "system-prompt"
  | "user-prompt"
  | "tools-available"
  | "tools-discovered"
  | "model-info"
  | "tool-call"
  | "tool-result"
  | "tool-error"
  | "step-start"
  | "instructions-injected"
  | "llm-context"
  | "context-cleanup"
  | "compaction-start"
  | "compaction-progress"
  | "compaction-complete"
  | "step-finish"
  | "result"
  | "error"
  | "done"
  | "finish"
  | "step"
  | "step-complete"
  | "step-completed";

/**
 * Process an SSE event and dispatch to the appropriate handler
 *
 * @param eventType - The SSE event type
 * @param data - Event data payload
 * @param ctx - Handler context with trace, store, and refs
 * @returns Handler result (may contain traceId, text, or error)
 */
/**
 * Dispatch SSE events to appropriate handlers with error boundary.
 * If a handler throws, the error is logged and the stream continues.
 * This prevents a single malformed event from crashing the entire stream.
 */
export function dispatchSSEEvent(
  eventType: string,
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): SSEHandlerResult {
  try {
    return dispatchSSEEventUnsafe(eventType, data, ctx);
  } catch (error) {
    // Log the error but don't crash the stream
    console.error(`[SSE] Handler error for event "${eventType}":`, error);
    // Log to trace store for visibility in debug panel using systemLog
    ctx.trace?.systemLog(`SSE handler error for "${eventType}": ${(error as Error).message}`, {
      eventType,
      errorStack: (error as Error).stack,
      truncatedData: JSON.stringify(data).slice(0, 200),
    });
    return {};
  }
}

/**
 * Internal dispatcher without error boundary (for testability)
 */
function dispatchSSEEventUnsafe(
  eventType: string,
  data: Record<string, unknown>,
  ctx: SSEHandlerContext
): SSEHandlerResult {
  switch (eventType) {
    case "log":
      handleLog(data, ctx);
      break;
    case "message-start":
      handleMessageStart(data, ctx);
      break;
    case "text-delta":
      return handleTextDelta(data, ctx);
    case "message-complete":
      handleMessageComplete(ctx);
      break;
    case "system-prompt":
      handleSystemPrompt(data, ctx);
      break;
    case "user-prompt":
      handleUserPrompt(data, ctx);
      break;
    case "tools-discovered":
      handleToolsDiscovered(data, ctx);
      break;
    case "model-info":
      handleModelInfo(data, ctx);
      break;
    case "tool-call":
      handleToolCall(data, ctx);
      break;
    case "tool-result":
      handleToolResult(data, ctx);
      break;
    case "tool-error":
      handleToolError(data, ctx);
      break;
    case "step-start":
      handleStepStart(data, ctx);
      break;
    case "instructions-injected":
      handleInstructionsInjected(data, ctx);
      break;
    case "llm-context":
      handleLLMContext(data, ctx);
      break;
    case "context-cleanup":
      handleContextCleanup(data, ctx);
      break;
    case "compaction-start":
      handleCompactionStart(data, ctx);
      break;
    case "compaction-progress":
      handleCompactionProgress(data, ctx);
      break;
    case "compaction-complete":
      handleCompactionComplete(data, ctx);
      break;
    case "step-finish":
      handleStepFinish(data, ctx);
      break;
    case "result":
      return handleResult(data, ctx);
    case "error":
      return handleError(data, ctx);
    // Ignored events
    case "done":
    case "finish":
    case "step":
    case "step-complete":
    case "step-completed":
      break;
    default:
      console.warn("Unknown SSE event type:", eventType);
  }

  return {};
}
