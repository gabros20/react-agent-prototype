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
 * Extract readable text content from a message.
 * Prefers displayContent (plain text for UI) when available.
 * Falls back to parsing AI SDK content format if displayContent is not set.
 *
 * Message format:
 * - displayContent: Plain text for UI display (new pattern)
 * - content: AI SDK format for LLM context (may be string or array of parts)
 *
 * Returns empty string for tool-only messages (they shouldn't be displayed).
 */
export function extractMessageContent(message: { displayContent?: string | null; content?: unknown } | unknown): string {
  // Handle the full message object case (new pattern)
  if (message && typeof message === 'object' && 'displayContent' in message) {
    const msg = message as { displayContent?: string | null; content?: unknown };

    // Prefer displayContent if available
    if (msg.displayContent && typeof msg.displayContent === 'string') {
      return msg.displayContent;
    }

    // Fall back to extracting from content
    return extractFromContent(msg.content);
  }

  // Legacy: direct content value (for backward compatibility)
  return extractFromContent(message);
}

/**
 * Extract text from AI SDK content format.
 * This is the legacy extraction logic for messages without displayContent.
 */
function extractFromContent(content: unknown): string {
  // Handle null/undefined
  if (content == null) return '';

  // Already a plain string - check if it needs JSON parsing
  if (typeof content === 'string') {
    // Check if it's a JSON string that needs parsing
    const trimmed = content.trim();
    if ((trimmed.startsWith('[') || trimmed.startsWith('{')) && trimmed.includes('"type"')) {
      try {
        const parsed = JSON.parse(trimmed);
        // Recurse with parsed content
        return extractFromContent(parsed);
      } catch {
        // Not valid JSON, return as-is (plain text message)
      }
    }
    // Plain string content
    return content;
  }

  // Array of content parts (AI SDK format)
  if (Array.isArray(content)) {
    const textParts = content
      .filter((part): part is { type: 'text'; text: string } =>
        part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string'
      )
      .map(part => part.text);

    // Return joined text parts, or empty string if no text (tool-only message)
    return textParts.join('\n');
  }

  // Single object - check if it's a text part
  if (content && typeof content === 'object') {
    const obj = content as Record<string, unknown>;

    // AI SDK text part: { type: 'text', text: '...' }
    if (obj.type === 'text' && typeof obj.text === 'string') {
      return obj.text;
    }

    // Tool call or tool result - don't display as text
    if (obj.type === 'tool-call' || obj.type === 'tool-result') {
      return '';
    }

    // Object with text property
    if ('text' in obj && typeof obj.text === 'string') {
      return obj.text;
    }
  }

  // Fallback: return empty string
  return '';
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
        // Convert messages to ChatMessage format, filtering out tool-only messages
        // (messages with empty content after extraction are tool calls/results that
        // shouldn't be displayed in the chat UI)
        // Pass full message object to extractMessageContent so it can use displayContent
        const chatMessages = loadedSession.messages
          .filter((msg) => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
          .map((msg) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant' | 'system',
            content: extractMessageContent(msg), // Pass full message object
            createdAt: msg.createdAt,
          }))
          .filter((msg) => msg.content.trim() !== ''); // Remove messages with no displayable content
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
            const chatMessages = newSession.messages
              .filter((msg) => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
              .map((msg) => ({
                id: msg.id,
                role: msg.role as 'user' | 'assistant' | 'system',
                content: extractMessageContent(msg), // Pass full message object
                createdAt: msg.createdAt,
              }))
              .filter((msg) => msg.content.trim() !== '');
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
