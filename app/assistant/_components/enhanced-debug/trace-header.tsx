"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Terminal, Copy, Download, Trash2, Clock, Wrench, Layers, Coins, AlertCircle, Check } from "lucide-react";
import { useState } from "react";
import { useTraceStore, formatDuration } from "../../_stores/trace-store";

interface TraceHeaderProps {
	className?: string;
}

export function TraceHeader({ className }: TraceHeaderProps) {
	const { allTraceIds, activeTraceId, setActiveTrace, clearTrace, clearAllTraces, exportTrace, copyAllLogs, getMetrics, getFilteredEntries } =
		useTraceStore();

	const [copied, setCopied] = useState(false);
	const [exported, setExported] = useState(false);

	const metrics = getMetrics();
	const entries = getFilteredEntries();

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

	return (
		<div className={cn("space-y-3", className)}>
			{/* Title and actions row */}
			<div className='flex items-center justify-between gap-3'>
				<div className='flex items-center gap-2'>
					<Terminal className='h-5 w-5 text-primary' />
					<h2 className='text-lg font-semibold'>Logs</h2>
					<Badge variant='secondary' className='text-xs'>
						{entries.length} events
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
								<Button variant='outline' size='sm' onClick={handleCopyAll} disabled={entries.length === 0}>
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
								<Button variant='outline' size='sm' onClick={handleExport} disabled={!activeTraceId || entries.length === 0}>
									{exported ? <Check className='h-4 w-4 mr-1' /> : <Download className='h-4 w-4 mr-1' />}
									<span className='hidden sm:inline'>Export</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Export trace as JSON</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					{/* Clear */}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => clearTrace()} disabled={entries.length === 0}>
									<Trash2 className='h-4 w-4' />
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Clear current trace</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			</div>

			{/* Metrics row */}
			{entries.length > 0 && (
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

					{/* Errors */}
					{metrics.errorCount > 0 && (
						<div className='flex items-center gap-1.5 text-red-500'>
							<AlertCircle className='h-3.5 w-3.5' />
							<span>{metrics.errorCount} errors</span>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
