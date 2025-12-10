'use client';

import { useEffect } from 'react';
import { ChatPane } from './_components/chat-pane';
import { EnhancedDebugPanel } from './_components/enhanced-debug';
import { SessionSidebar } from './_components/session-sidebar';
import { useSessionStore } from './_stores/session-store';
import { useChatStore } from './_stores/chat-store';
import { useWorkerEvents } from './_hooks/use-worker-events';
import { Bot, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

export default function AssistantPage() {
  // Use selectors to avoid subscribing to entire store
  const loadSessions = useSessionStore((state) => state.loadSessions);
  const createSession = useSessionStore((state) => state.createSession);
  const setSessionId = useChatStore((state) => state.setSessionId);

  // Subscribe to worker events (image processing, etc.)
  // This connects via SSE and adds events to the trace store
  useWorkerEvents();

  // Initialize session on mount
  useEffect(() => {
    const initializeSession = async () => {
      // Load sessions first
      await loadSessions();

      // Check current state AFTER loading (not from stale closure)
      const currentSessionId = useChatStore.getState().sessionId;
      const loadedSessions = useSessionStore.getState().sessions;

      if (!currentSessionId) {
        if (loadedSessions.length === 0) {
          // No sessions exist - create a new one
          try {
            const newSessionId = await createSession('New Session');
            setSessionId(newSessionId);
          } catch (error) {
            console.error('Failed to create initial session:', error);
          }
        } else {
          // Sessions exist but none selected - select the first one
          setSessionId(loadedSessions[0].id);
          useSessionStore.getState().setCurrentSessionId(loadedSessions[0].id);
        }
      } else {
        // Session ID exists (from localStorage) - verify it still exists and reload messages
        // This handles page refresh where localStorage may have stale/malformed message content
        const sessionExists = loadedSessions.some(s => s.id === currentSessionId);
        if (sessionExists) {
          // Reload the session to get fresh messages from API
          const { sessionsApi } = await import('@/lib/api');
          const { extractMessageContent } = await import('./_components/session-item');
          try {
            const session = await sessionsApi.get(currentSessionId);
            // Convert messages to ChatMessage format, filtering out tool-only messages
            const chatMessages = session.messages
              .filter((msg: { role: string }) => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
              .map((msg: { id: string; role: string; content: unknown; createdAt: Date }) => ({
                id: msg.id,
                role: msg.role as 'user' | 'assistant' | 'system',
                content: extractMessageContent(msg.content),
                createdAt: msg.createdAt,
              }))
              .filter((msg: { content: string }) => msg.content.trim() !== '');
            useChatStore.getState().setMessages(chatMessages);
          } catch (error) {
            console.error('Failed to reload session messages:', error);
          }
        } else {
          // Session no longer exists - reset and select first available
          useChatStore.getState().reset();
          if (loadedSessions.length > 0) {
            setSessionId(loadedSessions[0].id);
            useSessionStore.getState().setCurrentSessionId(loadedSessions[0].id);
          }
        }
      }
    };

    initializeSession();
  }, []); // Run once on mount

  // Conversation logs are now fetched via TanStack Query in the components

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Header - Fixed height */}
      <div className="flex-none border-b bg-card shadow-sm">
        <div className="p-4 flex items-center gap-3">
          {/* Session Sidebar Trigger */}
          <SessionSidebar />
          
          {/* Icon & Title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-none p-2 bg-primary/10 rounded-lg">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">CMS ReAct Agent</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Autonomous AI assistant for content management</p>
            </div>
          </div>

          {/* Preview Button */}
          <Button
            variant="outline"
            size="sm"
            className="flex-none gap-2"
            onClick={() => window.open('http://localhost:4000/pages/home?locale=en', '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Preview</span>
          </Button>
        </div>
      </div>

      {/* Main content - Flex-1 with constrained height */}
      <div className="flex-1 min-h-0 p-4">
        <ResizablePanelGroup
          direction="horizontal"
          className="h-full rounded-lg"
        >
          {/* Chat Pane - Default 65% width */}
          <ResizablePanel defaultSize={65} minSize={30}>
            <div className="h-full pr-2">
              <ChatPane />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Enhanced Debug Panel - Default 35% width */}
          <ResizablePanel defaultSize={35} minSize={20}>
            <div className="h-full pl-2">
              <EnhancedDebugPanel />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

    </div>
  );
}
