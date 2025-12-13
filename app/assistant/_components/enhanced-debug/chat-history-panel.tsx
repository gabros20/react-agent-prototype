"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { TreeView, type TreeDataItem } from "@/components/tree-view";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChatStore } from "../../_stores/chat-store";
import { useTraceStore } from "../../_stores/trace-store";
import { sessionsApi, type Message } from "@/lib/api/sessions";
import {
	MessageSquare,
	Bot,
	User,
	Settings,
	Wrench,
	Loader2,
	RefreshCw,
	Braces,
	Type,
	List,
	Hash,
	ToggleLeft,
	FileJson,
	Copy,
	Check,
	Scissors,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Role icons and colors
const ROLE_CONFIG: Record<
	string,
	{
		icon: React.ComponentType<{ className?: string }>;
		color: string;
		label: string;
	}
> = {
	system: {
		icon: Settings,
		color: "text-purple-500",
		label: "System",
	},
	user: {
		icon: User,
		color: "text-blue-500",
		label: "User",
	},
	assistant: {
		icon: Bot,
		color: "text-green-500",
		label: "Assistant",
	},
	tool: {
		icon: Wrench,
		color: "text-amber-500",
		label: "Tool",
	},
};

interface ChatHistoryPanelProps {
	className?: string;
}

// Get icon for JSON value type
function getTypeIcon(value: unknown): React.ComponentType<{ className?: string }> {
	if (value === null || value === undefined) return ToggleLeft;
	if (typeof value === "string") return Type;
	if (typeof value === "number") return Hash;
	if (typeof value === "boolean") return ToggleLeft;
	if (Array.isArray(value)) return List;
	if (typeof value === "object") return Braces;
	return FileJson;
}

// Truncate string for display
function truncate(str: string, maxLen = 50): string {
	if (str.length <= maxLen) return str;
	return str.slice(0, maxLen) + "...";
}

// Format value for display in tree node name
function formatValue(value: unknown): string {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (typeof value === "string") {
		return `"${truncate(value, 40)}"`;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (Array.isArray(value)) {
		return `Array(${value.length})`;
	}
	if (typeof value === "object") {
		const keys = Object.keys(value);
		return `{${keys.length} keys}`;
	}
	return String(value);
}

// Separator that won't conflict with UUIDs
const PATH_SEP = "::";

// Recursively convert any JSON value to tree data
function jsonToTreeData(value: unknown, key: string, parentId: string): TreeDataItem {
	const id = `${parentId}${PATH_SEP}${key}`;
	const Icon = getTypeIcon(value);

	// Primitive values - leaf nodes
	if (value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return {
			id,
			name: `${key}: ${formatValue(value)}`,
			icon: Icon,
		};
	}

	// Arrays
	if (Array.isArray(value)) {
		const children = value.map((item, index) => jsonToTreeData(item, `[${index}]`, id));
		return {
			id,
			name: `${key}: Array(${value.length})`,
			icon: List,
			children: children.length > 0 ? children : undefined,
		};
	}

	// Objects
	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>);
		const children = entries.map(([k, v]) => jsonToTreeData(v, k, id));
		return {
			id,
			name: `${key}: {${entries.length} keys}`,
			icon: Braces,
			children: children.length > 0 ? children : undefined,
		};
	}

	return {
		id,
		name: `${key}: ${formatValue(value)}`,
		icon: Icon,
	};
}

// Convert a single message to tree data
function messageToTreeData(msg: Message, index: number): TreeDataItem {
	const config = ROLE_CONFIG[msg.role] || ROLE_CONFIG.user;
	const id = msg.id;

	// Build children from message properties
	const children: TreeDataItem[] = [
		{
			id: `${id}${PATH_SEP}id`,
			name: `id: "${msg.id}"`,
			icon: Type,
		},
		{
			id: `${id}${PATH_SEP}role`,
			name: `role: "${msg.role}"`,
			icon: Type,
		},
		jsonToTreeData(msg.content, "content", id),
		{
			id: `${id}${PATH_SEP}createdAt`,
			name: `createdAt: "${new Date(msg.createdAt).toISOString()}"`,
			icon: Type,
		},
	];

	// Create summary for the message node
	let summary = "";
	if (typeof msg.content === "string") {
		summary = truncate(msg.content, 30);
	} else if (Array.isArray(msg.content)) {
		const types = msg.content.map((p) => p.type).filter(Boolean);
		const uniqueTypes = [...new Set(types)];
		summary = uniqueTypes.join(", ") || `${msg.content.length} parts`;
	} else {
		summary = "{object}";
	}

	return {
		id,
		name: `[${index + 1}] ${config.label}: ${summary}`,
		icon: config.icon,
		className: config.color,
		children,
	};
}

