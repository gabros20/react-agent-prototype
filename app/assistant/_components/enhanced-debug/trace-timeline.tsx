'use client';

import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { type TraceEntry, useTraceStore } from '../../_stores/trace-store';
import { TimelineEntry } from './timeline-entry';

interface TraceTimelineProps {
  className?: string;
}

// Map to associate tool results with their tool calls
interface ToolCallInfo {
  toolName: string;
  toolCallId: string;
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

  // Build maps for tool call relationships
  const { completedToolCallIds, toolCallInfoMap } = useMemo(() => {
    const resultIds = new Set<string>();
    const infoMap = new Map<string, ToolCallInfo>();

    // First pass: collect all tool calls
    for (const e of entries) {
      if (e.type === 'tool-call' && e.toolCallId) {
        infoMap.set(e.toolCallId, {
          toolName: e.toolName || 'unknown',
          toolCallId: e.toolCallId,
        });
      }
    }

    // Second pass: mark completed tool calls
    for (const e of entries) {
      if ((e.type === 'tool-result' || e.type === 'tool-error' || e.type === 'confirmation-required') && e.toolCallId) {
        resultIds.add(e.toolCallId);
      }
    }

    return { completedToolCallIds: resultIds, toolCallInfoMap: infoMap };
  }, [entries]);

  // Get tool call info for a result entry
  const getToolCallInfoForEntry = (entry: TraceEntry): ToolCallInfo | undefined => {
    if (!entry.toolCallId) return undefined;
    return toolCallInfoMap.get(entry.toolCallId);
  };

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
        {entries.map((entry) => {
          const toolCallInfo = getToolCallInfoForEntry(entry);
          return (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              isSelected={entry.id === selectedEntryId}
              isTraceComplete={isTraceComplete}
              hasMatchingResult={entry.toolCallId ? completedToolCallIds.has(entry.toolCallId) : false}
              linkedToolName={toolCallInfo?.toolName}
              onSelect={() => setSelectedEntry(entry.id)}
              onOpenModal={() => openModal(entry)}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}
