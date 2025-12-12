"use client";

/**
 * useAgent Hook
 *
 * Manages agent communication and message streaming.
 * SSE event handling is delegated to sse-handlers.ts.
 */

import { useCallback, useState, useRef } from "react";
import { useChatStore } from "../_stores/chat-store";
import { useTraceStore, type TraceEntry } from "../_stores/trace-store";
import { useSessionStore } from "../_stores/session-store";
import { agentApi, sessionsApi } from "@/lib/api";
import { debugLogger } from "@/lib/debug-logger";
import { dispatchSSEEvent, type SSEHandlerContext } from "./sse-handlers";
import type { TraceLogger } from "@/lib/debug-logger";

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

// ============================================================================
// Hook
// ============================================================================

export function useAgent() {
  // Store selectors - using individual selectors to minimize re-renders
  const messages = useChatStore((s) => s.messages);
  const sessionId = useChatStore((s) => s.sessionId);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);

  // Store actions - select individually (function references are stable in Zustand)
  const addMessage = useChatStore((s) => s.addMessage);
  const setIsStreaming = useChatStore((s) => s.setIsStreaming);
  const setSessionId = useChatStore((s) => s.setSessionId);
  const setCurrentTraceId = useChatStore((s) => s.setCurrentTraceId);
  const setAgentStatus = useChatStore((s) => s.setAgentStatus);
  const startStreamingMessage = useChatStore((s) => s.startStreamingMessage);
  const appendToStreamingMessage = useChatStore((s) => s.appendToStreamingMessage);
  const finalizeStreamingMessage = useChatStore((s) => s.finalizeStreamingMessage);
  const clearStreamingMessage = useChatStore((s) => s.clearStreamingMessage);

  const loadSessions = useSessionStore((s) => s.loadSessions);
  const getCurrentSessionModel = useSessionStore((s) => s.getCurrentSessionModel);

  const [error, setError] = useState<Error | null>(null);

  // Refs for cross-event state
  const traceRef = useRef<TraceLogger | null>(null);
  const traceStartTimeRef = useRef<number>(0);
  const userPromptRef = useRef<string>("");
  const streamingTextRef = useRef<string>("");

  // Build handler context
  const buildHandlerContext = useCallback((): SSEHandlerContext => ({
    trace: traceRef.current,
    store: {
      setAgentStatus,
      startStreamingMessage,
      appendToStreamingMessage,
      finalizeStreamingMessage,
      clearStreamingMessage,
      setSessionId,
      setCurrentTraceId,
    },
    refs: {
      streamingText: streamingTextRef,
    },
    currentSessionId: sessionId,
  }), [
    setAgentStatus,
    startStreamingMessage,
    appendToStreamingMessage,
    finalizeStreamingMessage,
    clearStreamingMessage,
    setSessionId,
    setCurrentTraceId,
    sessionId,
  ]);

  // Initialize trace on first event with traceId
  const initializeTrace = useCallback((data: Record<string, unknown>): string | undefined => {
    if (data.traceId && !traceRef.current) {
      const traceId = data.traceId as string;
      traceRef.current = debugLogger.trace(traceId);
      traceRef.current.start({
        sessionId: sessionId || undefined,
        userPrompt: userPromptRef.current,
      });
      return traceId;
    }
    return undefined;
  }, [sessionId]);

  // Handle 'done' event - save conversation log
  const handleDone = useCallback(async () => {
    const trace = traceRef.current;
    if (!trace) return;

    const completedAt = Date.now();

    // Complete the trace
    trace.complete({ metrics: useTraceStore.getState().getMetrics() });

    // Get entries and metrics
    const store = useTraceStore.getState();
    const entries = store.entriesByTrace[trace.traceId] || [];
    const metrics = store.getMetrics();

    // Save to backend
    const actualSessionId = useChatStore.getState().sessionId;
    if (actualSessionId) {
      const modelInfo = store.modelInfoByTrace[trace.traceId];
      try {
        await sessionsApi.saveLog(actualSessionId, {
          userPrompt: userPromptRef.current,
          entries: entries.map((e: TraceEntry) => ({ ...e })),
          metrics,
          modelInfo: modelInfo || undefined,
          startedAt: new Date(traceStartTimeRef.current).toISOString(),
          completedAt: new Date(completedAt).toISOString(),
        });
        await loadSessions();
      } catch (err) {
        console.error("Failed to save conversation log:", err);
      }
    }

    traceRef.current = null;
  }, [loadSessions]);

  // Main send message function
  const sendMessage = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return;

    // Reset state
    setError(null);
    setIsStreaming(true);
    setAgentStatus({ state: "thinking" });

    // Store for conversation log
    userPromptRef.current = prompt;
    traceStartTimeRef.current = Date.now();
    streamingTextRef.current = "";

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      createdAt: new Date(),
    };
    addMessage(userMessage as Parameters<typeof addMessage>[0]);

    try {
      const modelId = getCurrentSessionModel();
      const stream = await agentApi.stream({
        sessionId: sessionId || undefined,
        prompt,
        modelId: modelId || undefined,
      });

      // Process SSE stream
      for await (const event of stream) {
        const { type, data } = event;
        const eventData = data as Record<string, unknown>;

        // Initialize trace on first event with traceId
        initializeTrace(eventData);

        // Build fresh context for each event (trace may have been initialized)
        const ctx = buildHandlerContext();
        ctx.trace = traceRef.current; // Use current trace ref

        // Handle 'done' specially - it needs async processing
        if (type === "done") {
          await handleDone();
          continue;
        }

        // Dispatch to appropriate handler
        const result = dispatchSSEEvent(type, eventData, ctx);

        // Handle errors from handlers
        if (result.error) {
          setError(result.error);
        }
      }
    } catch (err) {
      const e = err as Error;
      console.error("Agent error:", e);
      setError(e);
      debugLogger.error(e.message, e);
    } finally {
      setIsStreaming(false);
      setAgentStatus(null);
    }
  }, [
    sessionId,
    addMessage,
    setIsStreaming,
    setAgentStatus,
    getCurrentSessionModel,
    initializeTrace,
    buildHandlerContext,
    handleDone,
  ]);

  return {
    messages,
    streamingMessage,
    sendMessage,
    isStreaming,
    error,
  };
}
