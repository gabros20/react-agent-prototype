/**
 * Agent API - Streaming agent execution
 *
 * Handles SSE streaming for agent responses.
 */

import { ApiClientError } from "./client";

// ============================================================================
// Types
// ============================================================================

export interface AgentStreamOptions {
  sessionId?: string;
  prompt: string;
  modelId?: string;
  cmsTarget?: {
    siteId?: string;
    environmentId?: string;
  };
}

export interface SSEEvent {
  type: string;
  data: unknown;
}

export interface SSEParseError {
  rawData: string;
  error: Error;
}

export type OnSSEParseError = (error: SSEParseError) => void;

// ============================================================================
// SSE Parser
// ============================================================================

/**
 * Parse SSE chunk into events
 * @param chunk - Raw SSE chunk string
 * @param onError - Optional callback for parse errors (errors are logged if not provided)
 */
export function parseSSEChunk(chunk: string, onError?: OnSSEParseError): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = chunk.split("\n\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    // Parse SSE format: "event: <type>\ndata: <json>"
    const eventMatch = line.match(/^event: (.+)\ndata: (.+)$/s);
    if (!eventMatch) continue;

    const [, eventType, dataStr] = eventMatch;
    try {
      events.push({
        type: eventType,
        data: JSON.parse(dataStr),
      });
    } catch (e) {
      // Call error callback or log warning
      const error = e instanceof Error ? e : new Error(String(e));
      if (onError) {
        onError({ rawData: dataStr, error });
      } else {
        console.warn("Failed to parse SSE data:", dataStr.slice(0, 200));
      }
    }
  }

  return events;
}

/**
 * Create an async iterable from SSE stream
 * @param stream - Response body stream
 * @param onError - Optional callback for parse errors
 */
export async function* createSSEReader(
  stream: ReadableStream<Uint8Array>,
  onError?: OnSSEParseError
): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const events = parseSSEChunk(line + "\n\n", onError);
        for (const event of events) {
          yield event;
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const events = parseSSEChunk(buffer, onError);
      for (const event of events) {
        yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Stream agent execution
 * Returns an async iterable of SSE events
 */
export async function stream(
  options: AgentStreamOptions
): Promise<AsyncGenerator<SSEEvent>> {
  const response = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: options.sessionId,
      prompt: options.prompt,
      modelId: options.modelId,
      cmsTarget: options.cmsTarget,
    }),
  });

  if (!response.ok) {
    throw new ApiClientError(
      `Agent stream failed: ${response.statusText}`,
      "STREAM_ERROR",
      response.status
    );
  }

  if (!response.body) {
    throw new ApiClientError(
      "No response body for stream",
      "NO_STREAM_BODY",
      500
    );
  }

  return createSSEReader(response.body);
}

/**
 * Non-streaming agent execution
 */
export async function generate(options: AgentStreamOptions): Promise<{
  text: string;
  sessionId: string;
  traceId: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}> {
  const response = await fetch("/api/agent/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: options.sessionId,
      prompt: options.prompt,
      modelId: options.modelId,
      cmsTarget: options.cmsTarget,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiClientError(
      error?.error?.message ?? `Agent generate failed: ${response.statusText}`,
      error?.error?.code ?? "GENERATE_ERROR",
      response.status
    );
  }

  const result = await response.json();
  if (!result.success) {
    throw new ApiClientError(
      result.error?.message ?? "Agent generate failed",
      result.error?.code ?? "GENERATE_ERROR",
      500
    );
  }

  return result.data;
}

// Export as namespace
export const agentApi = {
  stream,
  generate,
  parseSSEChunk,
  createSSEReader,
};
