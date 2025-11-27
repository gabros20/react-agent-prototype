'use client';

import { useEffect } from 'react';
import { ChatPane } from './_components/chat-pane';
import { EnhancedDebugPanel } from './_components/enhanced-debug';
import { HITLModal } from './_components/hitl-modal';
import { SessionSidebar } from './_components/session-sidebar';
import { useSessionStore } from './_stores/session-store';
import { useChatStore } from './_stores/chat-store';
import { Bot } from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

export default function AssistantPage() {
  const { sessions, loadSessions, createSession } = useSessionStore();
  const { sessionId, setSessionId } = useChatStore();

  // Initialize session on mount
  useEffect(() => {
    const initializeSession = async () => {
      // Load sessions first
      await loadSessions();

      // If no current sessionId, create a default session
      if (!sessionId && sessions.length === 0) {
        try {
          const newSessionId = await createSession('New Session');
          setSessionId(newSessionId);
        } catch (error) {
          console.error('Failed to create initial session:', error);
        }
      }
    };

    initializeSession();
  }, []); // Run once on mount

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

      <HITLModal />
    </div>
  );
}
