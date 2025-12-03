# Layer 6.1: State Management

> Zustand stores, persistence middleware, state shape, cross-store coordination
>
> **Updated**: 2025-12-03

## Overview

State management in the client layer uses Zustand stores with optional localStorage persistence. Each store manages a specific domain: chat messages, sessions, traces, and execution logs. Stores are independent but coordinate through component-level composition.

**Key Responsibilities:**
- Define typed state shape per domain
- Persist critical state to localStorage
- Provide actions for state mutations
- Enable cross-store data flow via hooks
- Handle state reset and cleanup

---

## The Problem

Without proper state management:

```typescript
// WRONG: Props drilling through many components
<App messages={messages} setMessages={setMessages} sessionId={sessionId} ... />

// WRONG: Untyped global state
window.chatState = { messages: [] };  // No type safety

// WRONG: State lost on refresh
const [messages, setMessages] = useState([]);  // Gone on F5

// WRONG: Inconsistent state updates
setMessages(prev => [...prev, msg]);  // Race conditions
setSession(prev => ({ ...prev, messageCount: prev.messageCount + 1 }));
```

**Our Solution:**
1. Zustand stores for each domain (chat, session, trace, log)
2. TypeScript interfaces for state shape
3. Persist middleware for critical state
4. Actions co-located with state
5. Selectors for optimized re-renders

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZUSTAND STORES                               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    chat-store                             │  │
│  │                                                           │  │
│  │  State:                                                   │  │
│  │  ├─ sessionId: string | null                              │  │
│  │  ├─ messages: ChatMessage[]                               │  │
│  │  ├─ currentTraceId: string | null                         │  │
│  │  ├─ isStreaming: boolean                                  │  │
│  │  └─ agentStatus: { state, toolName? } | null              │  │
│  │                                                           │  │
│  │  Actions:                                                 │  │
│  │  ├─ setSessionId() / setAgentStatus()                     │  │
│  │  ├─ setMessages() / addMessage()                          │  │
│  │  └─ reset()                                               │  │
│  │                                                           │  │
│  │  Persistence: localStorage (last 50 messages)             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   session-store                           │  │
│  │                                                           │  │
│  │  State:                                                   │  │
│  │  ├─ sessions: SessionMetadata[]                           │  │
│  │  ├─ currentSessionId: string | null                       │  │
│  │  ├─ isLoading: boolean                                    │  │
│  │  └─ error: string | null                                  │  │
│  │                                                           │  │
│  │  Actions:                                                 │  │
│  │  ├─ loadSessions() / loadSession()                        │  │
│  │  ├─ loadConversationLogs()                                │  │
│  │  └─ deleteSession() / clearHistory()                      │  │
│  │                                                           │  │
│  │  Persistence: None (fetched from backend)                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   trace-store                             │  │
│  │                                                           │  │
│  │  State:                                                   │  │
│  │  ├─ entriesByTrace: Map<string, TraceEntry[]>             │  │
│  │  ├─ conversationLogs: ConversationLog[]                   │  │
│  │  ├─ modelInfoByTrace: Map<string, {modelId, pricing}>     │  │
│  │  ├─ filters: TraceFilters                                 │  │
│  │  └─ expandedConversationIds: Set<string>                  │  │
│  │                                                           │  │
│  │  Actions:                                                 │  │
│  │  ├─ addEntry() / updateEntry() / completeEntry()          │  │
│  │  ├─ addConversationLog() / loadConversationLogs()         │  │
│  │  ├─ getMetrics() / getTotalMetrics()                      │  │
│  │  └─ copyAllLogs() / exportTrace()                         │  │
│  │                                                           │  │
│  │  Persistence: None (real-time only)                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `app/assistant/_stores/chat-store.ts` | Chat messages, sessionId, streaming state, agentStatus |
| `app/assistant/_stores/session-store.ts` | Session list, conversation logs, CRUD operations |
| `app/assistant/_stores/trace-store.ts` | Trace entries, conversation logs, metrics, cost tracking |
| `app/assistant/_stores/models-store.ts` | OpenRouter models list, caching |

---

## Core Implementation

