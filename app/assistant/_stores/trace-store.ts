"use client";

import { create } from "zustand";

// ============================================================================
// Types
// ============================================================================

export type TraceEntryType =
	| "trace-start"
	| "prompt-sent"
	| "llm-response"
	| "text-streaming" // LLM generating text (updated in place as tokens stream)
	| "tools-available" // List of tools passed to the agent
	| "model-info" // Model ID and pricing info
	| "tool-call" // Tool call - updated in place with output/error when complete
	| "step-start"
	| "step-complete"
	| "approval-request"
	| "approval-response"
	| "confirmation-required" // Tool returned requiresConfirmation (confirmed flag pattern)
	| "job-queued"
	| "job-progress"
	| "job-complete"
	| "job-failed"
	| "trace-complete"
	| "error"
	// New types for comprehensive debugging
	| "working-memory-update" // Entity extraction happened
	| "memory-trimmed" // Message history was trimmed
	| "checkpoint-saved" // Session checkpoint saved
	| "retry-attempt" // Retry with backoff
	| "session-loaded" // Previous messages loaded
	| "system-log" // General log from backend
	| "system-prompt" // Compiled system prompt (for inspection)
	| "user-prompt" // User prompt with token count
	// Dynamic tool injection observability
	| "tools-discovered" // tool_search returned tools
	| "active-tools-changed" // prepareStep expanded activeTools
	| "instructions-injected"; // Tool instructions injected into system prompt

export type TraceLevel = "debug" | "info" | "warn" | "error";

export interface TraceEntry {
	id: string;
	traceId: string;
	parentId?: string;
	timestamp: number;
	duration?: number;

	type: TraceEntryType;
	level: TraceLevel;

	stepNumber?: number;
	toolName?: string;
	toolCallId?: string;

	summary: string;
	input?: unknown;
	output?: unknown;

	tokens?: { input: number; output: number };
	error?: { message: string; stack?: string };

	// Job-specific fields
	jobId?: string;
	jobProgress?: number;
}

export interface TraceFilters {
	types: TraceEntryType[];
	levels: TraceLevel[];
	searchQuery: string;
	showJobEvents: boolean;
}

export interface ModelPricing {
	prompt: number; // $ per million tokens
	completion: number; // $ per million tokens
}

export interface TraceMetrics {
	totalDuration: number;
	toolCallCount: number;
	stepCount: number;
	tokens: { input: number; output: number };
	cost: number; // Calculated cost in $
	errorCount: number;
}

// Conversation log represents a single user->agent exchange
export interface ConversationLog {
	id: string;
	sessionId: string;
	conversationIndex: number;
	userPrompt: string;
	startedAt: Date;
	completedAt: Date | null;
	metrics: TraceMetrics | null;
	modelInfo: { modelId: string; pricing: ModelPricing | null } | null;
	entries: TraceEntry[];
	isLive?: boolean; // True if this conversation is currently streaming
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Apply filters to entries - pure function for computing derived state */
function applyFilters(entries: TraceEntry[], filters: TraceFilters): TraceEntry[] {
	return entries.filter((entry) => {
		// Type filter
		if (filters.types.length > 0 && !filters.types.includes(entry.type)) {
			return false;
		}

		// Level filter
		if (filters.levels.length > 0 && !filters.levels.includes(entry.level)) {
			return false;
		}

		// Job events toggle
		if (!filters.showJobEvents && entry.type.startsWith("job-")) {
			return false;
		}

		// Search query
		if (filters.searchQuery) {
			const query = filters.searchQuery.toLowerCase();
			const searchable = [entry.summary, entry.toolName, JSON.stringify(entry.input), JSON.stringify(entry.output)]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();

			if (!searchable.includes(query)) {
				return false;
			}
		}

		return true;
	});
}

/** Compute derived state from current entries and filters */
function computeDerivedState(
	entriesByTrace: Record<string, TraceEntry[]>,
	activeTraceId: string | null,
	filters: TraceFilters
): { activeTraceEntries: TraceEntry[]; filteredEntries: TraceEntry[] } {
	const activeTraceEntries = entriesByTrace[activeTraceId || ""] || [];
	const filteredEntries = applyFilters(activeTraceEntries, filters);
	return { activeTraceEntries, filteredEntries };
}

// ============================================================================
// Store
// ============================================================================

interface TraceState {
	// Entries grouped by traceId (Record instead of Map for proper Zustand reactivity)
	entriesByTrace: Record<string, TraceEntry[]>;
	allTraceIds: string[];
	activeTraceId: string | null;

