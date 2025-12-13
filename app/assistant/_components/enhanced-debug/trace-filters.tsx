"use client";

import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Search, X, Filter, Copy, Download, Trash2, Check, ChevronsDownUp } from "lucide-react";
import { useTraceStore, type TraceEntryType, type TraceLevel, type TraceMetrics, type ConversationLog, type TraceEntry, ENTRY_TYPE_COLORS, ENTRY_TYPE_LABELS } from "../../_stores/trace-store";
import { useChatStore } from "../../_stores/chat-store";
import { sessionsApi } from "@/lib/api";

// Group entry types for better UX
const TYPE_GROUPS = {
	LLM: ["system-prompt", "user-prompt", "tools-available", "model-info", "prompt-sent", "llm-response", "llm-context", "text-streaming"] as TraceEntryType[],
	Tools: ["tool-call", "tools-discovered", "active-tools-changed", "instructions-injected", "confirmation-required"] as TraceEntryType[],
	Flow: ["trace-start", "step-start", "step-complete", "trace-complete"] as TraceEntryType[],
	Context: ["working-memory-update", "memory-trimmed", "context-cleanup", "compaction-start", "compaction-progress", "compaction-complete"] as TraceEntryType[],
	Session: ["session-loaded", "checkpoint-saved"] as TraceEntryType[],
	Approval: ["approval-request", "approval-response"] as TraceEntryType[],
	Jobs: ["job-queued", "job-progress", "job-complete", "job-failed"] as TraceEntryType[],
	System: ["system-log", "retry-attempt", "error"] as TraceEntryType[],
};

const LEVEL_COLORS: Record<TraceLevel, string> = {
	debug: "bg-gray-400",
	info: "bg-blue-400",
	warn: "bg-yellow-500",
	error: "bg-red-500",
};

interface TraceFiltersProps {
	className?: string;
	compact?: boolean;
}