### Chat Store (Persisted)

```typescript
// app/assistant/_stores/chat-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  currentTraceId: string | null;
  isStreaming: boolean;
  setSessionId: (sessionId: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setCurrentTraceId: (traceId: string | null) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessionId: null,
      messages: [],
      currentTraceId: null,
      isStreaming: false,
      setSessionId: (sessionId) => set({ sessionId }),
      setMessages: (messages) => set({ messages }),
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      setCurrentTraceId: (traceId) => set({ currentTraceId: traceId }),
      setIsStreaming: (isStreaming) => set({ isStreaming }),
      reset: () => set({ messages: [], currentTraceId: null, isStreaming: false }),
    }),
    {
      name: 'chat-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        messages: state.messages.slice(-50), // Keep last 50 messages
      }),
    }
  )
);
```

### Session Store (API-Backed)

```typescript
// app/assistant/_stores/session-store.ts
export interface SessionMetadata {
  id: string;
  title: string;
  messageCount: number;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionState {
  sessions: SessionMetadata[];
  currentSessionId: string | null;
  isLoading: boolean;
  error: string | null;
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<Session | null>;
  createSession: (title?: string) => Promise<string>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearHistory: (sessionId: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  sessions: [],
  currentSessionId: null,
  isLoading: false,
  error: null,

  loadSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      // Parse date strings to Date objects
      const sessions = data.sessions.map((s: any) => ({
        ...s,
        lastActivity: new Date(s.lastActivity),
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      }));
      set({ sessions, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load sessions', isLoading: false });
    }
  },

  clearHistory: async (sessionId) => {
    await fetch(`/api/sessions/${sessionId}/messages`, { method: 'DELETE' });
    await fetch(`/api/sessions/${sessionId}/checkpoint`, { method: 'DELETE' });
    // Refresh sessions list
    await get().loadSessions();
  },
}));
```

### Trace Store

The trace store has been significantly expanded to support conversation logs and cost tracking:

```typescript
// app/assistant/_stores/trace-store.ts

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
  isLive?: boolean; // True if currently streaming
}

export interface TraceMetrics {
  totalDuration: number;
  toolCallCount: number;
  stepCount: number;
  tokens: { input: number; output: number };
  cost: number; // Calculated cost in $
  errorCount: number;
}

export interface ModelPricing {
  prompt: number; // $ per million tokens
  completion: number; // $ per million tokens
}

// Entry types for comprehensive debugging
export type TraceEntryType =
  | "trace-start"
  | "system-prompt" | "user-prompt" | "llm-response" | "text-streaming"
  | "tools-available" | "model-info"
  | "tool-call" | "tool-error" | "confirmation-required"
  | "step-start" | "step-complete"
  | "job-queued" | "job-progress" | "job-complete" | "job-failed"
  | "working-memory-update" | "memory-trimmed" | "session-loaded"
  | "retry-attempt" | "checkpoint-saved" | "system-log" | "error";

// Completion is detected via completedAt !== null on ConversationLog
```

**Key Additions:**
- **ConversationLog**: Persisted exchange history with metrics
- **ModelPricing**: Cost tracking per model
- **TraceMetrics**: Aggregated stats (tokens, cost, duration)
- **20+ entry types** for comprehensive debugging

**New Actions:**
```typescript
// Conversation log management
loadConversationLogs: (sessionId: string, logs: ConversationLog[]) => void;
addConversationLog: (log: ConversationLog) => void;
setActiveSession: (sessionId: string | null) => void;
toggleConversationExpanded: (conversationId: string) => void;

// Metrics
getMetrics: () => TraceMetrics;      // Current trace
getTotalMetrics: () => TraceMetrics; // All conversations
getTotalEventCount: () => number;

// Export
copyAllLogs: () => Promise<void>;    // Copy all to clipboard
```

---

## Design Decisions

### Why Zustand Over Redux/Context?

```typescript
// Zustand: Simple, minimal boilerplate
const useStore = create((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
}));

// vs Redux: More ceremony
const slice = createSlice({
  name: 'counter',
  initialState: { count: 0 },
  reducers: { inc: (s) => { s.count++ } },
});
```

