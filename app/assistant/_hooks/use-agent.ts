'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useChatStore } from '../_stores/chat-store';
import { useLogStore } from '../_stores/log-store';
import { useApprovalStore } from '../_stores/approval-store';
import { useCallback, useEffect } from 'react';

export function useAgent() {
  const { setMessages, setIsStreaming, sessionId, setSessionId } = useChatStore();
  const { addLog } = useLogStore();
  const { setPendingApproval } = useApprovalStore();

  const { messages, sendMessage: sendMsg, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/agent',
    }),
    onFinish: () => {
      setIsStreaming(false);
    },
    onError: (error) => {
      setIsStreaming(false);
      addLog({
        id: crypto.randomUUID(),
        traceId: 'error',
        stepId: 'error',
        timestamp: new Date(),
        type: 'error',
        message: error.message,
      });
    },
  });

  // Sync messages to store
  useEffect(() => {
    setMessages(messages);
  }, [messages, setMessages]);

  // Sync streaming state
  useEffect(() => {
    const isStreaming = status === 'streaming' || status === 'submitted';
    setIsStreaming(isStreaming);
  }, [status, setIsStreaming]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      setIsStreaming(true);
      await sendMsg({ text });
    },
    [sendMsg, setIsStreaming]
  );

  return {
    messages,
    sendMessage,
    isStreaming: status === 'streaming' || status === 'submitted',
    error,
  };
}