	// Derived state (computed after mutations, subscribed by components)
	activeTraceEntries: TraceEntry[];
	filteredEntries: TraceEntry[];

	// Model and pricing per trace (Record instead of Map)
	modelInfoByTrace: Record<string, { modelId: string; pricing: ModelPricing | null }>;

	// Timing tracking for duration calculation (Record instead of Map)
	pendingTimings: Record<string, number>; // id -> startTime

	// Filters
	filters: TraceFilters;

	// UI state
	selectedEntryId: string | null;
	isModalOpen: boolean;
	modalEntry: TraceEntry | null;

	// Conversation logs - persisted logs loaded from DB
	conversationLogs: ConversationLog[];
	activeSessionId: string | null;
	expandedConversationIds: Set<string>; // Which conversations are expanded
	clearedAt: number | null; // Timestamp when logs were cleared (for triggering refetch)

	// Persisted working memory entities (loaded from DB on session load)
	persistedWorkingMemory: Array<{
		type: string;
		id: string;
		name: string;
		timestamp: string | Date; // String from API, Date after parsing
	}>;

	// Persisted discovered/used tools (loaded from DB on session load)
	persistedDiscoveredTools: string[];
	persistedUsedTools: Array<{
		name: string;
		count: number;
		lastUsed: string;
		lastResult: "success" | "error";
	}>;

	// Actions
	addEntry: (entry: Omit<TraceEntry, "id"> & { id?: string }) => void;
	updateEntry: (id: string, updates: Partial<TraceEntry>) => void;
	deleteEntry: (id: string) => void;
	completeEntry: (id: string, output?: unknown, error?: TraceEntry["error"]) => void;
	setModelInfo: (traceId: string, modelId: string, pricing: ModelPricing | null) => void;
	setActiveTrace: (traceId: string | null) => void;
	setFilters: (filters: Partial<TraceFilters>) => void;
	setSelectedEntry: (id: string | null) => void;
	openModal: (entry: TraceEntry) => void;
	closeModal: () => void;
	clearTrace: (traceId?: string) => void;
	clearAllTraces: () => void;

	// Conversation log actions
	loadConversationLogs: (sessionId: string, logs: ConversationLog[]) => void;
	addConversationLog: (log: ConversationLog) => void;
	setActiveSession: (sessionId: string | null) => void;
	toggleConversationExpanded: (conversationId: string) => void;
	setConversationExpanded: (conversationId: string, expanded: boolean) => void;
	getConversationLogs: () => ConversationLog[];

	// Working memory actions
	loadPersistedWorkingMemory: (entities: Array<{ type: string; id: string; name: string; timestamp: string | Date }>) => void;
	loadPersistedTools: (
		discoveredTools: string[],
		usedTools: Array<{ name: string; count: number; lastUsed: string; lastResult: "success" | "error" }>
	) => void;

