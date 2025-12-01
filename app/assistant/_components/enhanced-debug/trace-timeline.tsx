'use client';

import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTraceStore, type TraceEntry } from '../../_stores/trace-store';
import { TimelineEntry } from './timeline-entry';

interface TraceTimelineProps {
  className?: string;
}

// Entry types that should be indented when inside a step
const STEP_CHILD_TYPES = new Set([
  'tool-call',
  'text-streaming',
]);

// Group entries into step blocks for rendering with connecting lines
type TimelineItem =
  | { type: 'entry'; entry: TraceEntry }
  | { type: 'step-group'; stepStart: TraceEntry; children: TraceEntry[]; stepEnd: TraceEntry | null };

function groupEntriesIntoSteps(entries: TraceEntry[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let i = 0;

  while (i < entries.length) {
    const entry = entries[i];

    if (entry.type === 'step-start') {
      // Start collecting a step group
      const stepStart = entry;
      const children: TraceEntry[] = [];
      let stepEnd: TraceEntry | null = null;
      i++;

      // Collect children until we hit step-complete
      while (i < entries.length) {
        const current = entries[i];
        if (current.type === 'step-complete' && current.stepNumber === stepStart.stepNumber) {
          stepEnd = current;
          i++;
          break;
        } else if (current.type === 'step-start') {
          // Nested step or new step without completing previous - break
          break;
        } else if (STEP_CHILD_TYPES.has(current.type)) {
          children.push(current);
          i++;
        } else {
          // Non-step-child entry inside step - just include it
          children.push(current);
          i++;
        }
      }

      items.push({ type: 'step-group', stepStart, children, stepEnd });
    } else {
      // Regular entry outside of step
      items.push({ type: 'entry', entry });
      i++;
    }
  }

  return items;
}

export function TraceTimeline({ className }: TraceTimelineProps) {
  // Use selectors to avoid subscribing to entire store
  const getFilteredEntries = useTraceStore((state) => state.getFilteredEntries);
  const selectedEntryId = useTraceStore((state) => state.selectedEntryId);
  const setSelectedEntry = useTraceStore((state) => state.setSelectedEntry);
  const openModal = useTraceStore((state) => state.openModal);

  const entries = getFilteredEntries();

  // Check if trace is complete (has a trace-complete entry)
  const isTraceComplete = useMemo(
    () => entries.some((e) => e.type === 'trace-complete'),
    [entries]
  );

  // Group entries into step blocks
  const timelineItems = useMemo(
    () => groupEntriesIntoSteps(entries),
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
        {timelineItems.map((item) => {
          if (item.type === 'entry') {
            return (
              <TimelineEntry
                key={item.entry.id}
                entry={item.entry}
                isSelected={item.entry.id === selectedEntryId}
                isTraceComplete={isTraceComplete}
                onSelect={() => setSelectedEntry(item.entry.id)}
                onOpenModal={() => openModal(item.entry)}
              />
            );
          }

          // Step group with connecting line
          const { stepStart, children, stepEnd } = item;
          const hasChildren = children.length > 0;

          return (
            <div key={stepStart.id} className="relative">
              {/* Step start */}
              <TimelineEntry
                entry={stepStart}
                isSelected={stepStart.id === selectedEntryId}
                isTraceComplete={isTraceComplete}
                onSelect={() => setSelectedEntry(stepStart.id)}
                onOpenModal={() => openModal(stepStart)}
              />

              {/* Children with connecting line */}
              {hasChildren && (
                <div className="relative ml-3 pl-4 border-l-2 border-blue-400/50">
                  <div className="space-y-2 py-2">
                    {children.map((child) => (
                      <TimelineEntry
                        key={child.id}
                        entry={child}
                        isSelected={child.id === selectedEntryId}
                        isTraceComplete={isTraceComplete}
                        onSelect={() => setSelectedEntry(child.id)}
                        onOpenModal={() => openModal(child)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Step end */}
              {stepEnd && (
                <TimelineEntry
                  entry={stepEnd}
                  isSelected={stepEnd.id === selectedEntryId}
                  isTraceComplete={isTraceComplete}
                  onSelect={() => setSelectedEntry(stepEnd.id)}
                  onOpenModal={() => openModal(stepEnd)}
                />
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
