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
│  │  chatStore  │←───→│  useSession │      │  DebugPanel │         │
│  │  traceStore │     │  useWorker  │      │  Sidebar    │         │
│  │  sessionStr │     │             │      │             │         │
│  │  modelsStr  │     │             │      │             │         │
│  └─────────────┘     └─────────────┘      └─────────────┘         │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    SSE Stream                               │  │
│  │                                                             │  │
│  │   Events: text-delta, tool-call, tool-result, step-start,   │  │
│  │           step-finish, result, error, log, done             │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File                                | Purpose                |
| ----------------------------------- | ---------------------- |
| `app/assistant/page.tsx`            | Main chat interface    |
| `app/assistant/_components/`        | UI components          |
| `app/assistant/_hooks/use-agent.ts` | SSE stream handling    |
| `app/assistant/_hooks/sse-handlers.ts` | Event processing helpers |
| `app/assistant/_stores/`            | Zustand state          |
| `lib/api/`                          | API client layer       |
| `lib/debug-logger/`                 | Debug logging abstraction |

---

## Zustand Stores

### ChatStore

Manages conversation state with separate streaming message handling:

```typescript
// app/assistant/_stores/chat-store.ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

export interface StreamingMessage {
  id: string;
  content: string;
}

export interface AgentStatus {
  state: 'thinking' | 'tool-call';
  toolName?: string;
}

interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  streamingMessage: StreamingMessage | null; // Currently streaming message
  currentTraceId: string | null;
  isStreaming: boolean;
  agentStatus: AgentStatus | null;

  // Session management
  setSessionId: (sessionId: string | null) => void;

  // Message management
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;

  // Streaming message management (separated from persisted messages)
  startStreamingMessage: (id: string) => void;
  appendToStreamingMessage: (delta: string) => void;
  finalizeStreamingMessage: () => void;
  clearStreamingMessage: () => void;

  // Status management
  setCurrentTraceId: (traceId: string | null) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setAgentStatus: (status: AgentStatus | null) => void;

  reset: () => void;
}

// No localStorage persistence - DB is single source of truth
export const useChatStore = create<ChatState>()((set, get) => ({
  // ... implementation
}));
```

**Key Pattern:** Streaming messages are kept separate from persisted messages. Text deltas append to `streamingMessage`, then finalization moves it to `messages` array.

### SessionStore

Manages session list using the API client layer:

```typescript
// app/assistant/_stores/session-store.ts
import { sessionsApi } from '@/lib/api';

interface SessionState {
  sessions: Session[];
  isLoading: boolean;

  // Actions (all use lib/api layer)
  loadSessions: () => Promise<void>;
  createSession: (title?: string) => Promise<Session>;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  isLoading: false,

  loadSessions: async () => {
    set({ isLoading: true });
    const sessions = await sessionsApi.list();
    set({ sessions, isLoading: false });
  },

  createSession: async (title) => {
    const session = await sessionsApi.create(title);
    set(state => ({ sessions: [session, ...state.sessions] }));
    return session;
  },

  // ... other actions using sessionsApi
}));
```

**Key Pattern:** All API calls go through `lib/api/sessions.ts` - no inline `fetch()` in stores.

### TraceStore

Tracks execution traces and conversation logs:

```typescript
// app/assistant/_stores/trace-store.ts
interface TraceEntry {
	id: string;
	traceId: string;
	type: TraceEntryType;
	timestamp: number;
	level?: "info" | "warn" | "error";
	summary?: string;
	// ... additional fields per type
}

interface TraceState {
	entriesByTrace: Map<string, TraceEntry[]>;
	addEntry: (entry: TraceEntry) => void;
	updateEntry: (id: string, updates: Partial<TraceEntry>) => void;
	completeEntry: (id: string, result: unknown) => void;
	getMetrics: () => TraceMetrics;
}
```

### Debug Logger (lib/debug-logger)

Abstraction for trace logging:

```typescript
import { debugLogger } from "@/lib/debug-logger";

// Scoped trace logging
const trace = debugLogger.trace(traceId);
trace.toolCall("cms_getPage", args, callId);
trace.toolResult(callId, result);
trace.complete({ metrics });

// Quick logging
debugLogger.info("Event occurred", { data });
```

---

## Hooks

### useAgent

Core hook for agent communication with modular SSE handlers:

