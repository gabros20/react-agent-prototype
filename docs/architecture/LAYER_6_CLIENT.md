# Layer 6: Client Layer

> Next.js frontend, React components, state management, and SSE handling

## Overview

The client layer is a Next.js 16 application with React 19. It provides the chat interface for interacting with the AI agent, handles SSE streaming, and manages state via Zustand stores.

**Location:** `app/`
**Port:** 3000
**Main Interface:** `/assistant`

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                       Client Layer                                │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                     Next.js App                             │  │
│  │                   (App Router)                              │  │
│  │  app/                                                       │  │
│  │                                                             │  │
│  │  ├── page.tsx          (Landing)                            │  │
│  │  ├── assistant/        (Chat UI)                            │  │
│  │  │   ├── page.tsx                                           │  │
│  │  │   ├── _components/                                       │  │
│  │  │   ├── _hooks/                                            │  │
│  │  │   └── _stores/                                           │  │
│  │  └── api/              (Route handlers → Express)           │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│         ┌────────────────────┼────────────────────┐               │
│         ▼                    ▼                    ▼               │
│  ┌─────────────┐     ┌─────────────┐      ┌─────────────┐         │
│  │   Zustand   │     │    Hooks    │      │ Components  │         │
│  │   Stores    │     │             │      │             │         │
│  │             │     │  useAgent   │      │  ChatPane   │         │
│  │  chatStore  │←───→│  useSession │      │  DebugPane  │         │
│  │  logStore   │     │             │      │  HITLModal  │         │
│  │  sessionStr │     │             │      │  Sidebar    │         │
│  │  approvalStr│     │             │      │             │         │
│  └─────────────┘     └─────────────┘      └─────────────┘         │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    SSE Stream                               │  │
│  │                                                             │  │
│  │   Events: text-delta, tool-call, tool-result,               │  │
│  │           approval-required, log, finish                    │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File                                | Purpose             |
| ----------------------------------- | ------------------- |
| `app/assistant/page.tsx`            | Main chat interface |
| `app/assistant/_components/`        | UI components       |
| `app/assistant/_hooks/use-agent.ts` | SSE stream handling |
| `app/assistant/_stores/`            | Zustand state       |
| `app/api/agent/route.ts`            | Proxy to Express    |

---

## Zustand Stores

### ChatStore

Manages conversation state:

```typescript
// app/assistant/_stores/chat-store.ts
interface ChatState {
	sessionId: string | null;
	messages: Message[];
	isStreaming: boolean;
	traceId: string | null;

	// Actions
	setSessionId: (id: string) => void;
	addMessage: (message: Message) => void;
	updateLastMessage: (content: string) => void;
	setStreaming: (streaming: boolean) => void;
	clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
	sessionId: null,
	messages: [],
	isStreaming: false,
	traceId: null,

	setSessionId: (id) => set({ sessionId: id }),

	addMessage: (message) =>
		set((state) => ({
			messages: [...state.messages, message],
		})),

	updateLastMessage: (content) =>
		set((state) => {
			const messages = [...state.messages];
			const last = messages[messages.length - 1];
			if (last?.role === "assistant") {
				last.content += content;
			}
			return { messages };
		}),

	setStreaming: (streaming) => set({ isStreaming: streaming }),

	clearMessages: () => set({ messages: [] }),
}));
```

### SessionStore

Manages session list:

```typescript
// app/assistant/_stores/session-store.ts
interface SessionState {
	sessions: Session[];
	activeSessionId: string | null;

	loadSessions: () => Promise<void>;
	createSession: () => Promise<Session>;
	switchSession: (id: string) => void;
	deleteSession: (id: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
	sessions: [],
	activeSessionId: null,

	loadSessions: async () => {
		const res = await fetch("/api/sessions");
		const sessions = await res.json();
		set({ sessions });
	},

	createSession: async () => {
		const res = await fetch("/api/sessions", { method: "POST" });
		const session = await res.json();
		set((state) => ({
			sessions: [session, ...state.sessions],
			activeSessionId: session.id,
		}));
		return session;
	},

	switchSession: (id) => {
		set({ activeSessionId: id });
		useChatStore.getState().setSessionId(id);
	},
}));
```