// Convert all messages to tree data
function messagesToTreeData(messages: Message[]): TreeDataItem[] {
	return messages.map((msg, index) => messageToTreeData(msg, index));
}

// Detail View Component - renders a nice formatted view of the selected value
function DetailView({ value }: { value: unknown }) {
	// Check if it's a full message object
	const isMessage = value !== null && typeof value === "object" && "role" in value && "content" in value;

	if (isMessage) {
		const msg = value as Message;
		const config = ROLE_CONFIG[msg.role] || ROLE_CONFIG.user;
		const Icon = config.icon;

		return (
			<div className='p-3 space-y-3'>
				{/* Message Header */}
				<div className='flex items-center gap-2 pb-2 border-b flex-wrap'>
					<Icon className={cn("h-5 w-5 shrink-0", config.color)} />
					<span className='font-medium'>{config.label}</span>
					<Badge variant='outline' className='text-[10px] ml-auto shrink-0'>
						{msg.createdAt ? new Date(msg.createdAt).toLocaleString() : "N/A"}
					</Badge>
				</div>

				{/* Message ID */}
				<div className='text-[10px] text-muted-foreground font-mono break-all'>ID: {msg.id}</div>

				{/* Content */}
				<div className='space-y-2'>
					<ContentView content={msg.content} />
				</div>
			</div>
		);
	}

	// Check if it's an array (like content parts)
	if (Array.isArray(value)) {
		return (
			<div className='p-3 space-y-2'>
				<div className='text-xs font-medium text-muted-foreground mb-2'>Array ({value.length} items)</div>
				{value.map((item, i) => (
					<div key={i} className='space-y-2'>
						<ContentView content={item} />
					</div>
				))}
			</div>
		);
	}

	// Check if it's an object with a type (like a single part)
	if (value !== null && typeof value === "object" && "type" in value) {
		return (
			<div className='p-3 space-y-2'>
				<PartView part={value as Record<string, unknown>} index={0} />
			</div>
		);
	}

	// Check if it's a generic object
	if (value !== null && typeof value === "object") {
		return (
			<div className='p-3 space-y-2'>
				<pre className='text-xs font-mono whitespace-pre-wrap break-all bg-muted/50 p-2 rounded max-h-[60vh] overflow-auto'>
					{formatDataForDisplay(value)}
				</pre>
			</div>
		);
	}

	// Primitive value
	return (
		<div className='p-3'>
			<pre className='text-xs font-mono whitespace-pre-wrap break-all bg-muted/50 p-2 rounded max-h-[calc(100vh-360px)] overflow-auto'>
				{formatDataForDisplay(value)}
			</pre>
		</div>
	);
}

// Try to parse JSON string
function tryParseJson(str: string): unknown {
	if (!str.startsWith("[") && !str.startsWith("{")) return null;
	try {
		return JSON.parse(str);
	} catch {
		return null;
	}
}

// Format data for display - prettify strings, format JSON (same as trace-detail-modal)
function formatDataForDisplay(data: unknown): string {
	if (data === undefined || data === null) return "";

	if (typeof data === "string") {
		// Try to parse as JSON first - if it's stringified JSON, prettify it
		try {
			const parsed = JSON.parse(data);
			if (typeof parsed === "object" && parsed !== null) {
				return JSON.stringify(parsed, null, 2);
			}
		} catch {
			// Not JSON, treat as plain string
		}
		// If it's a plain string, display it with proper line breaks
		return data.replace(/\\n/g, "\n");
	}

	try {
		// For objects, stringify and then unescape \n in string values for readability
		const str = JSON.stringify(data, null, 2);
		return str.replace(/\\n/g, "\n");
	} catch {
		return String(data);
	}
}

// Content View - renders content based on its type
function ContentView({ content }: { content: unknown }) {
	// String content - try to parse as JSON first
	if (typeof content === "string") {
		const parsed = tryParseJson(content);
		if (parsed !== null) {
			// Recursively render the parsed content
			return <ContentView content={parsed} />;
		}

		// Plain string - with scrolling for long content
		return (
			<div className='bg-muted/50 rounded-md p-3 max-h-[60vh] overflow-auto'>
				<pre className='text-xs whitespace-pre-wrap break-all font-mono'>{formatDataForDisplay(content)}</pre>
			</div>
		);
	}

	// Array content (like AI SDK message parts)
	if (Array.isArray(content)) {
		return (
			<div className='space-y-2'>
				{content.map((part, i) => (
					<PartView key={i} part={part} index={i} />
				))}
			</div>
		);
	}

	// Object content
	if (content !== null && typeof content === "object") {
		const obj = content as Record<string, unknown>;

		// Check if it's a known part type
		if ("type" in obj) {
			return <PartView part={obj} index={0} />;
		}

		// Generic object - prettify
		return (
			<div className='bg-muted/50 rounded-md p-3 max-h-[60vh] overflow-auto'>
				<pre className='text-xs whitespace-pre-wrap break-all font-mono'>{formatDataForDisplay(content)}</pre>
			</div>
		);
	}

	// Primitive
	return (
		<div className='bg-muted/50 rounded-md p-2 max-h-[60vh] overflow-auto'>
			<span className='text-xs font-mono break-all'>{formatDataForDisplay(content)}</span>
		</div>
	);
}

