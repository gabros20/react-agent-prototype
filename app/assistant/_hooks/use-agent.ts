'use client';

import { useCallback, useState, useRef } from 'react';
import { useChatStore } from '../_stores/chat-store';
import { useLogStore } from '../_stores/log-store';
import { useApprovalStore } from '../_stores/approval-store';
import { useTraceStore, type TraceEntryType } from '../_stores/trace-store';

// Custom message type that's simpler than UIMessage
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

export function useAgent() {
  const { messages, addMessage, setIsStreaming, sessionId, setSessionId, setCurrentTraceId, setAgentStatus } =
    useChatStore();
  const { addLog } = useLogStore();
  const { addEntry, completeEntry, setActiveTrace } = useTraceStore();
  const { setPendingApproval } = useApprovalStore();
  const [error, setError] = useState<Error | null>(null);

  // Track tool call timings for duration calculation
  const toolTimings = useRef<Map<string, number>>(new Map());
  const stepCounter = useRef(0);

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;

      setError(null);
      setIsStreaming(true);
      setAgentStatus({ state: 'thinking' });

      // Reset counters for new trace
      toolTimings.current.clear();
      stepCounter.current = 0;

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
        const traceStartTime = Date.now();

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
                case 'log': {
                  // Initialize trace on first log with traceId
                  if (data.traceId && !currentTraceId) {
                    currentTraceId = data.traceId;
                    setActiveTrace(currentTraceId);

                    // Add trace-start entry
                    addEntry({
                      traceId: currentTraceId,
                      timestamp: traceStartTime,
                      type: 'trace-start',
                      level: 'info',
                      summary: `Trace started: ${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}`,
                      input: { prompt, sessionId },
                    });

                    // Add prompt-sent entry
                    addEntry({
                      traceId: currentTraceId,
                      timestamp: Date.now(),
                      type: 'prompt-sent',
                      level: 'info',
                      summary: 'User prompt sent to LLM',
                      input: prompt,
                    });
                  }
                  currentTraceId = data.traceId || currentTraceId;

                  // Parse backend log messages for enhanced trace entries
                  const message = data.message || '';
                  const metadata = data.metadata || {};

                  // Detect specific log patterns from orchestrator
                  if (message.includes('Extracted entities to working memory')) {
                    addEntry({
                      traceId: currentTraceId,
                      timestamp: Date.now(),
                      type: 'working-memory-update',
                      level: 'info',
                      summary: `Working memory: +${metadata.entityCount || 0} entities`,
                      input: metadata,
                    });
                  } else if (message.includes('Trimming message history')) {
                    addEntry({
                      traceId: currentTraceId,
                      timestamp: Date.now(),
                      type: 'memory-trimmed',
                      level: 'warn',
                      summary: `Messages trimmed: ${metadata.originalCount} → ${metadata.newCount}`,
                      input: metadata,
                    });
                  } else if (message.includes('Checkpoint saved')) {
                    addEntry({
                      traceId: currentTraceId,
                      timestamp: Date.now(),
                      type: 'checkpoint-saved',
                      level: 'info',
                      stepNumber: metadata.stepNumber,
                      summary: `Checkpoint saved at step ${metadata.stepNumber}`,
                      input: metadata,
                    });
                  } else if (message.includes('Retry')) {
                    addEntry({
                      traceId: currentTraceId,
                      timestamp: Date.now(),
                      type: 'retry-attempt',
                      level: 'warn',
                      summary: message,
                      input: metadata,
                    });
                  } else if (message.includes('Loaded session history')) {
                    addEntry({
                      traceId: currentTraceId,
                      timestamp: Date.now(),
                      type: 'session-loaded',
                      level: 'info',
                      summary: `Session loaded: ${metadata.messageCount || 0} messages`,
                      input: metadata,
                    });
                  } else if (message.includes('Creating agent')) {
                    // Log agent creation with tool count
                    addEntry({
                      traceId: currentTraceId,
                      timestamp: Date.now(),
                      type: 'system-log',
                      level: 'info',
                      summary: `Agent created: ${metadata.toolCount || 0} tools, model: ${metadata.modelId || 'unknown'}`,
                      input: metadata,
                    });
                  } else if (message.includes('Step') && message.includes('starting')) {
                    // Track step start for more granular timing
                    addEntry({
                      traceId: currentTraceId,
                      timestamp: Date.now(),
                      type: 'system-log',
                      level: 'debug',
                      stepNumber: metadata.totalSteps,
                      summary: message,
                      input: metadata,
                    });
                  } else if (data.level === 'warn' || data.level === 'error') {
                    // Always capture warnings and errors
                    addEntry({
                      traceId: currentTraceId,
                      timestamp: Date.now(),
                      type: 'system-log',
                      level: data.level,
                      summary: message,
                      input: metadata,
                    });
                  }

                  // Legacy log store
                  addLog({
                    id: crypto.randomUUID(),
                    traceId: data.traceId || currentTraceId,
                    stepId: '',
                    timestamp: new Date(data.timestamp),
                    type: 'info',
                    message: data.message,
                    input: data.metadata
                  });
                  break;
                }

                case 'text-delta':
                  // Streaming text chunks - accumulate but don't display yet
                  assistantText += data.delta || data.text || '';
                  break;

                case 'system-prompt': {
                  // System prompt emitted for debugging/inspection
                  addEntry({
                    traceId: currentTraceId,
                    timestamp: Date.now(),
                    type: 'system-prompt',
                    level: 'info',
                    summary: `System prompt (${data.promptLength?.toLocaleString() || '?'} chars)`,
                    output: data.prompt,
                    input: {
                      workingMemory: data.workingMemory,
                      promptLength: data.promptLength,
                    },
                  });
                  break;
                }

                case 'tool-call': {
                  // Tool is being called
                  setAgentStatus({ state: 'tool-call', toolName: data.toolName });
                  const toolCallId = data.toolCallId || crypto.randomUUID();

                  // Track timing for duration calculation
                  toolTimings.current.set(toolCallId, Date.now());

                  // Enhanced trace entry
                  addEntry({
                    traceId: currentTraceId,
                    timestamp: Date.now(),
                    type: 'tool-call',
                    level: 'info',
                    toolName: data.toolName,
                    toolCallId,
                    stepNumber: stepCounter.current,
                    summary: `Calling ${data.toolName}`,
                    input: data.args,
                  });

                  // Legacy log store
                  addLog({
                    id: crypto.randomUUID(),
                    traceId: currentTraceId,
                    stepId: toolCallId,
                    timestamp: new Date(),
                    type: 'tool-call',
                    message: `Calling tool: ${data.toolName}`,
                    input: data.args
                  });
                  break;
                }

                case 'tool-result': {
                  // Tool execution completed - back to thinking
                  setAgentStatus({ state: 'thinking' });
                  const toolCallId = data.toolCallId || '';

                  // Calculate duration
                  const startTime = toolTimings.current.get(toolCallId);
                  const duration = startTime ? Date.now() - startTime : undefined;
                  toolTimings.current.delete(toolCallId);

                  // Update the original tool-call entry with duration (stops the in-progress indicator)
                  if (toolCallId) {
                    completeEntry(toolCallId, data.result, undefined);
                  }

                  // Check if result requires confirmation (explicit confirmation flag pattern)
                  const result = data.result || {};
                  const requiresConfirmation = result.requiresConfirmation === true;

                  if (requiresConfirmation) {
                    // Tool returned a confirmation request (different from HITL approval)
                    addEntry({
                      traceId: currentTraceId,
                      timestamp: Date.now(),
                      duration,
                      type: 'confirmation-required',
                      level: 'warn',
                      toolName: data.toolName,
                      toolCallId,
                      stepNumber: stepCounter.current,
                      summary: `${data.toolName}: Confirmation required`,
                      output: result,
                    });
                  } else {
                    // Normal tool result
                    addEntry({
                      traceId: currentTraceId,
                      timestamp: Date.now(),
                      duration,
                      type: 'tool-result',
                      level: 'info',
                      toolName: data.toolName,
                      toolCallId,
                      stepNumber: stepCounter.current,
                      summary: `${data.toolName || 'Tool'} completed${duration ? ` (${duration}ms)` : ''}`,
                      output: result,
                    });
                  }

                  // Legacy log store
                  addLog({
                    id: crypto.randomUUID(),
                    traceId: currentTraceId,
                    stepId: toolCallId,
                    timestamp: new Date(),
                    type: 'tool-result',
                    message: `Tool ${data.toolName || 'result'} completed`,
                    input: data.result
                  });
                  break;
                }

                case 'step':
                case 'step-completed': {
                  stepCounter.current++;

                  // Enhanced trace entry
                  addEntry({
                    traceId: data.traceId || currentTraceId,
                    timestamp: Date.now(),
                    type: 'step-complete',
                    level: 'info',
                    stepNumber: stepCounter.current,
                    summary: `Step ${stepCounter.current} completed`,
                    input: data,
                  });

                  // Legacy log store
                  addLog({
                    id: crypto.randomUUID(),
                    traceId: data.traceId || currentTraceId,
                    stepId: data.stepId || '',
                    timestamp: new Date(),
                    type: 'step-complete',
                    message: `Step ${data.stepId || stepCounter.current} completed`,
                    input: data
                  });
                  break;
                }

                case 'result': {
                  currentTraceId = data.traceId;
                  setCurrentTraceId(data.traceId);
                  assistantText = data.text || '';

                  // Update sessionId from backend response (not traceId!)
                  if (data.sessionId && data.sessionId !== sessionId) {
                    setSessionId(data.sessionId);
                  }

                  // Add assistant message
                  const assistantMessage: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: assistantText,
                    createdAt: new Date()
                  };
                  addMessage(assistantMessage as any);

                  // Enhanced trace entry for LLM response
                  addEntry({
                    traceId: currentTraceId,
                    timestamp: Date.now(),
                    type: 'llm-response',
                    level: 'info',
                    summary: `LLM response (${assistantText.length} chars)`,
                    output: assistantText,
                    tokens: data.usage ? {
                      input: data.usage.promptTokens || data.usage.inputTokens || 0,
                      output: data.usage.completionTokens || data.usage.outputTokens || 0,
                    } : undefined,
                  });

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
                }

                case 'error':
                  // Enhanced trace entry for errors
                  addEntry({
                    traceId: data.traceId || currentTraceId,
                    timestamp: Date.now(),
                    type: 'error',
                    level: 'error',
                    summary: data.error || 'Unknown error',
                    error: {
                      message: data.error || 'Unknown error',
                      stack: data.stack,
                    },
                  });

                  // Legacy log store
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
                  // Enhanced trace entry for approval
                  addEntry({
                    traceId: data.traceId || currentTraceId,
                    timestamp: Date.now(),
                    type: 'approval-request',
                    level: 'warn',
                    toolName: data.toolName,
                    summary: `Approval required: ${data.toolName}`,
                    input: data.input,
                  });

                  // Legacy log store
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
                    approvalId: data.approvalId,
                    traceId: data.traceId || currentTraceId,
                    stepId: data.approvalId || data.stepId || '',
                    toolName: data.toolName,
                    input: data.input,
                    description: data.description || `Approve execution of ${data.toolName}?`
                  });
                  break;

                case 'done':
                  // Add trace-complete entry
                  if (currentTraceId) {
                    addEntry({
                      traceId: currentTraceId,
                      timestamp: Date.now(),
                      duration: Date.now() - traceStartTime,
                      type: 'trace-complete',
                      level: 'info',
                      summary: `Trace completed (${Date.now() - traceStartTime}ms)`,
                    });
                  }
                  break;

                case 'finish': {
                  // AI SDK finish event with usage stats
                  console.log('Stream finished:', data);

                  // Update trace metrics with final token usage
                  if (data?.usage && currentTraceId) {
                    addEntry({
                      traceId: currentTraceId,
                      timestamp: Date.now(),
                      type: 'step-complete',
                      level: 'info',
                      summary: `Final: ${data.finishReason || 'completed'}`,
                      tokens: {
                        input: data.usage.promptTokens || data.usage.inputTokens || 0,
                        output: data.usage.completionTokens || data.usage.outputTokens || 0,
                      },
                      input: { finishReason: data.finishReason, usage: data.usage },
                    });
                  }
                  break;
                }

                default:
                  console.warn('Unknown SSE event type:', eventType);
              }
            } catch (parseError) {
              console.error('Failed to parse SSE message:', parseError);
            }
          }
        }

        // SessionId already updated from 'result' event - don't use traceId as sessionId!
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
        setAgentStatus(null);
      }
    },
    [sessionId, addMessage, setIsStreaming, setSessionId, setCurrentTraceId, setAgentStatus, addLog, addEntry, setActiveTrace, setPendingApproval]
  );

  return {
    messages,
    sendMessage,
    isStreaming: useChatStore((state) => state.isStreaming),
    error
  };
}
