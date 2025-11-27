'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Search, X, Filter } from 'lucide-react';
import {
  useTraceStore,
  type TraceEntryType,
  type TraceLevel,
  ENTRY_TYPE_COLORS,
  ENTRY_TYPE_LABELS,
} from '../../_stores/trace-store';

// Group entry types for better UX
const TYPE_GROUPS = {
  'LLM': ['system-prompt', 'prompt-sent', 'llm-response'] as TraceEntryType[],
  'Tools': ['tool-call', 'tool-result', 'tool-error', 'confirmation-required'] as TraceEntryType[],
  'Flow': ['trace-start', 'step-complete', 'trace-complete'] as TraceEntryType[],
  'Memory': ['working-memory-update', 'memory-trimmed', 'session-loaded', 'checkpoint-saved'] as TraceEntryType[],
  'Approval': ['approval-request', 'approval-response'] as TraceEntryType[],
  'Jobs': ['job-queued', 'job-progress', 'job-complete', 'job-failed'] as TraceEntryType[],
  'System': ['system-log', 'retry-attempt', 'error'] as TraceEntryType[],
};

const LEVEL_COLORS: Record<TraceLevel, string> = {
  debug: 'bg-gray-400',
  info: 'bg-blue-400',
  warn: 'bg-yellow-500',
  error: 'bg-red-500',
};

interface TraceFiltersProps {
  className?: string;
  compact?: boolean;
}

export function TraceFilters({ className, compact = false }: TraceFiltersProps) {
  const { filters, setFilters } = useTraceStore();

  const toggleType = (type: TraceEntryType) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    setFilters({ types: newTypes });
  };

  const toggleLevel = (level: TraceLevel) => {
    const newLevels = filters.levels.includes(level)
      ? filters.levels.filter((l) => l !== level)
      : [...filters.levels, level];
    setFilters({ levels: newLevels });
  };

  const clearFilters = () => {
    setFilters({
      types: [],
      levels: [],
      searchQuery: '',
    });
  };

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.levels.length > 0 ||
    filters.searchQuery.length > 0;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 flex-wrap', className)}>
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={filters.searchQuery}
            onChange={(e) => setFilters({ searchQuery: e.target.value })}
            className="pl-8 h-8 text-sm"
          />
          {filters.searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setFilters({ searchQuery: '' })}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Quick type filters */}
        <div className="flex items-center gap-1">
          {(['tool-call', 'tool-result', 'error'] as TraceEntryType[]).map((type) => (
            <Badge
              key={type}
              variant={filters.types.includes(type) ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer text-xs',
                filters.types.includes(type) && ENTRY_TYPE_COLORS[type]
              )}
              onClick={() => toggleType(type)}
            >
              {ENTRY_TYPE_LABELS[type]}
            </Badge>
          ))}
        </div>

        {/* Job events toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="show-jobs-compact"
            checked={filters.showJobEvents}
            onCheckedChange={(checked) => setFilters({ showJobEvents: checked })}
            className="h-4 w-7"
          />
          <Label htmlFor="show-jobs-compact" className="text-xs text-muted-foreground">
            Jobs
          </Label>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2">
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search in logs..."
          value={filters.searchQuery}
          onChange={(e) => setFilters({ searchQuery: e.target.value })}
          className="pl-9"
        />
        {filters.searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setFilters({ searchQuery: '' })}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Type filters by group */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter by Type
          </h4>
          {filters.types.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({ types: [] })}
              className="h-6 text-xs"
            >
              Clear types
            </Button>
          )}
        </div>

        {Object.entries(TYPE_GROUPS).map(([group, types]) => (
          <div key={group} className="space-y-1.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              {group}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {types.map((type) => (
                <Badge
                  key={type}
                  variant={filters.types.includes(type) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-colors text-xs',
                    filters.types.includes(type)
                      ? cn(ENTRY_TYPE_COLORS[type], 'text-white')
                      : 'hover:bg-accent'
                  )}
                  onClick={() => toggleType(type)}
                >
                  {ENTRY_TYPE_LABELS[type]}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Level filters */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Filter by Level</h4>
        <div className="flex flex-wrap gap-1.5">
          {(['debug', 'info', 'warn', 'error'] as TraceLevel[]).map((level) => (
            <Badge
              key={level}
              variant={filters.levels.includes(level) ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-colors capitalize text-xs',
                filters.levels.includes(level)
                  ? cn(LEVEL_COLORS[level], 'text-white')
                  : 'hover:bg-accent'
              )}
              onClick={() => toggleLevel(level)}
            >
              {level}
            </Badge>
          ))}
        </div>
      </div>

      {/* Job events toggle */}
      <div className="flex items-center justify-between py-2 border-t">
        <div className="space-y-0.5">
          <Label htmlFor="show-jobs" className="text-sm font-medium">
            Show Job Events
          </Label>
          <p className="text-xs text-muted-foreground">
            Display background processing events
          </p>
        </div>
        <Switch
          id="show-jobs"
          checked={filters.showJobEvents}
          onCheckedChange={(checked) => setFilters({ showJobEvents: checked })}
        />
      </div>

      {/* Clear all filters */}
      {hasActiveFilters && (
        <Button variant="outline" onClick={clearFilters} className="w-full">
          <X className="h-4 w-4 mr-2" />
          Clear All Filters
        </Button>
      )}
    </div>
  );
}
