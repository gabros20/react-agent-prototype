"use client";

import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Terminal, Clock, Wrench, Layers, Coins, AlertCircle } from "lucide-react";
import { useTraceStore, formatDuration, type TraceMetrics, type ConversationLog, type TraceEntry } from "../../_stores/trace-store";
import { useChatStore } from "../../_stores/chat-store";
import { sessionsApi } from "@/lib/api";

interface TraceHeaderProps {
	className?: string;
}

export function TraceHeader({ className }: TraceHeaderProps) {
	const sessionId = useChatStore((state) => state.sessionId);

	// Use selectors to avoid subscribing to entire store
	const allTraceIds = useTraceStore((state) => state.allTraceIds);
	const activeTraceId = useTraceStore((state) => state.activeTraceId);
	const setActiveTrace = useTraceStore((state) => state.setActiveTrace);
	const liveConversations = useTraceStore((state) => state.conversationLogs);
	const clearedAt = useTraceStore((state) => state.clearedAt);

	const [persistedLogs, setPersistedLogs] = useState<ConversationLog[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	// Clear persistedLogs when store signals logs were cleared
	useEffect(() => {
		if (clearedAt) {
			setPersistedLogs([]);
		}
	}, [clearedAt]);

	// Fetch logs when sessionId changes
	useEffect(() => {
		if (!sessionId) {
			setPersistedLogs([]);
			return;
		}

		const fetchLogs = async () => {
			setIsLoading(true);
			try {
				const rawLogs = await sessionsApi.getLogs(sessionId) as Array<Record<string, unknown>>;
				if (Array.isArray(rawLogs)) {
					const logs: ConversationLog[] = rawLogs.map((log) => ({
						id: log.id as string,
						sessionId: log.sessionId as string,
						conversationIndex: log.conversationIndex as number,
						userPrompt: log.userPrompt as string,
						startedAt: new Date(log.startedAt as string),
						completedAt: log.completedAt ? new Date(log.completedAt as string) : null,
						metrics: log.metrics as TraceMetrics | null,
						modelInfo: log.modelInfo as { modelId: string; pricing: { prompt: number; completion: number } | null } | null,
						entries: ((log.entries || []) as TraceEntry[]),
						isLive: false,
					}));
					setPersistedLogs(logs);
				} else {
					setPersistedLogs([]);
				}
			} catch (error) {
				console.error("Failed to fetch logs for header:", error);
				setPersistedLogs([]);
			} finally {
				setIsLoading(false);
			}
		};

		fetchLogs();
	}, [sessionId]);

	// Merge and calculate totals
	const { metrics, totalEventCount } = useMemo(() => {
		const liveIds = new Set(liveConversations.map((c) => c.id));
		const allLogs = [
			...persistedLogs.filter((log) => !liveIds.has(log.id)),
			...liveConversations,
		];

		const totals: TraceMetrics = {
			totalDuration: 0,
			toolCallCount: 0,
			stepCount: 0,
			tokens: { input: 0, output: 0 },
			cost: 0,
			errorCount: 0,
		};

		let eventCount = 0;
		for (const log of allLogs) {
			if (log.metrics) {
				totals.totalDuration += log.metrics.totalDuration || 0;
				totals.toolCallCount += log.metrics.toolCallCount || 0;
				totals.stepCount += log.metrics.stepCount || 0;
				totals.tokens.input += log.metrics.tokens?.input || 0;
				totals.tokens.output += log.metrics.tokens?.output || 0;
				totals.cost += log.metrics.cost || 0;
				totals.errorCount += log.metrics.errorCount || 0;
			}
			eventCount += log.entries?.length || 0;
		}

		return { metrics: totals, totalEventCount: eventCount };
	}, [persistedLogs, liveConversations]);

	return (
		<div className={cn("space-y-3", className)}>
			{/* Title and actions row */}
			<div className='flex items-center justify-between gap-3'>
				<div className='flex items-center gap-2'>
					<Terminal className='h-5 w-5 text-primary' />
					<h2 className='text-lg font-semibold'>Logs</h2>
					<Badge variant='secondary' className='text-xs'>
						{totalEventCount} events
					</Badge>
				</div>

				{/* Trace selector */}
				{allTraceIds.length > 1 && (
					<Select value={activeTraceId || ""} onValueChange={setActiveTrace}>
						<SelectTrigger className='w-[180px] h-8 text-xs'>
							<SelectValue placeholder='Select trace' />
						</SelectTrigger>
						<SelectContent>
							{allTraceIds.map((id) => (
								<SelectItem key={id} value={id} className='text-xs font-mono'>
									{id.slice(0, 8)}...
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
			</div>

			{/* Metrics row - show skeleton while loading, actual metrics when loaded */}
			{isLoading ? (
				<div className='flex items-center gap-4 text-xs animate-pulse'>
					<div className='flex items-center gap-1.5'>
						<div className='h-3.5 w-3.5 bg-muted rounded' />
						<div className='h-3 w-12 bg-muted rounded' />
					</div>
					<div className='flex items-center gap-1.5'>
						<div className='h-3.5 w-3.5 bg-muted rounded' />
						<div className='h-3 w-14 bg-muted rounded' />
					</div>
					<div className='flex items-center gap-1.5'>
						<div className='h-3.5 w-3.5 bg-muted rounded' />
						<div className='h-3 w-14 bg-muted rounded' />
					</div>
					<div className='flex items-center gap-1.5'>
						<div className='h-3.5 w-3.5 bg-muted rounded' />
						<div className='h-3 w-28 bg-muted rounded' />
					</div>
					<div className='flex items-center gap-1.5'>
						<div className='h-3 w-16 bg-muted rounded' />
					</div>
				</div>
			) : totalEventCount > 0 ? (
				<div className='flex items-center gap-4 text-xs text-muted-foreground'>
					{/* Duration */}
					<div className='flex items-center gap-1.5'>
						<Clock className='h-3.5 w-3.5' />
						<span>{formatDuration(metrics.totalDuration)}</span>
					</div>

					{/* Tool calls */}
					<div className='flex items-center gap-1.5'>
						<Wrench className='h-3.5 w-3.5' />
						<span>{metrics.toolCallCount} tools</span>
					</div>

					{/* Steps */}
					<div className='flex items-center gap-1.5'>
						<Layers className='h-3.5 w-3.5' />
						<span>{metrics.stepCount} steps</span>
					</div>

					{/* Tokens */}
					{(metrics.tokens.input > 0 || metrics.tokens.output > 0) && (
						<div className='flex items-center gap-1.5'>
							<Coins className='h-3.5 w-3.5' />
							<span>
								{metrics.tokens.input.toLocaleString()} in / {metrics.tokens.output.toLocaleString()} out
							</span>
						</div>
					)}

					{/* Cost */}
					{metrics.cost > 0 && (
						<div className='flex items-center gap-1.5 text-emerald-500 font-medium'>
							<span>$</span>
							<span>{metrics.cost < 0.01 ? metrics.cost.toFixed(6) : metrics.cost.toFixed(4)}</span>
						</div>
					)}

					{/* Errors */}
					{metrics.errorCount > 0 && (
						<div className='flex items-center gap-1.5 text-red-500'>
							<AlertCircle className='h-3.5 w-3.5' />
							<span>{metrics.errorCount} errors</span>
						</div>
					)}
				</div>
			) : null}
		</div>
	);
}
