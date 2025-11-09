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
import { useAgent } from '../_hooks/use-agent';
import { useChatStore } from '../_stores/chat-store';

export function ChatPane() {
  const [input, setInput] = useState('');
  const { sendMessage, isStreaming } = useAgent();
  const { messages } = useChatStore();

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">AI Assistant</h2>
        <p className="text-sm text-muted-foreground">Chat with the CMS agent</p>
      </div>

      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium mb-2">No messages yet</p>
                <p className="text-sm">Start a conversation to manage your CMS</p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts?.map((part, i) => {
                    if (part.type === 'text') {
                      return (
                        <div key={`${message.id}-${i}`} className="prose prose-sm max-w-none">
                          {part.text}
                        </div>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="p-4 border-t">
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
              className="min-h-[80px]"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputSubmit disabled={isStreaming || !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
