"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Terminal, Copy, Download, Trash2, Clock, Wrench, Layers, Coins, AlertCircle, Check } from "lucide-react";
import { useTraceStore, formatDuration, type TraceMetrics, type ConversationLog, type TraceEntry } from "../../_stores/trace-store";
import { useChatStore } from "../../_stores/chat-store";

interface TraceHeaderProps {
	className?: string;
}

export function TraceHeader({ className }: TraceHeaderProps) {
	const sessionId = useChatStore((state) => state.sessionId);

	// Use selectors to avoid subscribing to entire store
	const allTraceIds = useTraceStore((state) => state.allTraceIds);
	const activeTraceId = useTraceStore((state) => state.activeTraceId);
	const setActiveTrace = useTraceStore((state) => state.setActiveTrace);
	const clearAllTraces = useTraceStore((state) => state.clearAllTraces);
	const exportTrace = useTraceStore((state) => state.exportTrace);
	const copyAllLogs = useTraceStore((state) => state.copyAllLogs);
	const liveConversations = useTraceStore((state) => state.conversationLogs);
	const clearedAt = useTraceStore((state) => state.clearedAt);

	const [copied, setCopied] = useState(false);
	const [exported, setExported] = useState(false);
	const [persistedLogs, setPersistedLogs] = useState<ConversationLog[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

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
				const response = await fetch(`/api/sessions/${sessionId}/logs`);
				if (response.ok) {
					const data = await response.json();
					if (data.data && Array.isArray(data.data)) {
						const logs: ConversationLog[] = data.data.map((log: any) => ({
							id: log.id,
							sessionId: log.sessionId,
							conversationIndex: log.conversationIndex,
							userPrompt: log.userPrompt,
							startedAt: new Date(log.startedAt),
							completedAt: log.completedAt ? new Date(log.completedAt) : null,
							metrics: log.metrics,
							modelInfo: log.modelInfo,
							entries: (log.entries || []) as TraceEntry[],
							isLive: false,
						}));
						setPersistedLogs(logs);
					} else {
						setPersistedLogs([]);
					}
				}
			} catch (error) {
				console.error("Failed to fetch logs for header:", error);
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

	const handleCopyAll = async () => {
		await copyAllLogs();
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleExport = () => {
		if (!activeTraceId) return;

		const json = exportTrace(activeTraceId);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = `trace-${activeTraceId.slice(0, 8)}-${Date.now()}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		setExported(true);
		setTimeout(() => setExported(false), 2000);
	};

	const handleClearAllLogs = async () => {
		if (!sessionId) return;

		setIsDeleting(true);
		try {
			// Delete from database
			const response = await fetch(`/api/sessions/${sessionId}/logs`, {
				method: "DELETE",
			});

			if (response.ok) {
				// Clear in-memory state
				clearAllTraces();
				// Clear local persisted logs
				setPersistedLogs([]);
			} else {
				console.error("Failed to delete logs from server");
			}
		} catch (error) {
			console.error("Failed to delete logs:", error);
		} finally {
			setIsDeleting(false);
		}
	};

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

				<div className='flex items-center gap-2'>
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

					{/* Copy all logs */}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant='outline' size='sm' onClick={handleCopyAll} disabled={totalEventCount === 0}>
									{copied ? <Check className='h-4 w-4 mr-1' /> : <Copy className='h-4 w-4 mr-1' />}
									<span className='hidden sm:inline'>Copy All</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Copy all logs to clipboard</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					{/* Export JSON */}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant='outline' size='sm' onClick={handleExport} disabled={!activeTraceId || totalEventCount === 0}>
									{exported ? <Check className='h-4 w-4 mr-1' /> : <Download className='h-4 w-4 mr-1' />}
									<span className='hidden sm:inline'>Export</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Export trace as JSON</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					{/* Clear all logs */}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant='ghost' size='icon' className='h-8 w-8' onClick={handleClearAllLogs} disabled={totalEventCount === 0 || isDeleting}>
									<Trash2 className='h-4 w-4' />
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Delete all logs</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
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
