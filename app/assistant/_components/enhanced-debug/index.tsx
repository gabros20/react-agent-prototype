'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronDown, Brain } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TraceHeader } from './trace-header';
import { TraceFilters } from './trace-filters';
import { TraceTimeline } from './trace-timeline';
import { TraceDetailModal } from './trace-detail-modal';
import { WorkingMemoryPanel } from './working-memory-panel';
import { ConversationAccordion } from './conversation-accordion';

interface EnhancedDebugPanelProps {
  className?: string;
}

export function EnhancedDebugPanel({ className }: EnhancedDebugPanelProps) {
  const [showWorkingMemory, setShowWorkingMemory] = useState(false);

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

      {/* Filters */}
      <div className="flex-none p-3 border-b">
        <TraceFilters compact />
      </div>

      {/* Working Memory (collapsible) */}
      <Collapsible open={showWorkingMemory} onOpenChange={setShowWorkingMemory}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between px-3 py-2 h-auto rounded-none border-b hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Working Memory</span>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                showWorkingMemory && 'rotate-180'
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-b p-3 max-h-48 overflow-y-auto">
            <WorkingMemoryPanel />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Timeline - now grouped by conversation */}
      <ScrollArea className="flex-1 min-h-0">
        <ConversationAccordion className="h-full" />
      </ScrollArea>

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
