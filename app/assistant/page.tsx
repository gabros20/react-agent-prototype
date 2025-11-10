'use client';

import { useState } from 'react';
import { ChatPane } from './_components/chat-pane';
import { DebugPane } from './_components/debug-pane';
import { HITLModal } from './_components/hitl-modal';
import { ModeSelector } from './_components/mode-selector';
import type { AgentMode } from './_hooks/use-agent';

export default function AssistantPage() {
  const [mode, setMode] = useState<AgentMode>('cms-crud');

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Header - Fixed height */}
      <div className="flex-none border-b bg-card">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">ReAct CMS Agent</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">AI-powered content management assistant</p>
          </div>
          <div className="flex-none w-full sm:w-auto sm:max-w-md">
            <ModeSelector mode={mode} onModeChange={setMode} />
          </div>
        </div>
      </div>

      {/* Main content - Flex-1 with constrained height */}
      <div className="flex-1 min-h-0 p-4">
        <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Debug Pane - 2/3 width on large screens */}
          <div className="lg:col-span-2 h-full min-h-0">
            <DebugPane />
          </div>
          
          {/* Chat Pane - 1/3 width on large screens */}
          <div className="lg:col-span-1 h-full min-h-0">
            <ChatPane mode={mode} />
          </div>
        </div>
      </div>

      <HITLModal />
    </div>
  );
}
