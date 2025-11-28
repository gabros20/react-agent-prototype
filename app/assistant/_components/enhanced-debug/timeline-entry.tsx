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
	CheckCircle,
	XCircle,
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
	"tool-call": Wrench,
	"tool-result": CheckCircle,
	"tool-error": XCircle,
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
	hasMatchingResult?: boolean; // Whether this tool-call has a corresponding tool-result
	linkedToolName?: string; // Tool name for result entries (looked up from tool-call)
	onSelect?: () => void;
	onOpenModal?: () => void;
}

// Status indicator types for tool calls
type ToolCallStatus = 'in-progress' | 'failed' | 'stale' | null;

// Stale threshold: 30 seconds without completion
const STALE_THRESHOLD_MS = 30_000;

function getToolCallStatus(
	entry: TraceEntry,
	isTraceComplete: boolean,
	hasMatchingResult: boolean
): ToolCallStatus {
	// Only applies to tool-call entries
	if (entry.type !== 'tool-call') {
		return null;
	}

	// If we have duration set OR a matching result exists, the tool completed successfully
	if (entry.duration !== undefined || hasMatchingResult) {
		return null;
	}

	// Failed: has error attached
	if (entry.error) {
		return 'failed';
	}

	// Stale: trace is complete but this tool never got a result, or it's been too long
	const elapsed = Date.now() - entry.timestamp;
	if (isTraceComplete || elapsed > STALE_THRESHOLD_MS) {
		return 'stale';
	}

	// In progress: actively waiting for result
	return 'in-progress';
}

export function TimelineEntry({
	entry,
	isSelected,
	isTraceComplete = false,
	hasMatchingResult = false,
	linkedToolName,
	onSelect,
	onOpenModal
}: TimelineEntryProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const Icon = ENTRY_TYPE_ICONS[entry.type];
	const hasExpandableContent = entry.input !== undefined || entry.output !== undefined;

	const isError = entry.type === "error" || entry.type === "tool-error" || entry.type === "job-failed";
	const toolCallStatus = getToolCallStatus(entry, isTraceComplete, hasMatchingResult);
	const isJobInProgress = entry.type === "job-progress";

	// For result entries, show the linked tool name
	const displayToolName = entry.toolName || linkedToolName;

	return (
		<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
			<div
				className={cn(
					"border rounded-lg transition-all group",
					"hover:bg-accent/30",
					isSelected && "ring-2 ring-primary/50 bg-accent/50",
					isError && "border-red-500/30 bg-red-500/5"
				)}
			>
				<CollapsibleTrigger asChild disabled={!hasExpandableContent}>
					<div className={cn("flex items-start gap-2 p-2 sm:p-3", hasExpandableContent && "cursor-pointer")} onClick={onSelect}>
						{/* Timestamp */}
						<span className='text-[10px] sm:text-xs text-muted-foreground font-mono flex-shrink-0 w-20 sm:w-24'>
							{formatTimestamp(entry.timestamp)}
						</span>

						{/* Type badge */}
						<Badge
							className={cn(
								ENTRY_TYPE_COLORS[entry.type],
								"text-white text-[10px] sm:text-xs flex-shrink-0 gap-1 px-1.5 relative overflow-visible"
							)}
						>
							{/* Status indicators for tool calls and jobs */}
							{(toolCallStatus === 'in-progress' || isJobInProgress) && (
								<span className='absolute -top-1 -left-1 flex h-2.5 w-2.5'>
									<span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75' />
									<span className='relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500' />
								</span>
							)}
							{toolCallStatus === 'failed' && (
								<span className='absolute -top-1 -left-1 flex h-2.5 w-2.5'>
									<span className='relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500' />
								</span>
							)}
							{toolCallStatus === 'stale' && (
								<span className='absolute -top-1 -left-1 flex h-2.5 w-2.5'>
									<span className='relative inline-flex rounded-full h-2.5 w-2.5 bg-gray-400' />
								</span>
							)}
							<Icon className='h-3 w-3' />
							<span className='hidden sm:inline'>{ENTRY_TYPE_LABELS[entry.type]}</span>
						</Badge>

						{/* Duration badge */}
						{entry.duration !== undefined && (
							<Badge variant='outline' className='text-[10px] sm:text-xs flex-shrink-0'>
								{formatDuration(entry.duration)}
							</Badge>
						)}

						{/* Progress badge for jobs */}
						{entry.jobProgress !== undefined && (
							<Badge variant='secondary' className='text-[10px] sm:text-xs flex-shrink-0'>
								{entry.jobProgress}%
							</Badge>
						)}

						{/* Tool name - shows linked tool name for results */}
						{displayToolName && <span className='font-mono text-xs sm:text-sm text-primary flex-shrink-0'>{displayToolName}</span>}

						{/* Summary */}
						<span className='flex-1 text-xs sm:text-sm truncate text-muted-foreground'>{entry.summary}</span>

						{/* Actions */}
						<div className='flex items-center gap-1 flex-shrink-0'>
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
export function TimelineEntryCompact({
	entry,
	linkedToolName,
	onClick
}: {
	entry: TraceEntry;
	linkedToolName?: string;
	onClick?: () => void;
}) {
	const Icon = ENTRY_TYPE_ICONS[entry.type];
	const isError = entry.type === "error" || entry.type === "tool-error" || entry.type === "job-failed";
	const displayToolName = entry.toolName || linkedToolName;

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
			{displayToolName && <span className='font-mono text-[10px] text-primary'>{displayToolName}</span>}
			<span className='text-[10px] text-muted-foreground truncate flex-1'>{entry.summary}</span>
			{entry.duration !== undefined && <span className='text-[10px] text-muted-foreground'>{formatDuration(entry.duration)}</span>}
		</button>
	);
}
