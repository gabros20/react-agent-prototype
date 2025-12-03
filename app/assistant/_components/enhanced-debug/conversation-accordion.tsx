"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Clock, Wrench, Layers, Zap, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import {
	useTraceStore,
	type ConversationLog,
	type TraceEntry,
	type TraceMetrics,
	formatDuration,
} from "../../_stores/trace-store";
import { useChatStore } from "../../_stores/chat-store";
import { TimelineEntry } from "./timeline-entry";
import { sessionsApi } from "@/lib/api";

// Entry types that should be indented when inside a step
const STEP_CHILD_TYPES = new Set(["tool-call", "text-streaming"]);

// Group entries into step blocks for rendering with connecting lines
type TimelineItem =
	| { type: "entry"; entry: TraceEntry }
	| { type: "step-group"; stepStart: TraceEntry; children: TraceEntry[]; stepEnd: TraceEntry | null };

function groupEntriesIntoSteps(entries: TraceEntry[]): TimelineItem[] {
	const items: TimelineItem[] = [];
	let i = 0;

	while (i < entries.length) {
		const entry = entries[i];

		if (entry.type === "step-start") {
			// Start collecting a step group
			const stepStart = entry;
			const children: TraceEntry[] = [];
			let stepEnd: TraceEntry | null = null;
			i++;

			// Collect children until we hit step-complete
			while (i < entries.length) {
				const current = entries[i];
				if (current.type === "step-complete" && current.stepNumber === stepStart.stepNumber) {
					stepEnd = current;
					i++;
					break;
				} else if (current.type === "step-start") {
					// Nested step or new step without completing previous - break
					break;
				} else if (STEP_CHILD_TYPES.has(current.type)) {
					children.push(current);
					i++;
				} else {
					// Non-step-child entry inside step - just include it
					children.push(current);
					i++;
				}
			}

			items.push({ type: "step-group", stepStart, children, stepEnd });
		} else {
			// Regular entry outside of step
			items.push({ type: "entry", entry });
			i++;
		}
	}

	return items;
}

interface ConversationSectionProps {
	conversation: ConversationLog;
	isExpanded: boolean;
	onToggleExpanded: () => void;
}

