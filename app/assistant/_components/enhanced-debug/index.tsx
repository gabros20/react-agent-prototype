'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TraceHeader } from './trace-header';
import { TraceFilters } from './trace-filters';
import { TraceDetailModal } from './trace-detail-modal';
import { WorkingMemoryPanel } from './working-memory-panel';
import { ConversationAccordion } from './conversation-accordion';
import { ChatHistoryPanel } from './chat-history-panel';
import { FileText, Brain, MessageSquare } from 'lucide-react';

interface EnhancedDebugPanelProps {
  className?: string;
}

export function EnhancedDebugPanel({ className }: EnhancedDebugPanelProps) {
  const [activeTab, setActiveTab] = useState('logs');

  return (
    <div
      className={cn(
        'flex flex-col h-full border rounded-lg bg-card overflow-hidden shadow-sm',
        className
      )}
    >
      {/* Header with metrics and actions */}
      <div className="flex-none p-3 sm:p-4 border-b bg-muted/30">
        <TraceHeader />
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        {/* Tab List */}
        <div className="flex-none px-3 pt-3 pb-1 border-b">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="logs" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
            <TabsTrigger value="working-memory" className="gap-1.5 text-xs">
              <Brain className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Working Memory</span>
            </TabsTrigger>
            <TabsTrigger value="chat-history" className="gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Chat History</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content - Logs */}
        <TabsContent value="logs" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          {/* Filters - only show for logs tab */}
          <div className="flex-none p-3 border-b">
            <TraceFilters compact />
          </div>

          {/* Timeline - grouped by conversation */}
          <ScrollArea className="flex-1 min-h-0">
            <ConversationAccordion className="h-full" />
          </ScrollArea>
        </TabsContent>

        {/* Tab Content - Working Memory */}
        <TabsContent value="working-memory" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
          <ScrollArea className="h-full">
            <div className="p-3">
              <WorkingMemoryPanel />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Tab Content - Chat History */}
        <TabsContent value="chat-history" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
          <ChatHistoryPanel className="h-full" />
        </TabsContent>
      </Tabs>

      {/* Modal for full view */}
      <TraceDetailModal />
    </div>
  );
}

// Re-export components for individual use
export { TraceHeader } from './trace-header';
export { TraceFilters } from './trace-filters';
export { TraceTimeline } from './trace-timeline';
export { TraceDetailModal } from './trace-detail-modal';
export { TimelineEntry, TimelineEntryCompact } from './timeline-entry';
export { JsonViewer, CollapsibleJson } from './json-viewer';
export { WorkingMemoryPanel } from './working-memory-panel';
export { ConversationAccordion } from './conversation-accordion';
export { ChatHistoryPanel } from './chat-history-panel';
