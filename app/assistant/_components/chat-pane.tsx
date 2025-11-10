'use client';

import { useState } from 'react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';
import { useAgent, type AgentMode } from '../_hooks/use-agent';
import { useChatStore } from '../_stores/chat-store';

interface ChatPaneProps {
  mode: AgentMode;
}

export function ChatPane({ mode }: ChatPaneProps) {
  const [input, setInput] = useState('');
  const { sendMessage, isStreaming } = useAgent(mode);
  const { messages } = useChatStore();

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-none p-3 sm:p-4 border-b">
        <h2 className="text-base sm:text-lg font-semibold">AI Assistant</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">Chat with the CMS agent</p>
      </div>

      {/* Messages - Flex-1 with overflow */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground p-4">
                <div className="text-center">
                  <p className="text-base sm:text-lg font-medium mb-2">No messages yet</p>
                  <p className="text-xs sm:text-sm">Start a conversation to manage your CMS</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-xs sm:text-sm">
                      {message.content}
                    </div>
                  </MessageContent>
                </Message>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      {/* Input - Fixed */}
      <div className="flex-none p-3 sm:p-4 border-t">
        <PromptInput 
          onSubmit={(message) => {
            if (message.text && message.text.trim() && !isStreaming) {
              sendMessage(message.text);
              setInput('');
            }
          }} 
          className="w-full"
        >
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="min-h-[60px] sm:min-h-[80px] text-sm"
              disabled={isStreaming}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground">
                {isStreaming ? 'Agent is thinking...' : 'Press Enter to send'}
              </span>
              <PromptInputSubmit disabled={isStreaming || !input.trim()} />
            </div>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
