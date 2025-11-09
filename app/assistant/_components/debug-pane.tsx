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
};

export function DebugPane() {
  const { logs, filterType, setFilterType, clearLogs } = useLogStore();

  const filteredLogs = filterType === 'all' ? logs : logs.filter((log) => log.type === filterType);

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Debug Log</h2>
          <p className="text-sm text-muted-foreground">{filteredLogs.length} events</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as LogEntry['type'] | 'all')}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">All</option>
            <option value="tool-call">Tool Calls</option>
            <option value="tool-result">Results</option>
            <option value="step-complete">Steps</option>
            <option value="error">Errors</option>
            <option value="info">Info</option>
          </select>
          <Button variant="outline" size="sm" onClick={clearLogs}>
            Clear
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">No log entries yet</p>
            </div>
          ) : (
            filteredLogs.map((log) => <LogEntryItem key={log.id} log={log} />)
          )}
        </div>
      </ScrollArea>
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
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg p-3">
      <div className="flex items-start gap-2">
        <Badge className={LOG_TYPE_COLORS[log.type]} variant="secondary">
          {log.type}
        </Badge>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {log.toolName && <span className="font-mono text-sm">{log.toolName}</span>}
            <span className="text-xs text-muted-foreground">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
          </div>
          {log.message && <p className="text-sm text-muted-foreground mt-1">{log.message}</p>}
        </div>
        {(log.input || log.output) ? (
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        ) : null}
      </div>

      <CollapsibleContent className="mt-2">
        {log.input ? (
          <div className="mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Input:</p>
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
              {formatJson(log.input)}
            </pre>
          </div>
        ) : null}
        {log.output ? (
          <div className="mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Output:</p>
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
              {formatJson(log.output)}
            </pre>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
