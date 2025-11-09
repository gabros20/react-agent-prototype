'use client';

import { ChatPane } from './_components/chat-pane';
import { DebugPane } from './_components/debug-pane';
import { HITLModal } from './_components/hitl-modal';

export default function AssistantPage() {
  return (
    <div className="h-screen p-4 bg-background">
      <div className="grid grid-cols-3 gap-4 h-full">
        <div className="col-span-2">
          <DebugPane />
        </div>
        <div className="col-span-1">
          <ChatPane />
        </div>
      </div>
      <HITLModal />
    </div>
  );
}
