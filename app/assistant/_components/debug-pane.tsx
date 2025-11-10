'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLogStore, type LogEntry } from '../_stores/log-store';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const LOG_TYPE_COLORS: Record<LogEntry['type'], string> = {
  'tool-call': 'bg-blue-500',
  'tool-result': 'bg-green-500',
  'step-complete': 'bg-purple-500',
  error: 'bg-red-500',
  info: 'bg-gray-500',
  system: 'bg-yellow-500',
};

export function DebugPane() {
  const { logs, filterType, setFilterType, clearLogs } = useLogStore();

  const filteredLogs = filterType === 'all' ? logs : logs.filter((log) => log.type === filterType);

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-none p-3 sm:p-4 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold">Debug Log</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">{filteredLogs.length} events</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as LogEntry['type'] | 'all')}
              className="text-xs sm:text-sm border rounded px-2 py-1 bg-background"
            >
              <option value="all">All</option>
              <option value="tool-call">Tool Calls</option>
              <option value="tool-result">Results</option>
              <option value="step-complete">Steps</option>
              <option value="error">Errors</option>
              <option value="info">Info</option>
              <option value="system">System</option>
            </select>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content - Flex-1 with proper overflow */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3 sm:p-4 space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="text-center">
                  <p className="text-sm">No log entries yet</p>
                  <p className="text-xs mt-1">Logs will appear here during agent execution</p>
                </div>
              </div>
            ) : (
              filteredLogs.map((log) => <LogEntryItem key={log.id} log={log} />)
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function LogEntryItem({ log }: { log: LogEntry }) {
  const [isOpen, setIsOpen] = useState(false);

  const formatJson = (data: unknown): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg bg-card/50 hover:bg-card transition-colors">
      <CollapsibleTrigger asChild disabled={!(log.input || log.output)}>
        <div className={`flex items-start gap-2 p-2 sm:p-3 ${(log.input || log.output) ? 'cursor-pointer' : ''}`}>
          <Badge className={`${LOG_TYPE_COLORS[log.type]} flex-shrink-0 text-[10px] sm:text-xs`} variant="secondary">
            {log.type}
          </Badge>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              {log.toolName && (
                <span className="font-mono text-xs sm:text-sm truncate">{log.toolName}</span>
              )}
              <span className="text-[10px] sm:text-xs text-muted-foreground flex-shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
            {log.message && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">{log.message}</p>
            )}
          </div>
          {(log.input || log.output) && (
            <ChevronDown className={`h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-2 sm:px-3 pb-2 sm:pb-3">
        {log.input ? (
          <div className="mt-2">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1">Input:</p>
            <pre className="text-[10px] sm:text-xs bg-muted p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
              {formatJson(log.input)}
            </pre>
          </div>
        ) : null}
        {log.output ? (
          <div className="mt-2">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1">Output:</p>
            <pre className="text-[10px] sm:text-xs bg-muted p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
              {formatJson(log.output)}
            </pre>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