function ConversationSection({ conversation, isExpanded, onToggleExpanded }: ConversationSectionProps) {
	// Use selectors to avoid subscribing to entire store
	const selectedEntryId = useTraceStore((state) => state.selectedEntryId);
	const setSelectedEntry = useTraceStore((state) => state.setSelectedEntry);
	const openModal = useTraceStore((state) => state.openModal);
	const entriesByTrace = useTraceStore((state) => state.entriesByTrace);

	// For live conversations, get entries from entriesByTrace (real-time updates)
	// For completed conversations, use the stored entries
	const entries = useMemo(() => {
		if (conversation.isLive) {
			return entriesByTrace[conversation.id] || [];
		}
		return conversation.entries || [];
	}, [conversation.isLive, conversation.id, conversation.entries, entriesByTrace]);

	// Group entries into step blocks
	const timelineItems = useMemo(() => groupEntriesIntoSteps(entries), [entries]);

	// Check if trace is complete
	const isComplete = conversation.completedAt !== null;

	// Format user prompt for display (truncate)
	const displayPrompt = useMemo(() => {
		const prompt = conversation.userPrompt || "...";
		return prompt.length > 50 ? `${prompt.slice(0, 50)}...` : prompt;
	}, [conversation.userPrompt]);

	// Format stats
	const stats = conversation.metrics;

	return (
		<Collapsible open={isExpanded} onOpenChange={onToggleExpanded}>
			{/* Conversation header - accordion trigger */}
			<CollapsibleTrigger asChild>
				<div
					className={cn(
						"flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors",
						"border-b border-border/50",
						isExpanded && "bg-accent/20"
					)}
				>
					{/* Conversation name/prompt */}
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2">
							<span className="text-sm font-medium text-foreground truncate">{`Convo ${conversation.conversationIndex}`}</span>
							{conversation.isLive && (
								<Loader2 className="h-3 w-3 animate-spin text-green-500" />
							)}
						</div>
						<p className="text-xs text-muted-foreground truncate">{displayPrompt}</p>
					</div>

					{/* Stats badges */}
					{stats && (
						<div className="flex items-center gap-1.5 flex-shrink-0">
							{/* Duration */}
							<Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
								<Clock className="h-2.5 w-2.5" />
								{formatDuration(stats.totalDuration)}
							</Badge>

							{/* Tool calls */}
							{stats.toolCallCount > 0 && (
								<Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
									<Wrench className="h-2.5 w-2.5" />
									{stats.toolCallCount}
								</Badge>
							)}

							{/* Steps */}
							{stats.stepCount > 0 && (
								<Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
									<Layers className="h-2.5 w-2.5" />
									{stats.stepCount}
								</Badge>
							)}

							{/* Tokens */}
							{(stats.tokens.input > 0 || stats.tokens.output > 0) && (
								<Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
									<Zap className="h-2.5 w-2.5" />
									{((stats.tokens.input + stats.tokens.output) / 1000).toFixed(1)}K
								</Badge>
							)}

							{/* Errors */}
							{stats.errorCount > 0 && (
								<Badge variant="destructive" className="text-[10px] gap-1 px-1.5 py-0">
									<AlertCircle className="h-2.5 w-2.5" />
									{stats.errorCount}
								</Badge>
							)}
						</div>
					)}

					{/* Divider line */}
					<div className="flex-1 h-px bg-border/50 mx-2" />

					{/* Collapse button */}
					<Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0">
						<ChevronDown
							className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")}
						/>
					</Button>
				</div>
			</CollapsibleTrigger>

			{/* Conversation timeline entries */}
			<CollapsibleContent>
				<div className="space-y-2 p-2 pl-4 border-l-2 border-primary/20 ml-3">
					{timelineItems.map((item) => {
						if (item.type === "entry") {
							return (
								<TimelineEntry
									key={item.entry.id}
									entry={item.entry}
									isSelected={item.entry.id === selectedEntryId}
									isTraceComplete={isComplete}
									onSelect={() => setSelectedEntry(item.entry.id)}
									onOpenModal={() => openModal(item.entry)}
								/>
							);
						}

						// Step group with connecting line
						const { stepStart, children, stepEnd } = item;
						const hasChildren = children.length > 0;

						return (
							<div key={stepStart.id} className="relative">
								{/* Step start */}
								<TimelineEntry
									entry={stepStart}
									isSelected={stepStart.id === selectedEntryId}
									isTraceComplete={isComplete}
									onSelect={() => setSelectedEntry(stepStart.id)}
									onOpenModal={() => openModal(stepStart)}
								/>

								{/* Children with connecting line */}
								{hasChildren && (
									<div className="relative ml-3 pl-4 border-l-2 border-blue-400/50">
										<div className="space-y-2 py-2">
											{children.map((child) => (
												<TimelineEntry
													key={child.id}
													entry={child}
													isSelected={child.id === selectedEntryId}
													isTraceComplete={isComplete}
													onSelect={() => setSelectedEntry(child.id)}
													onOpenModal={() => openModal(child)}
												/>
											))}
										</div>
									</div>
								)}

								{/* Step end */}
								{stepEnd && (
									<TimelineEntry
										entry={stepEnd}
										isSelected={stepEnd.id === selectedEntryId}
										isTraceComplete={isComplete}
										onSelect={() => setSelectedEntry(stepEnd.id)}
										onOpenModal={() => openModal(stepEnd)}
									/>
								)}
							</div>
						);
					})}

					{/* Completion footer - shown when conversation is done */}
					{isComplete && stats && (
						<div className="flex items-center gap-2 py-2 px-3 text-xs text-muted-foreground border-t border-border/30 mt-2">
							<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
							<span>Completed in {formatDuration(stats.totalDuration)}</span>
							{stats.cost > 0 && (
								<span className="text-muted-foreground/60">
									&bull; ${stats.cost.toFixed(4)}
								</span>
							)}
						</div>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

interface ConversationAccordionProps {
	className?: string;
}

export function ConversationAccordion({ className }: ConversationAccordionProps) {
	const sessionId = useChatStore((state) => state.sessionId);

	// Use selectors to avoid subscribing to entire store
	const liveConversations = useTraceStore((state) => state.conversationLogs);
	const expandedConversationIds = useTraceStore((state) => state.expandedConversationIds);
	const toggleConversationExpanded = useTraceStore((state) => state.toggleConversationExpanded);
	const loadConversationLogs = useTraceStore((state) => state.loadConversationLogs);
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
	const [persistedLogs, setPersistedLogs] = useState<ConversationLog[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const lastFetchedSessionId = useRef<string | null>(null);

	// Fetch logs for a session
	const fetchLogs = useCallback(async (sid: string) => {
		if (lastFetchedSessionId.current === sid) {
			return; // Already fetched
		}

		setIsLoading(true);
		lastFetchedSessionId.current = sid;

		try {
			const rawLogs = await sessionsApi.getLogs(sid) as Array<Record<string, unknown>>;
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
				// Also load into trace store so use-agent can calculate correct next index
				loadConversationLogs(sid, logs);
			} else {
				setPersistedLogs([]);
				loadConversationLogs(sid, []);
			}
		} catch (error) {
			console.error("Failed to fetch conversation logs:", error);
			setPersistedLogs([]);
			loadConversationLogs(sid, []);
		} finally {
			setIsLoading(false);
		}
	}, [loadConversationLogs]);

	// Fetch logs when sessionId changes
	useEffect(() => {
		if (!sessionId) {
			setPersistedLogs([]);
			lastFetchedSessionId.current = null;
			return;
		}

		fetchLogs(sessionId);
	}, [sessionId, fetchLogs]);

	// Also subscribe to store changes to catch hydration
	useEffect(() => {
		// Subscribe to chat store changes to catch hydration
		const unsubscribe = useChatStore.subscribe((state, prevState) => {
			if (state.sessionId && state.sessionId !== prevState.sessionId) {
				fetchLogs(state.sessionId);
			}
		});

		// Check if there's already a sessionId (from hydration that happened before mount)
		const currentSessionId = useChatStore.getState().sessionId;
		if (currentSessionId && lastFetchedSessionId.current !== currentSessionId) {
			fetchLogs(currentSessionId);
		}

		return unsubscribe;
	}, [fetchLogs]);

	// Merge persisted logs with live conversations (live ones take precedence)
	const conversations = useMemo(() => {
		const liveIds = new Set(liveConversations.map((c) => c.id));
		const merged = [
			...persistedLogs.filter((log) => !liveIds.has(log.id)),
			...liveConversations,
		];
		return merged.sort((a, b) => a.conversationIndex - b.conversationIndex);
	}, [persistedLogs, liveConversations]);

	// Track expanded state locally
	const isExpanded = (id: string) => {
		if (expandedConversationIds.has(id)) return true;
		return expandedIds.has(id);
	};

	const handleToggle = (id: string) => {
		const isLive = liveConversations.some((c) => c.id === id);
		if (isLive) {
			toggleConversationExpanded(id);
		} else {
			setExpandedIds((prev) => {
				const next = new Set(prev);
				if (next.has(id)) {
					next.delete(id);
				} else {
					next.add(id);
				}
				return next;
			});
		}
	};

	if (isLoading) {
		return (
			<div className={cn("flex flex-col", className)}>
				{/* Shimmer skeleton for conversation logs */}
				{[1, 2, 3].map((i) => (
					<div
						key={i}
						className="flex items-center gap-3 px-3 py-2 border-b border-border/50 animate-pulse"
					>
						{/* Conversation info skeleton */}
						<div className="flex-1 min-w-0 space-y-2">
							<div className="flex items-center gap-2">
								<div className="h-4 w-20 bg-muted rounded" />
								<div className="h-3 w-3 bg-muted rounded-full" />
							</div>
							<div className="h-3 w-32 bg-muted/70 rounded" />
						</div>

						{/* Stats badges skeleton */}
						<div className="flex items-center gap-1.5 flex-shrink-0">
							<div className="h-4 w-12 bg-muted rounded" />
							<div className="h-4 w-8 bg-muted rounded" />
							<div className="h-4 w-10 bg-muted rounded" />
						</div>

						{/* Divider line */}
						<div className="flex-1 h-px bg-border/50 mx-2" />

						{/* Collapse button skeleton */}
						<div className="h-6 w-6 bg-muted rounded" />
					</div>
				))}
			</div>
		);
	}

	if (conversations.length === 0) {
		return (
			<div className={cn("flex items-center justify-center h-full", className)}>
				<div className="text-center text-muted-foreground">
					<p className="text-sm font-medium">No conversation logs</p>
					<p className="text-xs mt-1">Logs will appear here during agent execution</p>
				</div>
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col", className)}>
			{conversations.map((conversation) => (
				<ConversationSection
					key={conversation.id}
					conversation={conversation}
					isExpanded={isExpanded(conversation.id)}
					onToggleExpanded={() => handleToggle(conversation.id)}
				/>
			))}
		</div>
	);
}
