'use client';

import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTraceStore } from '../../_stores/trace-store';
import { TimelineEntry } from './timeline-entry';

interface TraceTimelineProps {
  className?: string;
}

export function TraceTimeline({ className }: TraceTimelineProps) {
  const {
    getFilteredEntries,
    selectedEntryId,
    setSelectedEntry,
    openModal,
  } = useTraceStore();

  const entries = getFilteredEntries();

  // Check if trace is complete (has a trace-complete entry)
  const isTraceComplete = useMemo(
    () => entries.some((e) => e.type === 'trace-complete'),
    [entries]
  );

  if (entries.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center text-muted-foreground">
          <p className="text-sm font-medium">No trace entries</p>
          <p className="text-xs mt-1">
            Events will appear here during agent execution
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="space-y-2 p-1">
        {entries.map((entry) => (
          <TimelineEntry
            key={entry.id}
            entry={entry}
            isSelected={entry.id === selectedEntryId}
            isTraceComplete={isTraceComplete}
            onSelect={() => setSelectedEntry(entry.id)}
            onOpenModal={() => openModal(entry)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
