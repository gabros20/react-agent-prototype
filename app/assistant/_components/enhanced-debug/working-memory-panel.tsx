'use client';

import { useMemo, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Brain, Database, FileText, Image, Layers, Tag, Wrench, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTraceStore } from '../../_stores/trace-store';
import { useChatStore } from '../../_stores/chat-store';
import { sessionsApi } from '@/lib/api';

const ENTITY_TYPE_ICONS: Record<string, LucideIcon> = {
  page: FileText,
  section: Layers,
  collection: Database,
  media: Image,
  entry: Tag,
  post: FileText,
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  page: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  section: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  collection: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  media: 'bg-green-500/10 text-green-600 border-green-500/30',
  entry: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
  post: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
};

interface WorkingMemoryPanelProps {
  className?: string;
}

export function WorkingMemoryPanel({ className }: WorkingMemoryPanelProps) {
  const entities = useTraceStore((state) => state.persistedWorkingMemory);
  const discoveredTools = useTraceStore((state) => state.persistedDiscoveredTools);
  const usedTools = useTraceStore((state) => state.persistedUsedTools);
  const loadEntities = useTraceStore((state) => state.loadPersistedWorkingMemory);
  const loadTools = useTraceStore((state) => state.loadPersistedTools);
  const sessionId = useChatStore((state) => state.sessionId);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const prevStreamingRef = useRef(isStreaming);

  // Fetch working memory from API
  const fetchWorkingMemory = async () => {
    if (!sessionId) return;
    try {
      const data = await sessionsApi.getWorkingMemory(sessionId);
      if (data?.entities) loadEntities(data.entities);
      if (data?.discoveredTools || data?.usedTools) {
        loadTools(data.discoveredTools || [], data.usedTools || []);
      }
    } catch (e) {
      console.error('Failed to fetch working memory:', e);
    }
  };

  // Fetch on session change
  useEffect(() => {
    fetchWorkingMemory();
  }, [sessionId]);

  // Refetch when streaming ends (agent completed, new entities may have been added)
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      fetchWorkingMemory();
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Group entities by type
  const grouped = useMemo(() => {
    const groups: Record<string, typeof entities> = {};
    for (const e of entities) {
      (groups[e.type] ??= []).push(e);
    }
    return groups;
  }, [entities]);

  const hasContent = entities.length > 0 || discoveredTools.length > 0;

  if (!hasContent) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground', className)}>
        <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No entities in working memory</p>
        <p className="text-xs mt-1">Entities appear as the agent discovers them</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Working Memory</span>
        </div>
        <div className="flex gap-1">
          {entities.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {entities.length} {entities.length === 1 ? 'entity' : 'entities'}
            </Badge>
          )}
          {discoveredTools.length > 0 && (
            <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600">
              {discoveredTools.length} tools
            </Badge>
          )}
        </div>
      </div>

      {/* Discovered Tools Section */}
      {discoveredTools.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 px-1">
            <Search className="h-3 w-3 text-purple-500" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Discovered Tools ({discoveredTools.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {discoveredTools.map((tool) => {
              const usage = usedTools.find((u) => u.name === tool);
              const isUsed = !!usage;
              return (
                <Badge
                  key={tool}
                  variant="outline"
                  className={cn(
                    'text-xs font-normal border',
                    isUsed
                      ? 'bg-purple-500/10 text-purple-600 border-purple-500/30'
                      : 'bg-gray-500/10 text-gray-500 border-gray-500/30'
                  )}
                  title={usage ? `Used ${usage.count}x, last: ${usage.lastResult}` : 'Not used yet'}
                >
                  <Wrench className="h-2.5 w-2.5 mr-1" />
                  {tool.replace(/^(cms_|pexels_|image_|web_|site_|navigation_)/, '')}
                  {usage && <span className="ml-1 opacity-60">×{usage.count}</span>}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Entities Section */}
      {entities.length > 0 && (
        <div className="space-y-2">
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = ENTITY_TYPE_ICONS[type] || Tag;
            const color = ENTITY_TYPE_COLORS[type] || 'bg-gray-500/10 text-gray-600 border-gray-500/30';

            return (
              <div key={type} className="space-y-1">
                <div className="flex items-center gap-1.5 px-1">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {type}s ({items.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((entity) => (
                    <Badge
                      key={entity.id}
                      variant="outline"
                      className={cn('text-xs font-normal border', color)}
                      title={entity.id}
                    >
                      {entity.name}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
