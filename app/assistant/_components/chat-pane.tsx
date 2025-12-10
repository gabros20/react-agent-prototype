"use client";

import { useState, useEffect, useRef, memo } from "react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { PromptInput, PromptInputBody, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { useAgent } from "../_hooks/use-agent";
import { useChatStore, type ChatMessage, type StreamingMessage } from "../_stores/chat-store";
import { useSessionStore } from "../_stores/session-store";
import { Button } from "@/components/ui/button";
import { Trash2, MessageSquare } from "lucide-react";
import { AgentStatusIndicator } from "@/components/ai-elements/agent-status";
import { ModelSelector } from "./model-selector";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Inner component that handles auto-scroll when messages change
function MessageList({ messages, streamingMessage }: { messages: ChatMessage[]; streamingMessage: StreamingMessage | null }) {
	const { scrollToBottom } = useStickToBottomContext();
	const prevMessagesLength = useRef(messages.length);
	const prevStreamingContent = useRef<string | null>(null);

	useEffect(() => {
		// Scroll when new messages are added
		if (messages.length > prevMessagesLength.current) {
			scrollToBottom({ animation: "smooth" });
		}
		prevMessagesLength.current = messages.length;
	}, [messages.length, scrollToBottom]);

	// Also scroll when streaming message content changes significantly
	useEffect(() => {
		if (streamingMessage?.content && streamingMessage.content !== prevStreamingContent.current) {
			// Only scroll if this is a new streaming message or significant content addition
			if (!prevStreamingContent.current || streamingMessage.content.length > prevStreamingContent.current.length + 50) {
				scrollToBottom({ animation: "smooth" });
			}
			prevStreamingContent.current = streamingMessage.content;
		} else if (!streamingMessage) {
			prevStreamingContent.current = null;
		}
	}, [streamingMessage?.content, scrollToBottom]);

	if (messages.length === 0 && !streamingMessage) {
		return (
			<div className='flex items-center justify-center h-full text-muted-foreground p-4'>
				<div className='text-center'>
					<p className='text-base sm:text-lg font-medium mb-2'>No messages yet</p>
					<p className='text-xs sm:text-sm'>Start a conversation to manage your CMS</p>
				</div>
			</div>
		);
	}

	return (
		<>
			{messages.map((message) => (
				<Message from={message.role} key={message.id}>
					<MessageContent>
						<Response className='text-xs sm:text-sm'>{message.content}</Response>
					</MessageContent>
				</Message>
			))}

			{/* Streaming message - real-time display during agent execution */}
			{streamingMessage && streamingMessage.content && (
				<Message from="assistant" key={streamingMessage.id}>
					<MessageContent>
						<div className="flex items-end gap-0.5">
							<Response className='text-xs sm:text-sm'>
								{streamingMessage.content}
							</Response>
							<span className="inline-block w-2 h-4 bg-current animate-pulse shrink-0" />
						</div>
					</MessageContent>
				</Message>
			)}

			{/* Status indicator at end of messages during streaming */}
			<AgentStatusIndicator />
		</>
	);
}

// Memoized conversation area - won't re-render when input changes
const ConversationArea = memo(function ConversationArea({ messages, streamingMessage }: { messages: ChatMessage[]; streamingMessage: StreamingMessage | null }) {
	return (
		<Conversation className='h-full'>
			<ConversationContent>
				<MessageList messages={messages} streamingMessage={streamingMessage} />
			</ConversationContent>
			<ConversationScrollButton />
		</Conversation>
	);
});

// Isolated input component - typing here won't re-render parent
function ChatInput({ onSendMessage, isStreaming }: { onSendMessage: (text: string) => void; isStreaming: boolean }) {
	const [input, setInput] = useState("");

	return (
		<PromptInput
			onSubmit={(message) => {
				if (message.text && message.text.trim() && !isStreaming) {
					onSendMessage(message.text);
					setInput("");
				}
			}}
			className='w-full'
		>
			<PromptInputBody>
				<PromptInputTextarea
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder='Type a message...'
					className='min-h-[60px] sm:min-h-[80px] text-sm'
					disabled={isStreaming}
				/>
			</PromptInputBody>
			<PromptInputFooter>
				<div className='flex items-center justify-between w-full'>
					<ModelSelector disabled={isStreaming} />
					<PromptInputSubmit disabled={isStreaming || !input.trim()} />
				</div>
			</PromptInputFooter>
		</PromptInput>
	);
}

export function ChatPane() {
	const { sendMessage, isStreaming, streamingMessage } = useAgent();

	// Use selectors to avoid subscribing to entire store
	const messages = useChatStore((state) => state.messages);
	const reset = useChatStore((state) => state.reset);
	const sessionId = useChatStore((state) => state.sessionId);
	const clearHistory = useSessionStore((state) => state.clearHistory);

	const handleClearHistory = async () => {
		// Use sessionId from chat store (which is the active session)
		if (!sessionId) {
			console.warn("No active session to clear");
			return;
		}

		try {
			await clearHistory(sessionId);
			reset();
		} catch (error) {
			console.error("Failed to clear history:", error);
		}
	};

	return (
		<div className='flex flex-col h-full border rounded-lg bg-card overflow-hidden shadow-sm'>
			{/* Header - Fixed */}
			<div className='flex-none p-3 sm:p-4 border-b bg-muted/30'>
				<div className='flex items-start justify-between gap-2'>
					<div className='flex gap-3 flex-1 min-w-0'>
						<MessageSquare className='h-5 w-5 text-primary flex-none mt-[5px]' />
						<div className='flex-1 min-w-0'>
							<h2 className='text-base sm:text-lg font-semibold'>Conversation</h2>
							<p className='text-xs sm:text-sm text-muted-foreground'>Ask anything about your CMS</p>
						</div>
					</div>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant='ghost' size='icon' className='flex-none h-8 w-8' title='Clear history' disabled={messages.length === 0}>
								<Trash2 className='h-4 w-4' />
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
								<AlertDialogDescription>
									This will delete all messages in the current session. This action cannot be undone.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction onClick={handleClearHistory}>Clear History</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>

			{/* Messages - Flex-1 with overflow */}
			<div className='flex-1 min-h-0 overflow-hidden'>
				<ConversationArea messages={messages} streamingMessage={streamingMessage} />
			</div>

			{/* Input - Fixed (isolated component to prevent re-renders) */}
			<div className='flex-none p-3 sm:p-4 border-t'>
				<ChatInput onSendMessage={sendMessage} isStreaming={isStreaming} />
			</div>
		</div>
	);
}
