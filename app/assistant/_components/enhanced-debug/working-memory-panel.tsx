'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Brain, Database, FileText, Image, Layers, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTraceStore } from '../../_stores/trace-store';

interface WorkingMemoryEntity {
  type: string;
  id: string;
  name: string;
  slug?: string;
  timestamp: number;
}

const ENTITY_TYPE_ICONS: Record<string, LucideIcon> = {
  page: FileText,
  section: Layers,
  collection: Database,
  media: Image,
  entry: Tag,
  task: Brain,
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  page: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  section: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  collection: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  media: 'bg-green-500/10 text-green-600 border-green-500/30',
  entry: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
  task: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
};

interface WorkingMemoryPanelProps {
  className?: string;
}

export function WorkingMemoryPanel({ className }: WorkingMemoryPanelProps) {
  const { entriesByTrace, activeTraceId } = useTraceStore();

  // Extract entities from working-memory-update trace entries
  const entities = useMemo(() => {
    if (!activeTraceId) return [];

    const entries = entriesByTrace.get(activeTraceId) || [];
    const entityMap = new Map<string, WorkingMemoryEntity>();

    // Find all working-memory-update entries and extract entities
    for (const entry of entries) {
      if (entry.type === 'working-memory-update' && entry.input) {
        const metadata = entry.input as {
          entities?: string[];
          entityCount?: number;
          workingMemorySize?: number;
        };

        // Parse entities from the string format "type:name"
        if (metadata.entities) {
          for (const entityStr of metadata.entities) {
            const [type, name] = entityStr.split(':');
            if (type && name) {
              // Use type:name as key to dedupe
              const key = entityStr;
              entityMap.set(key, {
                type,
                id: key,
                name,
                timestamp: entry.timestamp,
              });
            }
          }
        }
      }
    }

    // Sort by timestamp (most recent first)
    return Array.from(entityMap.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [entriesByTrace, activeTraceId]);

  // Group entities by type
  const groupedEntities = useMemo(() => {
    const groups: Record<string, WorkingMemoryEntity[]> = {};
    for (const entity of entities) {
      if (!groups[entity.type]) {
        groups[entity.type] = [];
      }
      groups[entity.type].push(entity);
    }
    return groups;
  }, [entities]);

  if (entities.length === 0) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground', className)}>
        <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No entities in working memory</p>
        <p className="text-xs mt-1">Entities will appear as the agent discovers them</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Summary */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Working Memory</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {entities.length} {entities.length === 1 ? 'entity' : 'entities'}
        </Badge>
      </div>

      {/* Entity groups */}
      <div className="space-y-2">
        {Object.entries(groupedEntities).map(([type, typeEntities]) => {
          const Icon = ENTITY_TYPE_ICONS[type] || Tag;
          const colorClass = ENTITY_TYPE_COLORS[type] || 'bg-gray-500/10 text-gray-600 border-gray-500/30';

          return (
            <div key={type} className="space-y-1">
              <div className="flex items-center gap-1.5 px-1">
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {type}s ({typeEntities.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {typeEntities.map((entity) => (
                  <Badge
                    key={entity.id}
                    variant="outline"
                    className={cn('text-xs font-normal border', colorClass)}
                    title={`ID: ${entity.id}\nLast accessed: ${new Date(entity.timestamp).toLocaleTimeString()}`}
                  >
                    {entity.name}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Help text */}
      <p className="text-[10px] text-muted-foreground px-1">
        Entities extracted from tool results. Most recent updates shown first.
      </p>
    </div>
  );
}
