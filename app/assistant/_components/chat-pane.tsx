"use client";

import { useState } from "react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Markdown } from "@/components/markdown";
import { useAgent } from "../_hooks/use-agent";
import { useChatStore } from "../_stores/chat-store";
import { useSessionStore } from "../_stores/session-store";
import { Button } from "@/components/ui/button";
import { Trash2, MessageSquare } from "lucide-react";
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

export function ChatPane() {
	const [input, setInput] = useState("");
	const { sendMessage, isStreaming } = useAgent();
	const { messages, reset, sessionId } = useChatStore();
	const { clearHistory } = useSessionStore();

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
				<Conversation className='h-full'>
					<ConversationContent>
						{messages.length === 0 ? (
							<div className='flex items-center justify-center h-full text-muted-foreground p-4'>
								<div className='text-center'>
									<p className='text-base sm:text-lg font-medium mb-2'>No messages yet</p>
									<p className='text-xs sm:text-sm'>Start a conversation to manage your CMS</p>
								</div>
							</div>
						) : (
							messages.map((message) => (
								<Message from={message.role} key={message.id}>
									<MessageContent>
										<Markdown className='text-xs sm:text-sm'>{message.content}</Markdown>
									</MessageContent>
								</Message>
							))
						)}
					</ConversationContent>
					<ConversationScrollButton />
				</Conversation>
			</div>

			{/* Input - Fixed */}
			<div className='flex-none p-3 sm:p-4 border-t'>
				<PromptInput
					onSubmit={(message) => {
						if (message.text && message.text.trim() && !isStreaming) {
							sendMessage(message.text);
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
							<span className='text-xs text-muted-foreground'>{isStreaming ? "Agent is thinking..." : "Press Enter to send"}</span>
							<PromptInputSubmit disabled={isStreaming || !input.trim()} />
						</div>
					</PromptInputFooter>
				</PromptInput>
			</div>
		</div>
	);
}