**Reasons:**
1. **Less boilerplate** - No providers, reducers, action creators
2. **No Context re-render issues** - Subscription-based
3. **TypeScript-first** - Excellent inference
4. **Middleware support** - persist, devtools, etc.

### Why Persist Only Chat Store?

```typescript
partialize: (state) => ({
  sessionId: state.sessionId,
  messages: state.messages.slice(-50),
}),
```

**Reasons:**
1. **Session continuity** - Resume after refresh
2. **Memory management** - Limit to 50 messages
3. **Session store is API-backed** - No need to persist
4. **Logs/approval are transient** - Session-scoped only

### Why Slice Messages on Persist?

```typescript
messages: state.messages.slice(-50)
```

**Reasons:**
1. **localStorage limits** - ~5MB per origin
2. **Performance** - Large arrays slow hydration
3. **UX** - Recent messages most relevant
4. **Backend is source of truth** - Can reload full history

### Why Separate Stores Per Domain?

```typescript
useChatStore    // Chat messages, streaming state
useSessionStore // Session list, CRUD operations
useTraceStore   // Debug trace entries, conversation logs
useModelsStore  // Available AI models
```

**Reasons:**
1. **Single responsibility** - Each store has clear purpose
2. **Selective re-renders** - Only affected components update
3. **Testability** - Easier to test in isolation
4. **Composition** - Components pick what they need

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 6.2 (SSE Streaming) | useAgent reads/writes chat store |
| Layer 6.3 (Session UI) | SessionSidebar uses session store |
| Layer 6.4 (Chat Components) | ChatPane uses chat store |
| Layer 6.5 (HITL UI) | Debug panel uses trace store |
| Backend API | session-store fetches from /api/sessions |

### Cross-Store Coordination

```typescript
// In SessionItem component
const { setSessionId, setMessages } = useChatStore();
const { loadSession } = useSessionStore();

const handleLoadSession = async () => {
  const session = await loadSession(sessionId);
  setSessionId(session.id);  // Update chat store
  setMessages(session.messages);  // Sync messages
};
```

### State Flow Diagram

```
User Action → Store Action → State Update → Component Re-render

[Send Message]
    │
    ▼
useAgent.sendMessage()
    │
    ├─→ chatStore.addMessage()      → ChatPane re-renders
    ├─→ chatStore.setIsStreaming()  → Input disabled
    └─→ logStore.addLog()           → DebugPane re-renders
```

---

## Common Issues / Debugging

### State Not Persisting

```
// After refresh, sessionId is null
```

**Cause:** Hydration mismatch or storage error.

**Debug:**

```typescript
// Check localStorage
localStorage.getItem('chat-store');

// Check hydration
const { sessionId } = useChatStore();
console.log('Hydrated sessionId:', sessionId);
```

### Stale Closure in Actions

```typescript
// WRONG: Stale state reference
setMessages: (msg) => set({ messages: [...messages, msg] })

// CORRECT: Use callback form
setMessages: (msg) => set((state) => ({ messages: [...state.messages, msg] }))
```

### Too Many Re-renders

```
// Component re-renders on every state change
```

**Fix:** Use selectors:

```typescript
// WRONG: Subscribes to entire store
const store = useChatStore();

// CORRECT: Subscribe to specific slice
const messages = useChatStore((state) => state.messages);
const isStreaming = useChatStore((state) => state.isStreaming);
```

### Date Serialization Issues

```
// After persist/hydrate, dates are strings
```

**Fix:** Parse dates on hydration:

```typescript
storage: createJSONStorage(() => localStorage),
onRehydrateStorage: () => (state) => {
  state?.messages.forEach((msg) => {
    msg.createdAt = new Date(msg.createdAt);
  });
},
```

---

## Further Reading

- [Layer 6.2: SSE Streaming](./LAYER_6.2_SSE_STREAMING.md) - State updates from stream
- [Layer 6.3: Session UI](./LAYER_6.3_SESSION_UI.md) - Session store usage
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Zustand Persist Middleware](https://docs.pmnd.rs/zustand/integrations/persisting-store-data)