### LogStore

Tracks execution logs:

```typescript
// app/assistant/_stores/log-store.ts
interface LogEntry {
	id: string;
	level: "info" | "warn" | "error";
	message: string;
	timestamp: number;
	traceId?: string;
	data?: unknown;
}

interface LogState {
	logs: LogEntry[];
	addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
	clearLogs: () => void;
	getByTraceId: (traceId: string) => LogEntry[];
}
```

### ApprovalStore

Manages HITL approvals:

```typescript
// app/assistant/_stores/approval-store.ts
interface ApprovalState {
	pendingApproval: PendingApproval | null;
	setPendingApproval: (approval: PendingApproval | null) => void;
	submitApproval: (approvalId: string, approved: boolean) => Promise<void>;
}

export const useApprovalStore = create<ApprovalState>((set) => ({
	pendingApproval: null,

	setPendingApproval: (approval) => set({ pendingApproval: approval }),

	submitApproval: async (approvalId, approved) => {
		await fetch("/api/agent/approve", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ approvalId, approved }),
		});
		set({ pendingApproval: null });
	},
}));
```

---

## Hooks

### useAgent

Core hook for agent communication:

```typescript
// app/assistant/_hooks/use-agent.ts
export function useAgent() {
	const { sessionId, addMessage, updateLastMessage, setStreaming } = useChatStore();
	const { addLog } = useLogStore();
	const { setPendingApproval } = useApprovalStore();

	const sendMessage = async (content: string) => {
		// Add user message
		addMessage({ role: "user", content });
		addMessage({ role: "assistant", content: "" });
		setStreaming(true);

		try {
			const response = await fetch("/api/agent", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionId, message: content }),
			});

			const reader = response.body?.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const { done, value } = await reader!.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split("\n");

				for (const line of lines) {
					if (!line.startsWith("data: ")) continue;
					const data = JSON.parse(line.slice(6));

					handleEvent(data);
				}
			}
		} finally {
			setStreaming(false);
		}
	};

	const handleEvent = (event: AgentEvent) => {
		switch (event.type) {
			case "text-delta":
				updateLastMessage(event.text);
				break;

			case "tool-call":
				addLog({
					level: "info",
					message: `Calling ${event.toolName}`,
					data: event.args,
				});
				break;

			case "tool-result":
				addLog({
					level: "info",
					message: `${event.toolName} result`,
					data: event.result,
				});
				break;

			case "approval-required":
				setPendingApproval({
					id: event.approvalId,
					toolName: event.toolName,
					message: event.message,
					args: event.args,
				});
				break;

			case "log":
				addLog({
					level: event.level,
					message: event.message,
					data: event.data,
				});
				break;

			case "finish":
				// Streaming complete
				break;
		}
	};

	return { sendMessage };
}
```

---

## Components

### ChatPane

Main chat interface:

```tsx
// app/assistant/_components/chat-pane.tsx
export function ChatPane() {
	const { messages, isStreaming } = useChatStore();
	const { sendMessage } = useAgent();
	const [input, setInput] = useState("");

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isStreaming) return;
		sendMessage(input);
		setInput("");
	};

	return (
		<div className='flex flex-col h-full'>
			{/* Message List */}
			<div className='flex-1 overflow-y-auto p-4 space-y-4'>
				{messages.map((msg, i) => (
					<MessageBubble key={i} message={msg} />
				))}
				{isStreaming && <TypingIndicator />}
			</div>

			{/* Input */}
			<form onSubmit={handleSubmit} className='p-4 border-t'>
				<div className='flex gap-2'>
					<input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder='Type a message...'
						className='flex-1 px-4 py-2 border rounded-lg'
						disabled={isStreaming}
					/>
					<button type='submit' disabled={isStreaming} className='px-4 py-2 bg-blue-500 text-white rounded-lg'>
						Send
					</button>
				</div>
			</form>
		</div>
	);
}
```

