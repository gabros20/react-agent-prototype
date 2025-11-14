'use client';

import { useCallback, useState } from 'react';
import { useChatStore } from '../_stores/chat-store';
import { useLogStore } from '../_stores/log-store';
import { useApprovalStore } from '../_stores/approval-store';

// Custom message type that's simpler than UIMessage
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

export function useAgent() {
  const { messages, addMessage, setIsStreaming, sessionId, setSessionId, setCurrentTraceId } =
    useChatStore();
  const { addLog } = useLogStore();
  const { setPendingApproval } = useApprovalStore();
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;

      setError(null);
      setIsStreaming(true);

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: prompt,
        createdAt: new Date()
      };
      addMessage(userMessage as any);

      try {
        // Call backend API
        const response = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId || undefined,
            prompt
          })
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // Parse SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentTraceId = '';
        let assistantText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              // Parse SSE format: "event: <type>\ndata: <json>"
              const eventMatch = line.match(/^event: (.+)\ndata: (.+)$/s);
              if (!eventMatch) continue;

              const [, eventType, dataStr] = eventMatch;
              const data = JSON.parse(dataStr);

              // Handle different event types
              switch (eventType) {
                case 'log':
                  addLog({
                    id: crypto.randomUUID(),
                    traceId: data.traceId || currentTraceId,
                    stepId: '',
                    timestamp: new Date(data.timestamp),
                    type: 'info',
                    message: data.message,
                    input: data.metadata
                  });
                  currentTraceId = data.traceId || currentTraceId;
                  break;

                case 'text-delta':
                  // Streaming text chunks - accumulate but don't display yet
                  // (will be shown in final 'result' event)
                  assistantText += data.delta || data.text || '';
                  break;

                case 'tool-call':
                  // Tool is being called
                  addLog({
                    id: crypto.randomUUID(),
                    traceId: currentTraceId,
                    stepId: data.toolCallId || crypto.randomUUID(),
                    timestamp: new Date(),
                    type: 'tool-call',
                    message: `Calling tool: ${data.toolName}`,
                    input: data.args
                  });
                  break;

                case 'tool-result':
                  // Tool execution completed
                  addLog({
                    id: crypto.randomUUID(),
                    traceId: currentTraceId,
                    stepId: data.toolCallId || crypto.randomUUID(),
                    timestamp: new Date(),
                    type: 'tool-result',
                    message: `Tool ${data.toolName || 'result'} completed`,
                    input: data.result
                  });
                  break;

                case 'step':
                  addLog({
                    id: crypto.randomUUID(),
                    traceId: data.traceId || currentTraceId,
                    stepId: data.stepId || '',
                    timestamp: new Date(),
                    type: 'step-complete',
                    message: `Step ${data.stepId} completed`,
                    input: data
                  });
                  break;

                case 'result':
                  currentTraceId = data.traceId;
                  setCurrentTraceId(data.traceId);
                  assistantText = data.text || '';

                  // Add assistant message
                  const assistantMessage: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: assistantText,
                    createdAt: new Date()
                  };
                  addMessage(assistantMessage as any);

                  // Log intelligence metrics
                  if (data.intelligence) {
                    addLog({
                      id: crypto.randomUUID(),
                      traceId: currentTraceId,
                      stepId: 'final',
                      timestamp: new Date(),
                      type: 'info',
                      message: 'Intelligence Layer Stats',
                      input: data.intelligence
                    });
                  }
                  break;

                case 'error':
                  addLog({
                    id: crypto.randomUUID(),
                    traceId: data.traceId || currentTraceId,
                    stepId: 'error',
                    timestamp: new Date(),
                    type: 'error',
                    message: data.error || 'Unknown error'
                  });
                  setError(new Error(data.error || 'Unknown error'));
                  break;

                case 'approval-required':
                  // Handle HITL approval request (Native AI SDK v6)
                  addLog({
                    id: crypto.randomUUID(),
                    traceId: data.traceId || currentTraceId,
                    stepId: data.approvalId || data.stepId || '',
                    timestamp: new Date(),
                    type: 'system',
                    message: `🛡️ Approval Required: ${data.toolName}`
                  });
                  
                  // Show approval modal with approvalId
                  useApprovalStore.getState().setPendingApproval({
                    approvalId: data.approvalId,  // Native AI SDK v6 approval ID
                    traceId: data.traceId || currentTraceId,
                    stepId: data.approvalId || data.stepId || '',
                    toolName: data.toolName,
                    input: data.input,
                    description: data.description || `Approve execution of ${data.toolName}?`
                  });
                  break;

                case 'done':
                  // Stream finished
                  break;

                default:
                  console.warn('Unknown SSE event type:', eventType);
              }
            } catch (parseError) {
              console.error('Failed to parse SSE message:', parseError);
            }
          }
        }

        // Update session ID if new
        if (currentTraceId && !sessionId) {
          setSessionId(currentTraceId);
        }
      } catch (err) {
        const error = err as Error;
        console.error('Agent error:', error);
        setError(error);

        addLog({
          id: crypto.randomUUID(),
          traceId: 'error',
          stepId: 'error',
          timestamp: new Date(),
          type: 'error',
          message: error.message
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [sessionId, addMessage, setIsStreaming, setSessionId, setCurrentTraceId, addLog, setPendingApproval]
  );

  return {
    messages,
    sendMessage,
    isStreaming: useChatStore((state) => state.isStreaming),
    error
  };
}
