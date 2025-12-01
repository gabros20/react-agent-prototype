"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
	ChevronDown,
	Maximize2,
	Play,
	MessageSquare,
	Bot,
	Wrench,
	Layers,
	Shield,
	ShieldCheck,
	ShieldQuestion,
	Clock,
	Loader2,
	CheckCircle2,
	AlertCircle,
	Flag,
	AlertTriangle,
	Brain,
	Scissors,
	Save,
	RotateCcw,
	History,
	FileText,
	ScrollText,
	PlayCircle,
	Cpu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
	type TraceEntry,
	type TraceEntryType,
	ENTRY_TYPE_COLORS,
	ENTRY_TYPE_LABELS,
	formatDuration,
	formatTimestamp,
} from "../../_stores/trace-store";
import { JsonViewer } from "./json-viewer";

const ENTRY_TYPE_ICONS: Record<TraceEntryType, LucideIcon> = {
	"trace-start": Play,
	"prompt-sent": MessageSquare,
	"llm-response": Bot,
	"tools-available": Wrench,
	"model-info": Cpu,
	"tool-call": Wrench,
	"step-start": PlayCircle,
	"step-complete": Layers,
	"approval-request": Shield,
	"approval-response": ShieldCheck,
	"confirmation-required": ShieldQuestion,
	"job-queued": Clock,
	"job-progress": Loader2,
	"job-complete": CheckCircle2,
	"job-failed": AlertCircle,
	"trace-complete": Flag,
	error: AlertTriangle,
	// New types
	"working-memory-update": Brain,
	"memory-trimmed": Scissors,
	"checkpoint-saved": Save,
	"retry-attempt": RotateCcw,
	"session-loaded": History,
	"system-log": FileText,
	"system-prompt": ScrollText,
};

interface TimelineEntryProps {
	entry: TraceEntry;
	isSelected?: boolean;
	isTraceComplete?: boolean;
	onSelect?: () => void;
	onOpenModal?: () => void;
}

// Status indicator types for tool calls
type ToolCallStatus = "in-progress" | "failed" | "stale" | null;

// Stale threshold: 30 seconds without completion
const STALE_THRESHOLD_MS = 30_000;

// Check if output contains error-like content
function hasErrorInOutput(output: unknown): boolean {
	if (!output || typeof output !== "object") return false;
	const obj = output as Record<string, unknown>;

	// Check for common error patterns in output
	if (obj.error !== undefined && obj.error !== null) return true;
	if (obj.success === false) return true;
	if (typeof obj.message === "string" && /not found|failed|error|invalid/i.test(obj.message)) return true;

	return false;
}

function getToolCallStatus(entry: TraceEntry, isTraceComplete: boolean): ToolCallStatus {
	// Only applies to tool-call entries
	if (entry.type !== "tool-call") {
		return null;
	}

	// Failed: has error attached directly
	if (entry.error) {
		return "failed";
	}

	// Failed: output contains error-like content
	if (entry.output !== undefined && hasErrorInOutput(entry.output)) {
		return "failed";
	}

	// Completed successfully: has duration or output without errors
	if (entry.duration !== undefined || entry.output !== undefined) {
		return null;
	}

	// Stale: trace is complete but this tool never got a result, or it's been too long
	const elapsed = Date.now() - entry.timestamp;
	if (isTraceComplete || elapsed > STALE_THRESHOLD_MS) {
		return "stale";
	}

	// In progress: actively waiting for result
	return "in-progress";
}