export function TraceFilters({ className, compact = false }: TraceFiltersProps) {
	const sessionId = useChatStore((state) => state.sessionId);

	// Use selectors to avoid subscribing to entire store
	const filters = useTraceStore((state) => state.filters);
	const setFilters = useTraceStore((state) => state.setFilters);
	const activeTraceId = useTraceStore((state) => state.activeTraceId);
	const clearAllTraces = useTraceStore((state) => state.clearAllTraces);
	const exportTrace = useTraceStore((state) => state.exportTrace);
	const copyAllLogs = useTraceStore((state) => state.copyAllLogs);
	const collapseAllConversations = useTraceStore((state) => state.collapseAllConversations);
	const liveConversations = useTraceStore((state) => state.conversationLogs);
	const clearedAt = useTraceStore((state) => state.clearedAt);

	const [copied, setCopied] = useState(false);
	const [exported, setExported] = useState(false);
	const [persistedLogs, setPersistedLogs] = useState<ConversationLog[]>([]);
	const [isDeleting, setIsDeleting] = useState(false);

	// Clear persistedLogs when store signals logs were cleared
	useEffect(() => {
		if (clearedAt) {
			setPersistedLogs([]);
		}
	}, [clearedAt]);

	// Fetch logs when sessionId changes (for event count)
	useEffect(() => {
		if (!sessionId) {
			setPersistedLogs([]);
			return;
		}

		const fetchLogs = async () => {
			try {
				const rawLogs = (await sessionsApi.getLogs(sessionId)) as Array<Record<string, unknown>>;
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
						entries: (log.entries || []) as TraceEntry[],
						isLive: false,
					}));
					setPersistedLogs(logs);
				} else {
					setPersistedLogs([]);
				}
			} catch (error) {
				console.error("Failed to fetch logs for filters:", error);
				setPersistedLogs([]);
			}
		};

		fetchLogs();
	}, [sessionId]);

	// Calculate total event count
	const totalEventCount = useMemo(() => {
		const liveIds = new Set(liveConversations.map((c) => c.id));
		const allLogs = [...persistedLogs.filter((log) => !liveIds.has(log.id)), ...liveConversations];

		let eventCount = 0;
		for (const log of allLogs) {
			eventCount += log.entries?.length || 0;
		}
		return eventCount;
	}, [persistedLogs, liveConversations]);

	const toggleType = (type: TraceEntryType) => {
		const newTypes = filters.types.includes(type) ? filters.types.filter((t) => t !== type) : [...filters.types, type];
		setFilters({ types: newTypes });
	};

	const toggleLevel = (level: TraceLevel) => {
		const newLevels = filters.levels.includes(level) ? filters.levels.filter((l) => l !== level) : [...filters.levels, level];
		setFilters({ levels: newLevels });
	};

	const clearFilters = () => {
		setFilters({
			types: [],
			levels: [],
			searchQuery: "",
		});
	};

	const hasActiveFilters = filters.types.length > 0 || filters.levels.length > 0 || filters.searchQuery.length > 0;

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
			await sessionsApi.deleteLogs(sessionId);
			clearAllTraces();
			setPersistedLogs([]);
		} catch (error) {
			console.error("Failed to delete logs:", error);
		} finally {
			setIsDeleting(false);
		}
	};

	if (compact) {
		return (
			<div className={cn("flex items-center gap-2 flex-wrap", className)}>
				{/* Search */}
				<div className='relative flex-1 min-w-[200px]'>
					<Search className='absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
					<Input
						placeholder='Search logs...'
						value={filters.searchQuery}
						onChange={(e) => setFilters({ searchQuery: e.target.value })}
						className='pl-8 h-8 text-sm'
					/>
					{filters.searchQuery && (
						<Button
							variant='ghost'
							size='icon'
							className='absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6'
							onClick={() => setFilters({ searchQuery: "" })}
						>
							<X className='h-3 w-3' />
						</Button>
					)}
				</div>

				{/* Quick type filters */}
				<div className='flex items-center gap-1'>
					{(["tool-call", "error"] as TraceEntryType[]).map((type) => (
						<Badge
							key={type}
							variant={filters.types.includes(type) ? "default" : "outline"}
							className={cn("cursor-pointer text-xs", filters.types.includes(type) && ENTRY_TYPE_COLORS[type])}
							onClick={() => toggleType(type)}
						>
							{ENTRY_TYPE_LABELS[type]}
						</Badge>
					))}
				</div>

				{/* Job events toggle */}
				<div className='flex items-center gap-2'>
					<Switch
						id='show-jobs-compact'
						checked={filters.showJobEvents}
						onCheckedChange={(checked) => setFilters({ showJobEvents: checked })}
						className='h-4 w-7'
					/>
					<Label htmlFor='show-jobs-compact' className='text-xs text-muted-foreground'>
						Jobs
					</Label>
				</div>

				{/* Clear filters */}
				{hasActiveFilters && (
					<Button variant='ghost' size='sm' onClick={clearFilters} className='h-7 px-2'>
						<X className='h-3 w-3 mr-1' />
						Clear
					</Button>
				)}

				{/* Separator */}
				<div className='h-6 w-px bg-border mx-1' />

				{/* Collapse all conversations */}
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant='outline' size='sm' className='h-7 w-7 p-0' onClick={collapseAllConversations} disabled={totalEventCount === 0}>
								<ChevronsDownUp className='h-3.5 w-3.5' />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Collapse all conversations</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				{/* Copy all logs */}
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant='outline' size='sm' className='h-7' onClick={handleCopyAll} disabled={totalEventCount === 0}>
								{copied ? <Check className='h-3.5 w-3.5 mr-1' /> : <Copy className='h-3.5 w-3.5 mr-1' />}
								<span className='hidden sm:inline text-xs'>{copied ? "Copied" : "Copy"}</span>
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
							<Button variant='outline' size='sm' className='h-7' onClick={handleExport} disabled={!activeTraceId || totalEventCount === 0}>
								{exported ? <Check className='h-3.5 w-3.5 mr-1' /> : <Download className='h-3.5 w-3.5 mr-1' />}
								<span className='hidden sm:inline text-xs'>{exported ? "Exported" : "Export"}</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Export trace as JSON</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				{/* Delete all logs */}
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant='ghost' size='icon' className='h-7 w-7' onClick={handleClearAllLogs} disabled={totalEventCount === 0 || isDeleting}>
								<Trash2 className='h-3.5 w-3.5' />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Delete all logs</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Search */}
			<div className='relative'>
				<Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
				<Input
					placeholder='Search in logs...'
					value={filters.searchQuery}
					onChange={(e) => setFilters({ searchQuery: e.target.value })}
					className='pl-9'
				/>
				{filters.searchQuery && (
					<Button
						variant='ghost'
						size='icon'
						className='absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7'
						onClick={() => setFilters({ searchQuery: "" })}
					>
						<X className='h-4 w-4' />
					</Button>
				)}
			</div>

			{/* Type filters by group */}
			<div className='space-y-3'>
				<div className='flex items-center justify-between'>
					<h4 className='text-sm font-medium flex items-center gap-2'>
						<Filter className='h-4 w-4' />
						Filter by Type
					</h4>
					{filters.types.length > 0 && (
						<Button variant='ghost' size='sm' onClick={() => setFilters({ types: [] })} className='h-6 text-xs'>
							Clear types
						</Button>
					)}
				</div>

				{Object.entries(TYPE_GROUPS).map(([group, types]) => (
					<div key={group} className='space-y-1.5'>
						<span className='text-xs text-muted-foreground uppercase tracking-wider'>{group}</span>
						<div className='flex flex-wrap gap-1.5'>
							{types.map((type) => (
								<Badge
									key={type}
									variant={filters.types.includes(type) ? "default" : "outline"}
									className={cn(
										"cursor-pointer transition-colors text-xs",
										filters.types.includes(type) ? cn(ENTRY_TYPE_COLORS[type], "text-white") : "hover:bg-accent"
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
			<div className='space-y-2'>
				<h4 className='text-sm font-medium'>Filter by Level</h4>
				<div className='flex flex-wrap gap-1.5'>
					{(["debug", "info", "warn", "error"] as TraceLevel[]).map((level) => (
						<Badge
							key={level}
							variant={filters.levels.includes(level) ? "default" : "outline"}
							className={cn(
								"cursor-pointer transition-colors capitalize text-xs",
								filters.levels.includes(level) ? cn(LEVEL_COLORS[level], "text-white") : "hover:bg-accent"
							)}
							onClick={() => toggleLevel(level)}
						>
							{level}
						</Badge>
					))}
				</div>
			</div>

			{/* Job events toggle */}
			<div className='flex items-center justify-between py-2 border-t'>
				<div className='space-y-0.5'>
					<Label htmlFor='show-jobs' className='text-sm font-medium'>
						Show Job Events
					</Label>
					<p className='text-xs text-muted-foreground'>Display background processing events</p>
				</div>
				<Switch id='show-jobs' checked={filters.showJobEvents} onCheckedChange={(checked) => setFilters({ showJobEvents: checked })} />
			</div>

			{/* Clear all filters */}
			{hasActiveFilters && (
				<Button variant='outline' onClick={clearFilters} className='w-full'>
					<X className='h-4 w-4 mr-2' />
					Clear All Filters
				</Button>
			)}
		</div>
	);
}
