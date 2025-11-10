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
    <div className="h-screen p-4 bg-background flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ReAct CMS Agent</h1>
          <p className="text-sm text-muted-foreground">AI-powered content management assistant</p>
        </div>
        <div className="w-96">
          <ModeSelector mode={mode} onModeChange={setMode} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        <div className="col-span-2">
          <DebugPane />
        </div>
        <div className="col-span-1">
          <ChatPane mode={mode} />
        </div>
      </div>

      <HITLModal />
    </div>
  );
}