export function TimelineEntry({ entry, isSelected, isTraceComplete = false, onSelect, onOpenModal }: TimelineEntryProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const Icon = ENTRY_TYPE_ICONS[entry.type];
	const hasExpandableContent = entry.input !== undefined || entry.output !== undefined || entry.error !== undefined;

	const toolCallStatus = getToolCallStatus(entry, isTraceComplete);
	const isJobInProgress = entry.type === "job-progress";

	// Only color the entire block for non-tool-call errors (error type, job-failed)
	const isBlockError = entry.type === "error" || entry.type === "job-failed";

	// Determine badge color - tool-calls with errors get red badge
	const badgeColor = toolCallStatus === "failed" ? "bg-red-500" : toolCallStatus === "stale" ? "bg-gray-400" : ENTRY_TYPE_COLORS[entry.type];

	// Only allow expanding if there's content to show
	const handleOpenChange = (open: boolean) => {
		if (hasExpandableContent) {
			setIsExpanded(open);
		}
	};

	return (
		<Collapsible open={isExpanded} onOpenChange={handleOpenChange}>
			<div
				className={cn(
					"border rounded-lg transition-all group",
					"hover:bg-accent/30",
					isSelected && "ring-2 ring-primary/50 bg-accent/50",
					isBlockError && "border-red-500/30 bg-red-500/5"
				)}
			>
				<CollapsibleTrigger asChild disabled={!hasExpandableContent}>
					<div className={cn("flex items-start gap-2 p-2 sm:p-3", hasExpandableContent && "cursor-pointer")} onClick={onSelect}>
						{/* Timestamp */}
						<span className='text-[10px] sm:text-xs text-muted-foreground font-mono flex-shrink-0 w-20 sm:w-24'>
							{formatTimestamp(entry.timestamp)}
						</span>

						{/* Type badge - includes tool name for tool-call entries, step number for step entries */}
						<Badge
							className={cn(badgeColor, "text-white text-[10px] sm:text-xs flex-shrink-0 gap-1 pl-1.5 pr-2 relative overflow-visible")}
						>
							{/* Status indicator for tool calls in progress */}
							{(toolCallStatus === "in-progress" || isJobInProgress) && (
								<span className='absolute -top-1 -left-1 flex h-2.5 w-2.5'>
									<span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75' />
									<span className='relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500' />
								</span>
							)}
							<Icon className='h-3 w-3' />
							<span className='hidden sm:inline'>
								{entry.type === "tool-call" && entry.toolName
									? `Tool: ${entry.toolName}`
									: entry.type === "step-start" && entry.stepNumber
									? `Step ${entry.stepNumber} start`
									: entry.type === "step-complete" && entry.stepNumber
									? `Step ${entry.stepNumber} finish`
									: ENTRY_TYPE_LABELS[entry.type]}
							</span>
						</Badge>

						{/* Duration badge */}
						{entry.duration !== undefined && (
							<Badge variant='outline' className='text-[10px] sm:text-xs flex-shrink-0'>
								{formatDuration(entry.duration)}
							</Badge>
						)}

						{/* Stale indicator badge */}
						{toolCallStatus === "stale" && (
							<Badge variant='outline' className='text-[10px] sm:text-xs flex-shrink-0 text-gray-500 border-gray-400'>
								stale
							</Badge>
						)}

						{/* Progress badge for jobs */}
						{entry.jobProgress !== undefined && (
							<Badge variant='secondary' className='text-[10px] sm:text-xs flex-shrink-0'>
								{entry.jobProgress}%
							</Badge>
						)}

						{/* Tool name - only show separately for non-tool-call entries that have a tool name */}
						{entry.toolName && entry.type !== "tool-call" && (
							<span className='font-mono text-xs sm:text-sm text-primary flex-shrink-0'>{entry.toolName}</span>
						)}

						{/* Summary - skip for tool-calls and step entries since badge already shows the info */}
						{entry.type !== "tool-call" && entry.type !== "step-start" && entry.type !== "step-complete" ? (
							<span className='flex-1 text-xs sm:text-sm truncate text-muted-foreground'>{entry.summary}</span>
						) : (
							<span className='flex-1' />
						)}

						{/* Actions - always pushed to right */}
						<div className='flex items-center gap-1 flex-shrink-0 ml-auto'>
							{hasExpandableContent && (
								<ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
							)}
							{(entry.input !== undefined || entry.output !== undefined) && (
								<Button
									variant='ghost'
									size='icon'
									className='h-6 w-6 opacity-0 group-hover:opacity-100'
									onClick={(e) => {
										e.stopPropagation();
										onOpenModal?.();
									}}
								>
									<Maximize2 className='h-3 w-3' />
								</Button>
							)}
						</div>
					</div>
				</CollapsibleTrigger>

				<CollapsibleContent>
					<div className='max-h-[400px] overflow-y-auto border-t border-border/50'>
						<div className='px-3 pb-3 space-y-3 pt-2'>
							{/* Error message */}
							{entry.error && (
								<div className='bg-red-500/10 border border-red-500/30 rounded p-2'>
									<p className='text-xs font-medium text-red-600 dark:text-red-400'>{entry.error.message}</p>
									{entry.error.stack && (
										<pre className='text-[10px] text-muted-foreground mt-1 overflow-x-auto'>{entry.error.stack}</pre>
									)}
								</div>
							)}

							{/* Input */}
							{entry.input !== undefined && (
								<div className='space-y-1'>
									<span className='text-xs font-medium text-muted-foreground'>Input:</span>
									<JsonViewer data={entry.input} maxHeight='200px' onFullView={onOpenModal} />
								</div>
							)}

							{/* Output */}
							{entry.output !== undefined && (
								<div className='space-y-1'>
									<span className='text-xs font-medium text-muted-foreground'>Output:</span>
									<JsonViewer data={entry.output} maxHeight='200px' onFullView={onOpenModal} />
								</div>
							)}

							{/* Token usage */}
							{entry.tokens && (
								<div className='flex items-center gap-3 text-xs text-muted-foreground'>
									<span>
										Tokens: {entry.tokens.input} in / {entry.tokens.output} out
									</span>
								</div>
							)}
						</div>
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	);
}

// Compact variant for dense timeline view
export function TimelineEntryCompact({ entry, onClick }: { entry: TraceEntry; onClick?: () => void }) {
	const Icon = ENTRY_TYPE_ICONS[entry.type];
	// Error state includes error type, job-failed, or tool-call with error
	const isError = entry.type === "error" || entry.type === "job-failed" || (entry.type === "tool-call" && entry.error);

	// For tool-calls, show tool name; for others show summary
	const displayText = entry.type === "tool-call" && entry.toolName ? entry.toolName : entry.summary;

	return (
		<button
			type='button'
			onClick={onClick}
			className={cn(
				"flex items-center gap-2 p-1.5 rounded text-left w-full",
				"hover:bg-accent/50 transition-colors",
				isError && "bg-red-500/5"
			)}
		>
			<span className='text-[10px] text-muted-foreground font-mono w-16'>{formatTimestamp(entry.timestamp).slice(-8)}</span>
			<Icon className={cn("h-3 w-3", ENTRY_TYPE_COLORS[entry.type].replace("bg-", "text-"))} />
			<span className='text-[10px] text-muted-foreground truncate flex-1'>{displayText}</span>
			{entry.duration !== undefined && <span className='text-[10px] text-muted-foreground'>{formatDuration(entry.duration)}</span>}
		</button>
	);
}