### HITLModal

Approval dialog:

```tsx
// app/assistant/_components/hitl-modal.tsx
export function HITLModal() {
	const { pendingApproval, submitApproval } = useApprovalStore();

	if (!pendingApproval) return null;

	return (
		<Dialog open>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Confirmation Required</DialogTitle>
				</DialogHeader>

				<p>{pendingApproval.message}</p>

				<pre className='bg-gray-100 p-2 rounded text-sm'>{JSON.stringify(pendingApproval.args, null, 2)}</pre>

				<DialogFooter>
					<Button variant='outline' onClick={() => submitApproval(pendingApproval.id, false)}>
						Cancel
					</Button>
					<Button variant='destructive' onClick={() => submitApproval(pendingApproval.id, true)}>
						Confirm
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
```

### DebugPane

Execution logs viewer:

```tsx
// app/assistant/_components/debug-pane.tsx
export function DebugPane() {
	const { logs } = useLogStore();

	return (
		<div className='h-full overflow-y-auto p-4 font-mono text-sm'>
			{logs.map((log) => (
				<div key={log.id} className={cn("py-1", levelColors[log.level])}>
					<span className='text-gray-500'>{new Date(log.timestamp).toISOString().slice(11, 23)}</span>{" "}
					<span className='font-bold'>[{log.level}]</span> {log.message}
					{log.data && <pre className='ml-4 text-xs'>{JSON.stringify(log.data, null, 2)}</pre>}
				</div>
			))}
		</div>
	);
}
```

### SessionSidebar

Session list:

```tsx
// app/assistant/_components/session-sidebar.tsx
export function SessionSidebar() {
	const { sessions, activeSessionId, createSession, switchSession } = useSessionStore();

	return (
		<aside className='w-64 border-r h-full flex flex-col'>
			<div className='p-4 border-b'>
				<Button onClick={createSession} className='w-full'>
					New Chat
				</Button>
			</div>

			<div className='flex-1 overflow-y-auto'>
				{sessions.map((session) => (
					<SessionItem
						key={session.id}
						session={session}
						active={session.id === activeSessionId}
						onClick={() => switchSession(session.id)}
					/>
				))}
			</div>
		</aside>
	);
}
```

---

## API Routes

Next.js routes proxy to Express:

```typescript
// app/api/agent/route.ts
export async function POST(request: Request) {
	const body = await request.json();

	const response = await fetch("http://localhost:8787/v1/agent/stream", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

	// Forward SSE stream
	return new Response(response.body, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
}
```

---

## Page Layout

```tsx
// app/assistant/page.tsx
export default function AssistantPage() {
	return (
		<div className='flex h-screen'>
			<SessionSidebar />

			<main className='flex-1 flex'>
				<div className='flex-1'>
					<ChatPane />
				</div>
				<div className='w-80 border-l'>
					<DebugPane />
				</div>
			</main>

			<HITLModal />
		</div>
	);
}
```

---

## SSE Event Flow

```
User types message
       ↓
useAgent.sendMessage()
       ↓
POST /api/agent → Express /v1/agent/stream
       ↓
SSE stream begins
       ↓
Parse events: text-delta, tool-call, tool-result, etc.
       ↓
Update stores: chatStore, logStore, approvalStore
       ↓
React re-renders components
```

---

## Integration Points

| Connects To      | How                    |
| ---------------- | ---------------------- |
| Layer 1 (Server) | API routes proxy       |
| Layer 3 (Agent)  | SSE stream consumption |

---

## Deep Dive Topics

-   SSE reconnection strategies
-   Optimistic UI updates
-   Message persistence
-   Keyboard shortcuts
-   Mobile responsiveness
-   Accessibility (a11y)