// Part View - renders a single message part (text, tool-call, tool-result)
function PartView({ part, index }: { part: Record<string, unknown>; index: number }) {
	const type = part.type as string;

	// Text part
	if (type === "text") {
		return (
			<div className='border rounded-md overflow-hidden'>
				<div className='bg-blue-500/10 px-2 py-1 border-b flex items-center gap-1.5'>
					<Type className='h-3 w-3 text-blue-500 shrink-0' />
					<span className='text-[10px] font-medium text-blue-600'>Text</span>
				</div>
				<div className='p-2 overflow-hidden'>
					<pre className='text-xs whitespace-pre-wrap break-all max-h-96 overflow-auto'>{formatDataForDisplay(part.text)}</pre>
				</div>
			</div>
		);
	}

	// Tool call part
	if (type === "tool-call") {
		// AI SDK v6 uses 'input' for tool call parameters
		const input = part.input;
		// Get all other properties for display
		const { type: _, toolName, toolCallId, input: _i, ...otherProps } = part;

		return (
			<div className='border rounded-md overflow-hidden'>
				<div className='bg-amber-500/10 px-2 py-1 border-b flex items-center gap-1.5 flex-wrap'>
					<Wrench className='h-3 w-3 text-amber-500 shrink-0' />
					<span className='text-[10px] font-medium text-amber-600 truncate'>Tool Call: {toolName as string}</span>
				</div>
				<div className='p-2 space-y-2 overflow-hidden'>
					<div className='text-[10px] text-muted-foreground font-mono break-all'>ID: {toolCallId as string}</div>
					{input !== undefined && (
						<div>
							<div className='text-[10px] text-muted-foreground mb-1'>Input:</div>
							<pre className='text-xs whitespace-pre-wrap break-all font-mono bg-muted/50 p-2 rounded max-h-96 overflow-auto'>
								{formatDataForDisplay(input)}
							</pre>
						</div>
					)}
					{/* Show any other properties */}
					{Object.keys(otherProps).length > 0 && (
						<div>
							<div className='text-[10px] text-muted-foreground mb-1'>Other Data:</div>
							<pre className='text-xs whitespace-pre-wrap break-all font-mono bg-muted/50 p-2 rounded max-h-64 overflow-auto'>
								{formatDataForDisplay(otherProps)}
							</pre>
						</div>
					)}
					{/* Fallback: show full object if no input found */}
					{input === undefined && Object.keys(otherProps).length === 0 && (
						<div>
							<div className='text-[10px] text-muted-foreground mb-1'>Full Data:</div>
							<pre className='text-xs whitespace-pre-wrap break-all font-mono bg-muted/50 p-2 rounded max-h-96 overflow-auto'>
								{formatDataForDisplay(part)}
							</pre>
						</div>
					)}
				</div>
			</div>
		);
	}

	// Tool result part
	if (type === "tool-result") {
		const isError = part.isError === true;
		// Result might be stored under different keys
		const result = part.result ?? part.output ?? part.content ?? part.data;
		// Check for compaction via compactedAt field (from MessageStore)
		const isCompacted = part.compactedAt !== undefined && part.compactedAt !== null;
		// Get all other properties
		const { type: _, toolName, toolCallId, result: _r, output: _o, content: _c, data: _d, isError: _e, compactedAt, ...otherProps } = part;

		// Determine header color based on state
		const headerBg = isCompacted
			? "bg-indigo-500/10"
			: isError
			? "bg-red-500/10"
			: "bg-green-500/10";
		const headerTextColor = isCompacted
			? "text-indigo-600"
			: isError
			? "text-red-600"
			: "text-green-600";
		const iconColor = isCompacted
			? "text-indigo-500"
			: isError
			? "text-red-500"
			: "text-green-500";

		return (
			<div className='border rounded-md overflow-hidden'>
				<div className={cn("px-2 py-1 border-b flex items-center gap-1.5 flex-wrap", headerBg)}>
					{isCompacted ? (
						<Scissors className={cn("h-3 w-3 shrink-0", iconColor)} />
					) : (
						<Wrench className={cn("h-3 w-3 shrink-0", iconColor)} />
					)}
					<span className={cn("text-[10px] font-medium truncate", headerTextColor)}>
						{isCompacted ? "Pruned: " : "Tool Result: "}{toolName as string}
					</span>
					{isCompacted && (
						<span className='text-[9px] text-muted-foreground ml-auto'>
							(output cleared)
						</span>
					)}
				</div>
				<div className='p-2 space-y-2 overflow-hidden'>
					<div className='text-[10px] text-muted-foreground font-mono break-all'>ID: {toolCallId as string}</div>
					{isCompacted ? (
						<div className='text-xs text-muted-foreground italic bg-muted/30 p-2 rounded'>
							Output was pruned to save context space. See conversation summary for details.
						</div>
					) : (
						<>
							{result !== undefined && (
								<div>
									<div className='text-[10px] text-muted-foreground mb-1'>Result:</div>
									<pre className='text-xs whitespace-pre-wrap break-all font-mono bg-muted/50 p-2 rounded max-h-96 overflow-auto'>
										{formatDataForDisplay(result)}
									</pre>
								</div>
							)}
							{/* Show any other properties */}
							{Object.keys(otherProps).length > 0 && (
								<div>
									<div className='text-[10px] text-muted-foreground mb-1'>Other Data:</div>
									<pre className='text-xs whitespace-pre-wrap break-all font-mono bg-muted/50 p-2 rounded max-h-64 overflow-auto'>
										{formatDataForDisplay(otherProps)}
									</pre>
								</div>
							)}
							{/* Fallback */}
							{result === undefined && Object.keys(otherProps).length === 0 && (
								<div>
									<div className='text-[10px] text-muted-foreground mb-1'>Full Data:</div>
									<pre className='text-xs whitespace-pre-wrap break-all font-mono bg-muted/50 p-2 rounded max-h-96 overflow-auto'>
										{formatDataForDisplay(part)}
									</pre>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		);
	}

	// Unknown part type - show as JSON
	return (
		<div className='border rounded-md overflow-hidden'>
			<div className='bg-gray-500/10 px-2 py-1 border-b flex items-center gap-1.5'>
				<Braces className='h-3 w-3 text-gray-500 shrink-0' />
				<span className='text-[10px] font-medium text-gray-600'>{type || "Object"}</span>
			</div>
			<div className='p-2 overflow-hidden'>
				<pre className='text-xs whitespace-pre-wrap break-all font-mono bg-muted/50 p-2 rounded max-h-96 overflow-auto'>
					{formatDataForDisplay(part)}
				</pre>
			</div>
		</div>
	);
}

// System prompt data structure
interface SystemPromptData {
	content: string;
	timestamp: Date;
}

// Trimmed messages data (what was actually sent to LLM)
interface TrimmedMessagesData {
	messages: Message[];
	systemPrompt: string | null;
	timestamp: Date;
	// Metadata from user-prompt event (if messages not available)
	messageCount?: number;
	messageHistoryTokens?: number;
}

// Helper to extract data from trace entries (either from saved logs or real-time store)
function extractFromTraceEntries(
	entries: Array<{ type: string; input?: unknown; output?: unknown; timestamp: number }>,
	latestSystemPrompt: SystemPromptData | null,
	latestTrimmedData: TrimmedMessagesData | null
): { systemPrompt: SystemPromptData | null; trimmedData: TrimmedMessagesData | null } {
	for (const entry of entries) {
		if (!entry || !entry.type) continue;
		const timestamp = new Date(entry.timestamp);
		if (isNaN(timestamp.getTime())) continue;

		// Extract system prompt
		if (entry.type === "system-prompt") {
			let content: string | null = null;
			if (typeof entry.input === "string") {
				content = entry.input;
			} else if (entry.input && typeof (entry.input as { prompt?: string }).prompt === "string") {
				content = (entry.input as { prompt: string }).prompt;
			} else if (typeof entry.output === "string") {
				content = entry.output;
			} else if (entry.output && typeof (entry.output as { prompt?: string }).prompt === "string") {
				content = (entry.output as { prompt: string }).prompt;
			}

			if (content) {
				if (!latestSystemPrompt || timestamp > latestSystemPrompt.timestamp) {
					latestSystemPrompt = { content, timestamp };
				}
			}
		}

		// Extract trimmed messages from llm-context event
		if (entry.type === "llm-context") {
			const outputData = entry.output as {
				messages?: Array<{ role: string; content: unknown }>;
				messageCount?: number;
				tokens?: number;
			} | null;

			if (outputData && Array.isArray(outputData.messages) && outputData.messages.length > 0) {
				if (!latestTrimmedData || timestamp > latestTrimmedData.timestamp) {
					const messagesWithIds: Message[] = outputData.messages.map((m, i) => ({
						id: `llm-${i}-${timestamp.getTime()}`,
						role: m.role as "user" | "assistant" | "system" | "tool",
						content: m.content,
						createdAt: timestamp,
					}));

					latestTrimmedData = {
						messages: messagesWithIds,
						systemPrompt: null,
						timestamp,
						messageCount: outputData.messageCount,
						messageHistoryTokens: outputData.tokens,
					};
				}
			}
		}
	}

	return { systemPrompt: latestSystemPrompt, trimmedData: latestTrimmedData };
}

export function ChatHistoryPanel({ className }: ChatHistoryPanelProps) {
	const sessionId = useChatStore((state) => state.sessionId);
	const isStreaming = useChatStore((state) => state.isStreaming);

	// Get real-time trace entries from the store
	const activeTraceId = useTraceStore((state) => state.activeTraceId);
	const entriesByTrace = useTraceStore((state) => state.entriesByTrace);
	const activeTraceEntries = activeTraceId ? entriesByTrace[activeTraceId] || [] : [];

	const [messages, setMessages] = useState<Message[]>([]);
	const [systemPrompt, setSystemPrompt] = useState<SystemPromptData | null>(null);
	const [trimmedData, setTrimmedData] = useState<TrimmedMessagesData | null>(null);
	const [showTrimmed, setShowTrimmed] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedItem, setSelectedItem] = useState<TreeDataItem | undefined>();
	const [copied, setCopied] = useState(false);
	const prevStreamingRef = useRef(isStreaming);

	// Compute real-time system prompt and trimmed data from current trace
	const realtimeData = useMemo(() => {
		if (activeTraceEntries.length === 0) {
			return { systemPrompt: null, trimmedData: null };
		}
		return extractFromTraceEntries(
			activeTraceEntries.map(e => ({
				type: e.type,
				input: e.input,
				output: e.output,
				timestamp: e.timestamp,
			})),
			null,
			null
		);
	}, [activeTraceEntries]);

	// Merge real-time data with persisted data (real-time takes priority if newer)
	const effectiveSystemPrompt = useMemo(() => {
		if (realtimeData.systemPrompt && systemPrompt) {
			return realtimeData.systemPrompt.timestamp > systemPrompt.timestamp
				? realtimeData.systemPrompt
				: systemPrompt;
		}
		return realtimeData.systemPrompt || systemPrompt;
	}, [realtimeData.systemPrompt, systemPrompt]);

	const effectiveTrimmedData = useMemo(() => {
		if (realtimeData.trimmedData && trimmedData) {
			return realtimeData.trimmedData.timestamp > trimmedData.timestamp
				? realtimeData.trimmedData
				: trimmedData;
		}
		return realtimeData.trimmedData || trimmedData;
	}, [realtimeData.trimmedData, trimmedData]);

	const fetchMessages = useCallback(async () => {
		if (!sessionId) {
			setMessages([]);
			setSystemPrompt(null);
			setTrimmedData(null);
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			// Fetch session messages
			const session = await sessionsApi.get(sessionId);
			setMessages(session.messages);

			// Fetch conversation logs to get system prompt and trimmed messages
			// Note: API client returns data directly, not wrapped in { data: ... }
			const logsRaw = await sessionsApi.getLogs(sessionId);
			const logs = (Array.isArray(logsRaw) ? logsRaw : []) as Array<{
				entries?: Array<{
					type: string;
					input?: unknown;
					output?: unknown;
					timestamp: number;
				}>;
			}>;

			// Find the most recent system-prompt and llm-context entries
			// Note: The system-prompt entry is updated in-place when instructions are injected,
			// so it already contains the full prompt with tool instructions
			let latestSystemPrompt: SystemPromptData | null = null;
			let latestTrimmedData: TrimmedMessagesData | null = null;

			for (const log of logs) {
				if (log.entries && Array.isArray(log.entries)) {
					for (const entry of log.entries) {
						if (!entry || !entry.type) continue;
						const timestamp = new Date(entry.timestamp);
						// Skip if timestamp is invalid
						if (isNaN(timestamp.getTime())) continue;

						// Extract system prompt
						if (entry.type === "system-prompt") {
							// The prompt can be in entry.input (string) or entry.output.prompt (object)
							let content: string | null = null;
							if (typeof entry.input === "string") {
								content = entry.input;
							} else if (entry.input && typeof (entry.input as { prompt?: string }).prompt === "string") {
								content = (entry.input as { prompt: string }).prompt;
							} else if (typeof entry.output === "string") {
								content = entry.output;
							} else if (entry.output && typeof (entry.output as { prompt?: string }).prompt === "string") {
								content = (entry.output as { prompt: string }).prompt;
							}

							if (content) {
								if (!latestSystemPrompt || timestamp > latestSystemPrompt.timestamp) {
									latestSystemPrompt = { content, timestamp };
								}
							}
						}

						// Extract trimmed messages from llm-context event (what was actually sent to LLM)
						if (entry.type === "llm-context") {
							const outputData = entry.output as {
								messages?: Array<{ role: string; content: unknown }>;
								messageCount?: number;
								tokens?: number;
							} | null;

							if (outputData && Array.isArray(outputData.messages) && outputData.messages.length > 0) {
								if (!latestTrimmedData || timestamp > latestTrimmedData.timestamp) {
									// Convert to Message format with generated IDs
									const messagesWithIds: Message[] = outputData.messages.map((m, i) => ({
										id: `llm-${i}-${timestamp.getTime()}`,
										role: m.role as "user" | "assistant" | "system" | "tool",
										content: m.content,
										createdAt: timestamp,
									}));

									latestTrimmedData = {
										messages: messagesWithIds,
										systemPrompt: null, // System prompt is emitted separately
										timestamp,
										messageCount: outputData.messageCount,
										messageHistoryTokens: outputData.tokens,
									};
								}
							}
						}

						// Fallback: Extract from user-prompt if llm-context not available (legacy)
						if (entry.type === "user-prompt" && latestTrimmedData === null) {
							const outputData = entry.output as {
								messages?: Array<{ role: string; content: unknown }>;
								messageCount?: number;
								messageHistoryTokens?: number;
							} | null;

							if (outputData) {
								if (Array.isArray(outputData.messages) && outputData.messages.length > 0) {
									const messagesWithIds: Message[] = outputData.messages.map((m, i) => ({
										id: `trimmed-${i}-${timestamp.getTime()}`,
										role: m.role as "user" | "assistant" | "system" | "tool",
										content: m.content,
										createdAt: timestamp,
									}));

									latestTrimmedData = {
										messages: messagesWithIds,
										systemPrompt: null,
										timestamp,
										messageCount: outputData.messageCount,
										messageHistoryTokens: outputData.messageHistoryTokens,
									};
								} else if (typeof outputData.messageCount === "number") {
									latestTrimmedData = {
										messages: [],
										systemPrompt: null,
										timestamp,
										messageCount: outputData.messageCount,
										messageHistoryTokens: outputData.messageHistoryTokens,
									};
								}
							}
						}

						// Also check legacy prompt-sent entry type (if ever implemented)
						if (entry.type === "prompt-sent") {
							const promptData = entry.input as {
								messages?: Message[];
								system?: string;
							} | null;

							if (promptData && Array.isArray(promptData.messages)) {
								if (!latestTrimmedData || timestamp > latestTrimmedData.timestamp) {
									latestTrimmedData = {
										messages: promptData.messages,
										systemPrompt: typeof promptData.system === "string" ? promptData.system : null,
										timestamp,
									};
								}
							}
						}
					}
				}
			}

			setSystemPrompt(latestSystemPrompt);
			setTrimmedData(latestTrimmedData);
		} catch (e) {
			console.error("Failed to fetch chat history:", e);
			setError("Failed to load chat history");
		} finally {
			setIsLoading(false);
		}
	}, [sessionId]);

	// Fetch on session change
	useEffect(() => {
		fetchMessages();
	}, [fetchMessages]);

	// Refetch when streaming ends
	useEffect(() => {
		if (prevStreamingRef.current && !isStreaming) {
			fetchMessages();
		}
		prevStreamingRef.current = isStreaming;
	}, [isStreaming, fetchMessages]);

	// Check if we have actual trimmed messages or just metadata
	// Use effective values that merge real-time and persisted data
	const hasTrimmedMessages = effectiveTrimmedData && effectiveTrimmedData.messages.length > 0;
	const hasTrimmedMetadataOnly = effectiveTrimmedData && effectiveTrimmedData.messages.length === 0 && typeof effectiveTrimmedData.messageCount === "number";

	// Get the active messages and system prompt based on toggle
	// When showing "Sent to LLM" view:
	// - Use trimmed messages (from llm-context event)
	// - System prompt already contains injected tool instructions (updated in-place by trace-logger)
	const activeMessages = showTrimmed && hasTrimmedMessages ? effectiveTrimmedData.messages : messages;
	const activeSystemPrompt = effectiveSystemPrompt; // Already includes injected instructions if any

	// Copy all chat history to clipboard
	const copyAllHistory = useCallback(async () => {
		const lines: string[] = [];

		// Add header indicating which view
		if (showTrimmed && effectiveTrimmedData) {
			lines.push("=== SENT TO LLM (TRIMMED) ===");
			lines.push(`Captured: ${effectiveTrimmedData.timestamp.toISOString()}`);
			lines.push("");
		}

		// Add system prompt if available
		if (activeSystemPrompt) {
			lines.push("=== SYSTEM PROMPT ===");
			lines.push(`Timestamp: ${activeSystemPrompt.timestamp.toISOString()}`);
			lines.push("");
			lines.push(activeSystemPrompt.content);
			lines.push("");
			lines.push("");
		}

		// Add each message
		lines.push("=== CHAT HISTORY ===");
		lines.push("");

		for (const msg of activeMessages) {
			const roleLabel = (ROLE_CONFIG[msg.role] || ROLE_CONFIG.user).label.toUpperCase();
			lines.push(`--- ${roleLabel} ---`);
			if (msg.id) {
				lines.push(`ID: ${msg.id}`);
			}
			if (msg.createdAt) {
				lines.push(`Time: ${new Date(msg.createdAt).toISOString()}`);
			}
			lines.push("");

			// Format content
			if (typeof msg.content === "string") {
				lines.push(msg.content);
			} else {
				lines.push(formatDataForDisplay(msg.content));
			}

			lines.push("");
			lines.push("");
		}

		const text = lines.join("\n");
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [activeSystemPrompt, activeMessages, showTrimmed, effectiveTrimmedData]);

	// Convert messages to tree structure, including system prompt at the top
	const treeData = useMemo(() => {
		const items: TreeDataItem[] = [];

		// Add system prompt as first item if available
		if (activeSystemPrompt) {
			items.push({
				id: "system-prompt",
				name: `[0] System Prompt (${activeSystemPrompt.timestamp.toLocaleTimeString()})`,
				icon: Settings,
				className: "text-purple-500",
				children: [
					{
						id: "system-prompt::content",
						name: `content: "${truncate(activeSystemPrompt.content, 50)}"`,
						icon: Type,
					},
					{
						id: "system-prompt::timestamp",
						name: `timestamp: "${activeSystemPrompt.timestamp.toISOString()}"`,
						icon: Type,
					},
				],
			});
		}

		// Add messages (offset index by 1 if system prompt exists)
		const messageItems = activeMessages.map((msg, index) => {
			const adjusted = messageToTreeData(msg, activeSystemPrompt ? index + 1 : index);
			// Update the name to reflect the new index
			const config = ROLE_CONFIG[msg.role] || ROLE_CONFIG.user;
			let summary = "";
			if (typeof msg.content === "string") {
				summary = truncate(msg.content, 30);
			} else if (Array.isArray(msg.content)) {
				const types = msg.content.map((p: { type?: string }) => p.type).filter(Boolean);
				const uniqueTypes = [...new Set(types)];
				summary = uniqueTypes.join(", ") || `${msg.content.length} parts`;
			} else {
				summary = "{object}";
			}
			return {
				...adjusted,
				name: `[${activeSystemPrompt ? index + 1 : index}] ${config.label}: ${summary}`,
			};
		});

		items.push(...messageItems);
		return items;
	}, [activeMessages, activeSystemPrompt]);

	// Find the raw value for the selected item (for detail panel)
	const selectedValue = useMemo(() => {
		if (!selectedItem) return null;

		// Handle system prompt selection
		if (selectedItem.id === "system-prompt") {
			return activeSystemPrompt
				? {
						role: "system",
						content: activeSystemPrompt.content,
						timestamp: activeSystemPrompt.timestamp.toISOString(),
				  }
				: null;
		}
		if (selectedItem.id === "system-prompt::content") {
			return activeSystemPrompt?.content || null;
		}
		if (selectedItem.id === "system-prompt::timestamp") {
			return activeSystemPrompt?.timestamp.toISOString() || null;
		}

		// Parse the ID to find the path - split by PATH_SEP (::)
		const parts = selectedItem.id.split(PATH_SEP);
		if (parts.length === 0) return null;

		// First part is the message ID (UUID) or index for trimmed messages
		const msgId = parts[0];
		const msg = activeMessages.find((m) => m.id === msgId);
		if (!msg) return null;

		// If just the message ID, return the whole message
		if (parts.length === 1) {
			return msg;
		}

		// Navigate through the path
		const path = parts.slice(1);
		let current: unknown = msg;

		for (const part of path) {
			if (current === null || current === undefined) break;

			// Handle array indices like [0]
			const arrayMatch = part.match(/^\[(\d+)\]$/);
			if (arrayMatch && Array.isArray(current)) {
				current = current[parseInt(arrayMatch[1], 10)];
				continue;
			}

			// Handle object keys
			if (typeof current === "object" && !Array.isArray(current)) {
				current = (current as Record<string, unknown>)[part];
				continue;
			}

			break;
		}

		return current;
	}, [selectedItem, activeMessages, activeSystemPrompt]);

	if (!sessionId) {
		return (
			<div className={cn("flex items-center justify-center h-full p-8", className)}>
				<div className='text-center text-muted-foreground'>
					<MessageSquare className='h-8 w-8 mx-auto mb-2 opacity-50' />
					<p className='text-sm'>No session selected</p>
					<p className='text-xs mt-1'>Start a conversation to see the message history</p>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className={cn("flex items-center justify-center h-full", className)}>
				<Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
			</div>
		);
	}

	if (error) {
		return (
			<div className={cn("flex flex-col items-center justify-center h-full gap-2", className)}>
				<p className='text-sm text-destructive'>{error}</p>
				<Button variant='outline' size='sm' onClick={fetchMessages}>
					<RefreshCw className='h-3 w-3 mr-1' />
					Retry
				</Button>
			</div>
		);
	}

	if (messages.length === 0) {
		return (
			<div className={cn("flex items-center justify-center h-full p-8", className)}>
				<div className='text-center text-muted-foreground'>
					<MessageSquare className='h-8 w-8 mx-auto mb-2 opacity-50' />
					<p className='text-sm'>No messages yet</p>
					<p className='text-xs mt-1'>Messages will appear as you chat with the agent</p>
				</div>
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Header */}
			<div className='flex items-center justify-between px-3 py-2 border-b bg-muted/30'>
				<div className='flex items-center gap-2'>
					<MessageSquare className='h-4 w-4 text-primary' />
					<span className='text-sm font-medium'>Chat History</span>
				</div>
				<div className='flex items-center gap-2'>
					{/* Trimmed toggle */}
					<div className='flex items-center gap-1.5'>
						<Switch
							id='show-trimmed'
							checked={showTrimmed}
							onCheckedChange={setShowTrimmed}
							disabled={!hasTrimmedMessages}
							className='h-4 w-7'
						/>
						<Label
							htmlFor='show-trimmed'
							className={cn(
								"text-xs cursor-pointer flex items-center gap-1",
								showTrimmed && hasTrimmedMessages ? "text-amber-600" : "text-muted-foreground",
								!hasTrimmedMessages && "opacity-50 cursor-not-allowed"
							)}
							title={
								hasTrimmedMetadataOnly
									? `Last LLM call used ${effectiveTrimmedData?.messageCount} messages (${effectiveTrimmedData?.messageHistoryTokens?.toLocaleString()} tokens)`
									: hasTrimmedMessages
									? `Show actual messages sent to LLM (${effectiveTrimmedData?.messageCount} msgs, ${effectiveTrimmedData?.messageHistoryTokens?.toLocaleString()} tokens)`
									: "No LLM context data available yet"
							}
						>
							<Scissors className='h-3 w-3' />
							<span className='hidden sm:inline'>Sent to LLM</span>
							{hasTrimmedMessages && effectiveTrimmedData && (
								<span className='text-[10px] text-muted-foreground'>({effectiveTrimmedData.messageCount})</span>
							)}
						</Label>
					</div>

					<div className='h-4 w-px bg-border' />

					<Badge variant={showTrimmed && hasTrimmedMessages ? "default" : "secondary"} className={cn("text-xs", showTrimmed && hasTrimmedMessages && "bg-amber-500")}>
						{activeSystemPrompt ? activeMessages.length + 1 : activeMessages.length} messages
					</Badge>
					{activeSystemPrompt && (
						<Badge variant='outline' className='text-xs text-purple-500 border-purple-500/30'>
							+ system
						</Badge>
					)}
					<Button variant='ghost' size='sm' className='h-6 px-2 text-xs' onClick={copyAllHistory} title='Copy all history'>
						{copied ? <Check className='h-3 w-3 mr-1' /> : <Copy className='h-3 w-3 mr-1' />}
						{copied ? "Copied" : "Copy All"}
					</Button>
					<Button variant='ghost' size='sm' className='h-6 w-6 p-0' onClick={fetchMessages} title='Refresh'>
						<RefreshCw className='h-3 w-3' />
					</Button>
				</div>
			</div>

			{/* Tree View + Detail Panel */}
			<div className='flex-1 flex min-h-0 overflow-hidden'>
				{/* Tree */}
				<ScrollArea className='w-[45%] min-w-[200px] border-r shrink-0'>
					<TreeView data={treeData} expandAll={false} onSelectChange={setSelectedItem} className='text-xs p-1' />
				</ScrollArea>

				{/* Detail Panel */}
				<div className='flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden'>
					<div className='px-3 py-2 border-b bg-muted/30 shrink-0'>
						<span className='text-xs font-medium text-muted-foreground'>
							{selectedItem ? "Details" : "Select a node to view details"}
						</span>
					</div>
					<ScrollArea className='flex-1'>
						{selectedValue !== null && selectedValue !== undefined ? (
							<DetailView value={selectedValue} />
						) : (
							<div className='p-3 text-xs text-muted-foreground'>Click on a tree node to view its value</div>
						)}
					</ScrollArea>
				</div>
			</div>
		</div>
	);
}