```typescript
// app/assistant/_hooks/use-agent.ts
import { agentApi } from '@/lib/api';
import { handleSSEEvent } from './sse-handlers';

export function useAgent() {
  const { sessionId, startStreamingMessage, appendToStreamingMessage,
          finalizeStreamingMessage, setIsStreaming, setAgentStatus } = useChatStore();
  const { addEntry, completeEntry, setMetrics } = useTraceStore();

  const sendMessage = async (userMessage: string, options?: AgentOptions) => {
    // Add user message
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      createdAt: new Date(),
    });

    setIsStreaming(true);
    startStreamingMessage(crypto.randomUUID());

    try {
      // Use API client layer (handles SSE parsing internally)
      const stream = await agentApi.stream({
        sessionId,
        prompt: userMessage,
        modelId: options?.modelId,
      });

      // Process SSE events
      for await (const event of stream) {
        handleSSEEvent(event, {
          onTextDelta: (text) => appendToStreamingMessage(text),
          onToolCall: (toolName, args, callId) => {
            setAgentStatus({ state: 'tool-call', toolName });
            addEntry({ type: 'tool-call', toolName, toolCallId: callId, input: args });
          },
          onToolResult: (callId, result) => {
            completeEntry(callId, result);
          },
          onFinish: (metrics) => {
            finalizeStreamingMessage();
            setMetrics(metrics);
          },
        });
      }
    } finally {
      setIsStreaming(false);
      setAgentStatus(null);
    }
  };

  return { sendMessage };
}
```

**SSE Handlers Pattern:** Event processing is extracted to `sse-handlers.ts` for cleaner separation and testability.

```typescript
// app/assistant/_hooks/sse-handlers.ts
export function handleSSEEvent(event: AgentEvent, handlers: SSEHandlers) {
  switch (event.type) {
    case 'text-delta':
      handlers.onTextDelta(event.text);
      break;
    case 'tool-call':
      handlers.onToolCall(event.toolName, event.args, event.toolCallId);
      break;
    case 'tool-result':
      handlers.onToolResult(event.toolCallId, event.result);
      break;
    case 'finish':
      handlers.onFinish(event.metrics);
      break;
    // ... other events
  }
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

### EnhancedDebugPanel

LangSmith-inspired trace observability panel:

```tsx
// app/assistant/_components/enhanced-debug/index.tsx
export function EnhancedDebugPanel() {
	const { getFilteredEntries, getMetrics, conversationLogs } = useTraceStore();
	const entries = getFilteredEntries();
	const metrics = getMetrics();

	return (
		<div className='h-full flex flex-col'>
			{/* Header with metrics */}
			<TraceHeader metrics={metrics} />

			{/* Filters */}
			<TraceFilters />

			{/* Conversation logs (collapsible) */}
			<ConversationAccordion logs={conversationLogs} />

			{/* Current trace timeline */}
			<TraceTimeline entries={entries} />
		</div>
	);
}
```

**HITL Confirmation:** Handled conversationally via chat - no modal. Tools with `confirmed` flag return `requiresConfirmation: true`, agent asks user in chat, user responds "yes", tool re-called with `confirmed: true`.

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

## API Client Layer

All API calls go through the `lib/api/` layer - no inline `fetch()` in stores/hooks:

```typescript
// lib/api/index.ts
export { sessionsApi } from './sessions';
export { agentApi } from './agent';

// lib/api/sessions.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export const sessionsApi = {
  list: async () => {
    const res = await fetch(`${BASE_URL}/v1/sessions`);
    return res.json();
  },

  create: async (title?: string) => {
    const res = await fetch(`${BASE_URL}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    return res.json();
  },

  getMessages: async (sessionId: string) => {
    const res = await fetch(`${BASE_URL}/v1/sessions/${sessionId}/messages`);
    return res.json();
  },

  delete: async (sessionId: string) => {
    await fetch(`${BASE_URL}/v1/sessions/${sessionId}`, { method: 'DELETE' });
  },
};

// lib/api/agent.ts
export const agentApi = {
  stream: async function* (options: AgentOptions) {
    const response = await fetch(`${BASE_URL}/v1/agent/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        yield JSON.parse(line.slice(6));
      }
    }
  },
};
```

**Key Pattern:** Generator function for SSE streaming allows `for await...of` consumption.

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
				<div className='w-96 border-l'>
					<EnhancedDebugPanel />
				</div>
			</main>
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
