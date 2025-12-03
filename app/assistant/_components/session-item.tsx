'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { MoreVertical, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSessionStore, type SessionMetadata } from '../_stores/session-store';
import { useChatStore } from '../_stores/chat-store';
import { useTraceStore } from '../_stores/trace-store';

/**
 * Extract readable text content from AI SDK message format.
 * Handles both plain strings and AI SDK content parts array.
 */
function extractMessageContent(content: any): string {
  // Already a plain string
  if (typeof content === 'string') {
    // Check if it's a JSON array string (AI SDK format)
    if (content.startsWith('[') && content.includes('"type"')) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join('\n');
        }
      } catch {
        // Not valid JSON, return as-is
      }
    }
    return content;
  }

  // Array of content parts (AI SDK format)
  if (Array.isArray(content)) {
    return content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('\n');
  }

  // Object with text property
  if (content && typeof content === 'object' && content.text) {
    return content.text;
  }

  // Fallback: stringify
  return JSON.stringify(content);
}

interface SessionItemProps {
  session: SessionMetadata;
  isActive: boolean;
  onSessionLoad?: () => void;
}

export function SessionItem({ session, isActive, onSessionLoad }: SessionItemProps) {
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const queryClient = useQueryClient();

  // Use selectors to avoid subscribing to entire store
  const loadSession = useSessionStore((state) => state.loadSession);
  const clearHistory = useSessionStore((state) => state.clearHistory);
  const deleteSession = useSessionStore((state) => state.deleteSession);

  const setSessionId = useChatStore((state) => state.setSessionId);
  const setMessages = useChatStore((state) => state.setMessages);

  const clearAllTraces = useTraceStore((state) => state.clearAllTraces);

  const handleLoadSession = async () => {
    try {
      const loadedSession = await loadSession(session.id);
      if (loadedSession) {
        // Clear live traces when switching sessions
        clearAllTraces();

        setSessionId(loadedSession.id);
        // Convert messages to ChatMessage format
        const chatMessages = loadedSession.messages.map((msg) => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: extractMessageContent(msg.content),
          createdAt: msg.createdAt,
        }));
        setMessages(chatMessages);

        // Invalidate the query so TanStack refetches logs for new session
        queryClient.invalidateQueries({ queryKey: ['conversationLogs', session.id] });

        // Call callback to close sheet
        onSessionLoad?.();
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory(session.id);
      if (isActive) {
        setMessages([]); // Clear messages in chat store if this is active session
        clearAllTraces();
      }
      setShowClearDialog(false);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const handleDeleteSession = async () => {
    try {
      const newSessionId = await deleteSession(session.id);

      // If this was the active session, we need to update the chat store
      if (isActive) {
        if (newSessionId) {
          // Load the new session (either next session or newly created)
          const newSession = await loadSession(newSessionId);
          if (newSession) {
            setSessionId(newSession.id);
            const chatMessages = newSession.messages.map((msg) => ({
              id: msg.id,
              role: msg.role as 'user' | 'assistant' | 'system',
              content: extractMessageContent(msg.content),
              createdAt: msg.createdAt,
            }));
            setMessages(chatMessages);
          } else {
            // Fallback: new session with no messages
            setSessionId(newSessionId);
            setMessages([]);
          }
        } else {
          setSessionId(null);
          setMessages([]);
        }
        clearAllTraces();
      }
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  return (
    <>
      <div
        className={`group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-white ${
          isActive ? 'bg-white shadow-sm' : ''
        }`}
      >
        {/* Session Info - Clickable */}
        <button
          onClick={handleLoadSession}
          className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
        >
          <div className="w-full truncate text-sm font-medium text-gray-900">{session.title}</div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{session.messageCount} messages</span>
            <span>•</span>
            <span>{formatDistanceToNow(session.lastActivity, { addSuffix: true })}</span>
          </div>
        </button>

        {/* Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowClearDialog(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Clear History
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Clear History Confirmation */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all messages from "{session.title}" but keep the session. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory}>Clear History</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Session Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{session.title}" and all its messages. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