	// Export utilities
	exportTrace: (traceId: string) => string;
	copyAllLogs: () => Promise<void>;
	getFilteredEntries: () => TraceEntry[];
	getMetrics: () => TraceMetrics;
	getTotalMetrics: () => TraceMetrics;
	getTotalEventCount: () => number;
}

const DEFAULT_FILTERS: TraceFilters = {
	types: [],
	levels: [],
	searchQuery: "",
	showJobEvents: true,
};

export const useTraceStore = create<TraceState>((set, get) => ({
	entriesByTrace: {},
	allTraceIds: [],
	activeTraceId: null,
	activeTraceEntries: [],
	filteredEntries: [],
	modelInfoByTrace: {},
	pendingTimings: {},
	filters: DEFAULT_FILTERS,
	selectedEntryId: null,
	isModalOpen: false,
	modalEntry: null,
	conversationLogs: [],
	activeSessionId: null,
	expandedConversationIds: new Set(),
	clearedAt: null,
	persistedWorkingMemory: [],
	persistedDiscoveredTools: [],
	persistedUsedTools: [],

	addEntry: (entry) => {
		const id = entry.id || crypto.randomUUID();
		const fullEntry: TraceEntry = {
			...entry,
			id,
			timestamp: entry.timestamp || Date.now(),
		};

		set((state) => {
			const traceEntries = state.entriesByTrace[fullEntry.traceId] || [];

			// Prevent duplicate IDs - if entry with this ID exists, skip
			if (traceEntries.some((e) => e.id === id)) {
				return state;
			}

			const newEntriesByTrace = {
				...state.entriesByTrace,
				[fullEntry.traceId]: [...traceEntries, fullEntry],
			};

			// Track new trace IDs
			const newTraceIds = state.allTraceIds.includes(fullEntry.traceId)
				? state.allTraceIds
				: [...state.allTraceIds, fullEntry.traceId];

			// Auto-set active trace if none set
			const activeTraceId = state.activeTraceId || fullEntry.traceId;

			// Track timing for entries that need duration calculation
			const newPendingTimings = { ...state.pendingTimings };
			if (fullEntry.type === "tool-call" || fullEntry.type === "job-queued") {
				newPendingTimings[fullEntry.toolCallId || fullEntry.jobId || id] = fullEntry.timestamp;
			}

			// Recompute derived state
			const derived = computeDerivedState(newEntriesByTrace, activeTraceId, state.filters);

			return {
				entriesByTrace: newEntriesByTrace,
				allTraceIds: newTraceIds,
				activeTraceId,
				pendingTimings: newPendingTimings,
				...derived,
			};
		});
	},

	updateEntry: (id, updates) => {
		set((state) => {
			let newEntriesByTrace = state.entriesByTrace;
			let found = false;

			for (const traceId of Object.keys(state.entriesByTrace)) {
				const entries = state.entriesByTrace[traceId];
				const index = entries.findIndex((e) => e.id === id);
				if (index !== -1) {
					const updatedEntries = [...entries];
					updatedEntries[index] = { ...updatedEntries[index], ...updates };
					newEntriesByTrace = {
						...state.entriesByTrace,
						[traceId]: updatedEntries,
					};
					found = true;
					break;
				}
			}

			if (!found) return state;

			// Recompute derived state
			const derived = computeDerivedState(newEntriesByTrace, state.activeTraceId, state.filters);

			return { entriesByTrace: newEntriesByTrace, ...derived };
		});
	},

	deleteEntry: (id) => {
		set((state) => {
			let newEntriesByTrace = state.entriesByTrace;
			let found = false;

			for (const traceId of Object.keys(state.entriesByTrace)) {
				const entries = state.entriesByTrace[traceId];
				const index = entries.findIndex((e) => e.id === id);
				if (index !== -1) {
					const updatedEntries = entries.filter((e) => e.id !== id);
					newEntriesByTrace = {
						...state.entriesByTrace,
						[traceId]: updatedEntries,
					};
					found = true;
					break;
				}
			}

			if (!found) return state;

			// Recompute derived state
			const derived = computeDerivedState(newEntriesByTrace, state.activeTraceId, state.filters);

			return { entriesByTrace: newEntriesByTrace, ...derived };
		});
	},

	completeEntry: (id, output, error) => {
		const state = get();
		const startTime = state.pendingTimings[id];
		const duration = startTime ? Date.now() - startTime : undefined;

		set((state) => {
			const newPendingTimings = { ...state.pendingTimings };
			delete newPendingTimings[id];

			let newEntriesByTrace = state.entriesByTrace;
			let found = false;

			for (const traceId of Object.keys(state.entriesByTrace)) {
				const entries = state.entriesByTrace[traceId];
				const index = entries.findIndex((e) => e.toolCallId === id || e.jobId === id || e.id === id);
				if (index !== -1) {
					const updatedEntries = [...entries];
					updatedEntries[index] = {
						...updatedEntries[index],
						duration,
						output,
						error,
					};
					newEntriesByTrace = {
						...state.entriesByTrace,
						[traceId]: updatedEntries,
					};
					found = true;
					break;
				}
			}

			if (!found) {
				return { pendingTimings: newPendingTimings };
			}

			// Recompute derived state
			const derived = computeDerivedState(newEntriesByTrace, state.activeTraceId, state.filters);

			return {
				entriesByTrace: newEntriesByTrace,
				pendingTimings: newPendingTimings,
				...derived,
			};
		});
	},

	setModelInfo: (traceId, modelId, pricing) => {
		set((state) => ({
			modelInfoByTrace: {
				...state.modelInfoByTrace,
				[traceId]: { modelId, pricing },
			},
		}));
	},

	setActiveTrace: (traceId) => {
		set((state) => {
			// Recompute derived state for new active trace
			const derived = computeDerivedState(state.entriesByTrace, traceId, state.filters);
			return { activeTraceId: traceId, selectedEntryId: null, ...derived };
		});
	},

	setFilters: (filters) => {
		set((state) => {
			const newFilters = { ...state.filters, ...filters };
			// Recompute only filteredEntries (activeTraceEntries unchanged)
			const filteredEntries = applyFilters(state.activeTraceEntries, newFilters);
			return { filters: newFilters, filteredEntries };
		});
	},

	setSelectedEntry: (id) => {
		set({ selectedEntryId: id });
	},

	openModal: (entry) => {
		set({ isModalOpen: true, modalEntry: entry });
	},

	closeModal: () => {
		set({ isModalOpen: false, modalEntry: null });
	},

	clearTrace: (traceId) => {
		set((state) => {
			const targetTraceId = traceId || state.activeTraceId;
			if (!targetTraceId) return state;

			const newEntriesByTrace = { ...state.entriesByTrace };
			delete newEntriesByTrace[targetTraceId];

			const newTraceIds = state.allTraceIds.filter((id) => id !== targetTraceId);
			const newActiveTraceId =
				state.activeTraceId === targetTraceId ? newTraceIds[newTraceIds.length - 1] || null : state.activeTraceId;

			// Recompute derived state
			const derived = computeDerivedState(newEntriesByTrace, newActiveTraceId, state.filters);

			return {
				entriesByTrace: newEntriesByTrace,
				allTraceIds: newTraceIds,
				activeTraceId: newActiveTraceId,
				selectedEntryId: null,
				...derived,
			};
		});
	},

	clearAllTraces: () => {
		set({
			entriesByTrace: {},
			allTraceIds: [],
			activeTraceId: null,
			activeTraceEntries: [],
			filteredEntries: [],
			modelInfoByTrace: {},
			pendingTimings: {},
			selectedEntryId: null,
			isModalOpen: false,
			modalEntry: null,
			// Also clear conversation logs when switching sessions
			conversationLogs: [],
			expandedConversationIds: new Set(),
			clearedAt: Date.now(), // Signal to components to clear persisted logs
			persistedWorkingMemory: [],
			persistedDiscoveredTools: [],
			persistedUsedTools: [],
		});
	},

	// Conversation log actions
	loadConversationLogs: (sessionId, logs) => {
		set({
			conversationLogs: logs,
			activeSessionId: sessionId,
			// Auto-expand ALL conversations by default
			expandedConversationIds: new Set(logs.map((l) => l.id)),
		});
	},

	addConversationLog: (log) => {
		set((state) => {
			// Check if this conversation already exists (update it)
			const existingIndex = state.conversationLogs.findIndex((l) => l.id === log.id);
			if (existingIndex !== -1) {
				const newLogs = [...state.conversationLogs];
				newLogs[existingIndex] = log;
				return { conversationLogs: newLogs };
			}
			// Add new conversation - collapse all others, only expand the new one
			return {
				conversationLogs: [...state.conversationLogs, log],
				expandedConversationIds: new Set([log.id]),
			};
		});
	},

	setActiveSession: (sessionId) => {
		set({
			activeSessionId: sessionId,
			// Clear logs when switching sessions - they'll be reloaded
			conversationLogs: sessionId === null ? [] : get().conversationLogs,
			expandedConversationIds: new Set(),
		});
	},

	toggleConversationExpanded: (conversationId) => {
		set((state) => {
			const newExpanded = new Set(state.expandedConversationIds);
			if (newExpanded.has(conversationId)) {
				newExpanded.delete(conversationId);
			} else {
				newExpanded.add(conversationId);
			}
			return { expandedConversationIds: newExpanded };
		});
	},

	setConversationExpanded: (conversationId, expanded) => {
		set((state) => {
			const newExpanded = new Set(state.expandedConversationIds);
			if (expanded) {
				newExpanded.add(conversationId);
			} else {
				newExpanded.delete(conversationId);
			}
			return { expandedConversationIds: newExpanded };
		});
	},

	getConversationLogs: () => {
		const state = get();
		// Just return persisted logs - live traces are added via addConversationLog during streaming
		return state.conversationLogs;
	},

	// Working memory actions
	loadPersistedWorkingMemory: (entities) => {
		set({ persistedWorkingMemory: entities });
	},

	loadPersistedTools: (discoveredTools, usedTools) => {
		set({
			persistedDiscoveredTools: discoveredTools,
			persistedUsedTools: usedTools,
		});
	},

	// Get aggregated metrics across ALL conversation logs
	getTotalMetrics: () => {
		const state = get();
		const totals: TraceMetrics = {
			totalDuration: 0,
			toolCallCount: 0,
			stepCount: 0,
			tokens: { input: 0, output: 0 },
			cost: 0,
			errorCount: 0,
		};

		for (const log of state.conversationLogs) {
			if (log.metrics) {
				totals.totalDuration += log.metrics.totalDuration || 0;
				totals.toolCallCount += log.metrics.toolCallCount || 0;
				totals.stepCount += log.metrics.stepCount || 0;
				totals.tokens.input += log.metrics.tokens?.input || 0;
				totals.tokens.output += log.metrics.tokens?.output || 0;
				totals.cost += log.metrics.cost || 0;
				totals.errorCount += log.metrics.errorCount || 0;
			}
		}

		return totals;
	},

	// Get total event count across all conversations
	getTotalEventCount: () => {
		const state = get();
		return state.conversationLogs.reduce((count, log) => count + (log.entries?.length || 0), 0);
	},

	exportTrace: (traceId) => {
		const state = get();
		const entries = state.entriesByTrace[traceId] || [];
		const metrics = get().getMetrics();

		const exportData = {
			traceId,
			exportedAt: new Date().toISOString(),
			metrics,
			entries: entries.map((e) => ({
				...e,
				timestamp: new Date(e.timestamp).toISOString(),
			})),
		};

		return JSON.stringify(exportData, null, 2);
	},

	copyAllLogs: async () => {
		const state = get();
		const allLogs = state.conversationLogs;

		if (allLogs.length === 0) {
			await navigator.clipboard.writeText("No conversation logs to copy.");
			return;
		}

		// Sort conversations by index
		const sortedLogs = [...allLogs].sort((a, b) => a.conversationIndex - b.conversationIndex);

		// Format a single entry
		const formatEntry = (e: TraceEntry): string => {
			const time = new Date(e.timestamp).toISOString();
			const duration = e.duration ? ` (${e.duration}ms)` : "";
			const tool = e.toolName ? ` [${e.toolName}]` : "";
			const inputStr = e.input
				? `\n  Input: ${JSON.stringify(e.input, null, 2)
						.split("\n")
						.map((l, i) => (i === 0 ? l : "  " + l))
						.join("\n")}`
				: "";
			const outputStr = e.output
				? `\n  Output: ${JSON.stringify(e.output, null, 2)
						.split("\n")
						.map((l, i) => (i === 0 ? l : "  " + l))
						.join("\n")}`
				: "";
			const errorStr = e.error ? `\n  Error: ${e.error.message}` : "";

			return `[${time}] [${e.type}]${tool}${duration}\n  ${e.summary}${inputStr}${outputStr}${errorStr}`;
		};

		// Build the full log text
		const sections: string[] = [];

		// Header
		sections.push(`# Session Logs`);
		sections.push(`Exported: ${new Date().toISOString()}`);
		sections.push(`Total Conversations: ${sortedLogs.length}`);
		sections.push(`Total Events: ${sortedLogs.reduce((sum, log) => sum + (log.entries?.length || 0), 0)}`);
		sections.push("");

		// Track if we've included system prompt
		let systemPromptIncluded = false;

		// Process each conversation
		for (const log of sortedLogs) {
			const entries = log.entries || [];

			// Add conversation header
			sections.push(`${"=".repeat(80)}`);
			sections.push(`## Conversation ${log.conversationIndex + 1}: ${log.userPrompt || "Unknown"}`);
			sections.push(`Started: ${log.startedAt?.toISOString() || "N/A"}`);
			if (log.completedAt) {
				sections.push(`Completed: ${log.completedAt.toISOString()}`);
			}
			if (log.metrics) {
				const m = log.metrics;
				sections.push(
					`Metrics: ${formatDuration(m.totalDuration)} | ${m.toolCallCount} tools | ${m.stepCount} steps | ${m.tokens?.input || 0} in / ${m.tokens?.output || 0} out`
				);
			}
			sections.push(`${"=".repeat(80)}`);
			sections.push("");

			// Process entries
			for (const entry of entries) {
				// Include system prompt only once (first occurrence)
				if (entry.type === "system-prompt") {
					if (!systemPromptIncluded) {
						sections.push(formatEntry(entry));
						sections.push("");
						systemPromptIncluded = true;
					}
					// Skip subsequent system prompts
					continue;
				}

				sections.push(formatEntry(entry));
				sections.push("");
			}
		}

		await navigator.clipboard.writeText(sections.join("\n"));
	},

	// Keep for backward compatibility - returns the computed filteredEntries
	getFilteredEntries: () => {
		return get().filteredEntries;
	},

	getMetrics: () => {
		const state = get();
		const entries = state.entriesByTrace[state.activeTraceId || ""] || [];
		const modelInfo = state.modelInfoByTrace[state.activeTraceId || ""];

		const metrics: TraceMetrics = {
			totalDuration: 0,
			toolCallCount: 0,
			stepCount: 0,
			tokens: { input: 0, output: 0 },
			cost: 0,
			errorCount: 0,
		};

		if (entries.length === 0) return metrics;

		// Calculate total duration from first to last entry
		const firstEntry = entries[0];
		const lastEntry = entries[entries.length - 1];
		metrics.totalDuration = lastEntry.timestamp - firstEntry.timestamp;

		for (const entry of entries) {
			if (entry.type === "tool-call") {
				metrics.toolCallCount++;
			}
			if (entry.type === "step-complete") {
				metrics.stepCount++;
			}
			if (entry.type === "error" || entry.type === "job-failed") {
				metrics.errorCount++;
			}
			// Also count tool-call entries with errors
			if (entry.type === "tool-call" && entry.error) {
				metrics.errorCount++;
			}
			if (entry.tokens) {
				metrics.tokens.input += entry.tokens.input;
				metrics.tokens.output += entry.tokens.output;
			}
		}

		// Calculate cost if we have pricing info
		if (modelInfo?.pricing) {
			const { prompt, completion } = modelInfo.pricing;
			// pricing is $ per million tokens
			metrics.cost = (metrics.tokens.input / 1_000_000) * prompt + (metrics.tokens.output / 1_000_000) * completion;
		}

		return metrics;
	},
}));

// ============================================================================
// Type guard helpers
// ============================================================================

export const ENTRY_TYPE_COLORS: Record<TraceEntryType, string> = {
	"trace-start": "bg-slate-500",
	"prompt-sent": "bg-blue-500",
	"llm-response": "bg-indigo-500",
	"text-streaming": "bg-violet-500",
	"tools-available": "bg-amber-600",
	"model-info": "bg-cyan-600",
	"tool-call": "bg-amber-500",
	"step-start": "bg-emerald-500",
	"step-complete": "bg-emerald-500",
	"approval-request": "bg-orange-500",
	"approval-response": "bg-cyan-500",
	"confirmation-required": "bg-orange-400",
	"job-queued": "bg-yellow-500",
	"job-progress": "bg-blue-400",
	"job-complete": "bg-emerald-500",
	"job-failed": "bg-rose-500",
	"trace-complete": "bg-slate-600",
	error: "bg-red-600",
	// New types
	"working-memory-update": "bg-teal-500",
	"memory-trimmed": "bg-gray-500",
	"checkpoint-saved": "bg-sky-500",
	"retry-attempt": "bg-yellow-600",
	"session-loaded": "bg-violet-500",
	"system-log": "bg-gray-400",
	"system-prompt": "bg-pink-500",
	"user-prompt": "bg-blue-600",
	// Dynamic tool injection
	"tools-discovered": "bg-purple-500",
	"active-tools-changed": "bg-purple-400",
	"instructions-injected": "bg-fuchsia-500",
};

export const ENTRY_TYPE_LABELS: Record<TraceEntryType, string> = {
	"trace-start": "Start",
	"prompt-sent": "Prompt",
	"llm-response": "Response",
	"text-streaming": "Generating",
	"tools-available": "Tools",
	"model-info": "Model",
	"tool-call": "Tool",
	"step-start": "Step",
	"step-complete": "Step Done",
	"approval-request": "Approval",
	"approval-response": "Approved",
	"confirmation-required": "Confirm?",
	"job-queued": "Job Queued",
	"job-progress": "Progress",
	"job-complete": "Job Done",
	"job-failed": "Job Failed",
	"trace-complete": "Complete",
	error: "Error",
	// New types
	"working-memory-update": "Memory",
	"memory-trimmed": "Trimmed",
	"checkpoint-saved": "Checkpoint",
	"retry-attempt": "Retry",
	"session-loaded": "Session",
	"system-log": "Log",
	"system-prompt": "System",
	"user-prompt": "User",
	// Dynamic tool injection
	"tools-discovered": "Discovered",
	"active-tools-changed": "Tools+",
	"instructions-injected": "Instructions",
};

export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	return `${(ms / 60000).toFixed(1)}m`;
}

export function formatTimestamp(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString("en-US", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		fractionalSecondDigits: 3,
	});
}

export function truncateJson(obj: unknown, maxLength: number = 100): string {
	const str = JSON.stringify(obj);
	if (str.length <= maxLength) return str;
	return str.slice(0, maxLength) + "...";
}
