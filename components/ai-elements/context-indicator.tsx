"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Shrink, Loader2, AlertTriangle, Check } from "lucide-react";
import { sessionsApi, type ContextStats, type CompactionResult } from "@/lib/api/sessions";

interface ContextIndicatorProps {
  sessionId: string | null;
  modelId?: string;
  disabled?: boolean;
  onCompactionComplete?: (result: CompactionResult) => void;
  className?: string;
}

/**
 * Context Usage Indicator with Compaction Button
 *
 * Shows:
 * - Context usage percentage as a progress bar
 * - Warning colors when approaching limit
 * - Manual compaction button
 */
export function ContextIndicator({
  sessionId,
  modelId,
  disabled = false,
  onCompactionComplete,
  className,
}: ContextIndicatorProps) {
  const [stats, setStats] = useState<ContextStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);
  const [compactionResult, setCompactionResult] = useState<CompactionResult | null>(null);

  // Fetch context stats
  const fetchStats = useCallback(async () => {
    if (!sessionId) {
      setStats(null);
      return;
    }

    setIsLoading(true);
    try {
      const data = await sessionsApi.getContextStats(sessionId, modelId);
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch context stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, modelId]);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Handle compaction
  const handleCompact = async () => {
    if (!sessionId || isCompacting || disabled) return;

    setIsCompacting(true);
    setCompactionResult(null);

    try {
      const result = await sessionsApi.compactContext(sessionId, {
        modelId,
        force: true, // Force compaction even if not at limit
      });
      setCompactionResult(result);
      onCompactionComplete?.(result);

      // Refresh stats after compaction
      await fetchStats();

      // Clear result after 3 seconds
      setTimeout(() => setCompactionResult(null), 3000);
    } catch (error) {
      console.error("Compaction failed:", error);
    } finally {
      setIsCompacting(false);
    }
  };

  // Format token count for display
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
    return tokens.toString();
  };

  // Get color based on usage
  const getUsageColor = (percent: number) => {
    if (percent >= 95) return "bg-red-500";
    if (percent >= 80) return "bg-amber-500";
    if (percent >= 60) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  if (!sessionId) return null;

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        {/* Context usage bar */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 min-w-[100px]">
              {/* Progress bar */}
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                {stats ? (
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      getUsageColor(stats.usagePercent)
                    )}
                    style={{ width: `${Math.min(stats.usagePercent, 100)}%` }}
                  />
                ) : (
                  <div className="h-full w-0" />
                )}
              </div>
              {/* Percentage */}
              <span
                className={cn(
                  "text-[10px] font-mono tabular-nums min-w-[32px] text-right",
                  stats?.isOverLimit && "text-red-500 font-medium",
                  stats?.isApproachingLimit && !stats?.isOverLimit && "text-amber-500"
                )}
              >
                {isLoading ? "..." : stats ? `${stats.usagePercent}%` : "—"}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {stats ? (
              <div className="space-y-1">
                <div className="font-medium">Context Usage</div>
                <div>
                  {formatTokens(stats.currentTokens)} / {formatTokens(stats.availableTokens)} tokens
                </div>
                <div className="text-muted-foreground">
                  {stats.messageCount} messages • {stats.compactedResults} pruned results
                </div>
                {stats.isApproachingLimit && (
                  <div className="text-amber-500 flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3" />
                    Approaching context limit
                  </div>
                )}
              </div>
            ) : (
              "Loading context stats..."
            )}
          </TooltipContent>
        </Tooltip>

        {/* Compaction button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 w-6 p-0",
                compactionResult?.compacted && "text-emerald-500"
              )}
              onClick={handleCompact}
              disabled={disabled || isCompacting || !stats || stats.messageCount === 0}
            >
              {isCompacting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : compactionResult?.compacted ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Shrink className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {isCompacting ? (
              "Compacting context..."
            ) : compactionResult ? (
              compactionResult.compacted ? (
                <div className="space-y-1">
                  <div className="font-medium text-emerald-500">Compacted!</div>
                  <div>
                    {formatTokens(compactionResult.tokensBefore || 0)} →{" "}
                    {formatTokens(compactionResult.tokensAfter || 0)}
                  </div>
                  <div className="text-muted-foreground">
                    {compactionResult.compressionRatio}% saved
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  {compactionResult.reason || "No compaction needed"}
                </div>
              )
            ) : (
              <div className="space-y-1">
                <div className="font-medium">Compact Context</div>
                <div className="text-muted-foreground">
                  Prune old tool outputs and summarize history
                </div>
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
