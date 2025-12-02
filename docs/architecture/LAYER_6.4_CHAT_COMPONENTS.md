# Layer 6.4: Chat Components

> Message display, input form, markdown rendering, conversation flow

## Overview

The Chat Components form the primary user interface for agent interaction. The ChatPane component orchestrates message display, user input, and streaming state. It uses custom AI element components for consistent chat UX and renders assistant responses with markdown support via Streamdown.

**Key Responsibilities:**
- Display message history with role-based styling
- Handle user input with streaming awareness
- Render markdown in assistant messages via Streamdown
- Provide clear history functionality
- Show contextual agent status indicator (tool-aware)
- Optimized re-rendering with component isolation and memoization

---

## The Problem

Without proper chat components:

```typescript
// WRONG: No message grouping by role
<div>{message.content}</div>  // No visual distinction

// WRONG: Plain text rendering
<div>{assistantMessage}</div>  // No markdown, code blocks

// WRONG: Input during streaming
<input onSubmit={send} />  // User can spam requests

// WRONG: No scroll management
messages.map(m => <div>{m}</div>)  // New messages off-screen
```

**Our Solution:**
1. Message component with role-based styling
2. Markdown component for rich rendering
3. Input disabled during streaming
4. Conversation component with auto-scroll
5. Clear history with confirmation

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHAT PANE LAYOUT                             │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Header (fixed)                         │  │
│  │                                                           │  │
│  │  [💬 Conversation]                           [🗑️ Clear]   │  │
│  │  Ask anything about your CMS                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Messages (flex-1, scrollable)                │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Message (user)                                     │  │  │
│  │  │  ┌─────────────────────────────────────────────┐    │  │  │
│  │  │  │  "Show me all blog posts"                   │    │  │  │
│  │  │  └─────────────────────────────────────────────┘    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Message (assistant)                                │  │  │
│  │  │  ┌─────────────────────────────────────────────┐    │  │  │
│  │  │  │  **Found 5 blog posts:**                    │    │  │  │
│  │  │  │  1. Getting Started with...                 │    │  │  │
│  │  │  │  2. Advanced Configuration...               │    │  │  │
│  │  │  │  (Markdown rendered)                        │    │  │  │
│  │  │  └─────────────────────────────────────────────┘    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  [▼ Scroll to bottom]  (when scrolled up)                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Input (fixed)                          │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                                                     │  │  │
│  │  │  [Type a message...]                     [Send ▶]   │  │  │
│  │  │                                                     │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  Agent is thinking... / Press Enter to send               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `app/assistant/_components/chat-pane.tsx` | Main chat interface with isolated input |
| `components/ai-elements/conversation.tsx` | Scroll container with stick-to-bottom |
| `components/ai-elements/message.tsx` | Message display + MessageResponse (Streamdown) |
| `components/ai-elements/agent-status.tsx` | Contextual status indicator |
| `components/ai-elements/prompt-input.tsx` | Input form |
| `components/markdown.tsx` | Fallback markdown renderer (marked + DOMPurify) |

---

## Core Implementation

### ChatPane Component (Optimized Architecture)

The ChatPane uses **component isolation** to prevent unnecessary re-renders:

```
ChatPane
├─ Header (static)
├─ ConversationArea (memoized)  ← Only re-renders when messages change
│  └─ MessageList
│     ├─ Message[] (mapped)
│     │  └─ MessageResponse (Streamdown, memoized)
│     └─ AgentStatusIndicator
└─ ChatInput (isolated)         ← Input state doesn't affect parent
```

```typescript
// app/assistant/_components/chat-pane.tsx

// Inner component that handles auto-scroll when messages change
function MessageList({ messages }: { messages: ChatMessage[] }) {
  const { scrollToBottom } = useStickToBottomContext();
  const prevMessagesLength = useRef(messages.length);

  useEffect(() => {
    // Only scroll when new messages are added
    if (messages.length > prevMessagesLength.current) {
      scrollToBottom({ animation: "smooth" });
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length, scrollToBottom]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>No messages yet</p>
      </div>
    );
  }

  return (
    <>
      {messages.map((message) => (
        <Message from={message.role} key={message.id}>
          <MessageContent>
            <MessageResponse>{message.content}</MessageResponse>
          </MessageContent>
        </Message>
      ))}
      {/* Status indicator at end of messages during streaming */}
      <AgentStatusIndicator />
    </>
  );
}

// Memoized conversation area - won't re-render when input changes
const ConversationArea = memo(function ConversationArea({ messages }) {
  return (
    <Conversation className="h-full">
      <ConversationContent>
        <MessageList messages={messages} />
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
});

// Isolated input component - typing here won't re-render parent
function ChatInput({ onSendMessage, isStreaming }) {
  const [input, setInput] = useState("");

  return (
    <PromptInput
      onSubmit={(message) => {
        if (message.text?.trim() && !isStreaming) {
          onSendMessage(message.text);
          setInput("");
        }
      }}
    >
      <PromptInputBody>
        <PromptInputTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming}
        />
      </PromptInputBody>
      <PromptInputFooter>
        <span>Press Enter to send</span>
        <PromptInputSubmit disabled={isStreaming || !input.trim()} />
      </PromptInputFooter>
    </PromptInput>
  );
}

export function ChatPane() {
  const { sendMessage, isStreaming } = useAgent();

  // Use selectors to avoid subscribing to entire store
  const messages = useChatStore((state) => state.messages);
  const reset = useChatStore((state) => state.reset);
  const sessionId = useChatStore((state) => state.sessionId);
  const clearHistory = useSessionStore((state) => state.clearHistory);

  const handleClearHistory = async () => {
    if (!sessionId) return;
    await clearHistory(sessionId);
    reset();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header - Fixed */}
      <div className="flex-none p-4 border-b">
        <h2>Conversation</h2>
        <AlertDialog>...</AlertDialog>
      </div>

      {/* Messages - Memoized */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ConversationArea messages={messages} />
      </div>

      {/* Input - Isolated */}
      <div className="flex-none p-4 border-t">
        <ChatInput onSendMessage={sendMessage} isStreaming={isStreaming} />
      </div>
    </div>
  );
}
```

### Message Component Usage

```typescript
// Message with role-based styling
<Message from={message.role} key={message.id}>
  <MessageContent>
    <MessageResponse>{message.content}</MessageResponse>
  </MessageContent>
</Message>

// Props: from = 'user' | 'assistant' | 'system'
// User messages: right-aligned, secondary background
// Assistant messages: left-aligned, primary/10 background with border
```

### MessageResponse (Streamdown)

The `MessageResponse` component uses Streamdown for streaming-aware markdown rendering:

```typescript
// components/ai-elements/message.tsx

// Custom image component with fixed dimensions + URL fix
const MarkdownImage = ({ src, alt, ...props }) => {
  // Fix malformed URLs: "https://uploads/..." -> "/uploads/..."
  let fixedSrc = src;
  if (typeof src === 'string') {
    const malformedMatch = src.match(/^https?:\/+uploads\//);
    if (malformedMatch) {
      fixedSrc = src.replace(/^https?:\/+/, '/');
    }
  }

  return (
    <img
      src={fixedSrc}
      alt={alt || ""}
      className="rounded-md max-w-full h-auto"
      style={{ maxHeight: "300px", objectFit: "contain" }}
    />
  );
};

export const MessageResponse = memo(
  ({ className, components, rehypePlugins, ...props }) => (
    <Streamdown
      className={cn("size-full", className)}
      components={{
        img: MarkdownImage,  // Custom image handler
        ...components,
      }}
      rehypePlugins={rehypePlugins ?? [rehypeRaw]}
      {...props}
    />
  ),
  // Only re-render if content actually changes
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
```

### AgentStatusIndicator

Shows contextual status based on currently executing tool:

```typescript
// components/ai-elements/agent-status.tsx

function getStatusConfig(toolName?: string): StatusConfig {
  if (!toolName) return { icon: BrainIcon, label: 'Thinking...' };

  // Web research tools
  if (toolName.startsWith('web_')) {
    return { icon: GlobeIcon, label: 'Researching the web...' };
  }

  // Image tools
  if (toolName.includes('image') || toolName.startsWith('pexels_')) {
    if (toolName.includes('delete')) return { icon: Trash2Icon, label: 'Removing image...' };
    return { icon: ImageIcon, label: 'Working with images...' };
  }

  // CMS CRUD operations
  if (toolName.startsWith('cms_create')) return { icon: PenLineIcon, label: 'Creating content...' };
  if (toolName.startsWith('cms_update')) return { icon: PencilIcon, label: 'Updating content...' };
  if (toolName.startsWith('cms_delete')) return { icon: Trash2Icon, label: 'Preparing to delete...' };
  if (toolName.startsWith('cms_get')) return { icon: FileSearchIcon, label: 'Reading data...' };

  // Fallback
  return { icon: WrenchIcon, label: 'Processing...' };
}

export function AgentStatusIndicator({ className }) {
  const agentStatus = useChatStore((state) => state.agentStatus);
  const isStreaming = useChatStore((state) => state.isStreaming);

  const isVisible = isStreaming && agentStatus;
  const { icon: Icon, label } = getStatusConfig(
    agentStatus?.state === 'tool-call' ? agentStatus.toolName : undefined
  );

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
        >
          <Icon className="size-4" />
          <Shimmer>{label}</Shimmer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### Conversation Auto-Scroll

Uses `use-stick-to-bottom` library for scroll management:

```typescript
// Conversation provides scroll container with stick-to-bottom context
<Conversation className="h-full">
  <ConversationContent>
    {messages.map(m => <Message ... />)}
  </ConversationContent>
  {/* Shows when scrolled up, click to jump to bottom */}
  <ConversationScrollButton />
</Conversation>

// MessageList uses the context for auto-scroll
const { scrollToBottom } = useStickToBottomContext();
useEffect(() => {
  if (messages.length > prevMessagesLength.current) {
    scrollToBottom({ animation: "smooth" });
  }
}, [messages.length]);
```

### Fallback Markdown Component

For non-streaming contexts, there's also a simpler markdown component:

```typescript
// components/markdown.tsx
export function Markdown({ children, className }: MarkdownProps) {
  const html = useMemo(() => {
    const rawHtml = marked.parse(children, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  }, [children]);

  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

---

## Design Decisions

### Why Component Isolation for Input?

```typescript
// ChatInput is a separate component with its own state
function ChatInput({ onSendMessage, isStreaming }) {
  const [input, setInput] = useState("");  // Local state
  // ...
}

// Parent ChatPane doesn't re-render when user types
export function ChatPane() {
  return (
    <ChatInput onSendMessage={sendMessage} isStreaming={isStreaming} />
  );
}
```

**Reasons:**
1. **Typing doesn't re-render messages** - Major performance win
2. **Memoization preserved** - ConversationArea stays memoized
3. **Cleaner separation** - Each component owns its state
4. **React best practice** - Lift state up only when needed

### Why Memoize ConversationArea?

```typescript
const ConversationArea = memo(function ConversationArea({ messages }) {
  return <Conversation>...</Conversation>;
});
```

**Reasons:**
1. **Expensive renders** - Messages can have complex markdown
2. **Streaming updates** - isStreaming changes shouldn't re-render messages
3. **Status indicator** - AgentStatusIndicator updates inside, not outside
4. **Props comparison** - Only messages array change triggers re-render

### Why MessageResponse with Memo?

```typescript
export const MessageResponse = memo(
  (props) => <Streamdown {...props} />,
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
```

**Reasons:**
1. **Streaming updates** - Content updates character by character
2. **Expensive parsing** - Markdown parsing on every render
3. **Reference equality** - Zustand may create new array references
4. **Custom comparison** - Only re-render if content actually changes

### Why Streamdown over ReactMarkdown?

**Reasons:**
1. **Streaming-aware** - Handles partial markdown gracefully
2. **Progressive rendering** - Shows content as it arrives
3. **No flickering** - Smooth updates during streaming
4. **Custom components** - Still supports custom renderers

### Why Fix Malformed Image URLs?

```typescript
// Agent sometimes generates "https://uploads/..." instead of "/uploads/..."
if (src.match(/^https?:\/+uploads\//)) {
  fixedSrc = src.replace(/^https?:\/+/, '/');
}
```

**Reasons:**
1. **LLM hallucination** - Model adds protocol to relative paths
2. **Silent fix** - Don't break the UI, just fix it
3. **Common pattern** - Happens frequently with `/uploads/` paths
4. **Defensive coding** - Handle edge cases gracefully

### Why Contextual Status Indicator?

```typescript
// Instead of generic "Agent is thinking..."
// Show tool-specific status
if (toolName.startsWith('cms_create')) return { icon: PenLineIcon, label: 'Creating content...' };
```

**Reasons:**
1. **User clarity** - Know exactly what's happening
2. **Reduced anxiety** - "Creating content..." vs "Thinking..."
3. **Tool awareness** - Different tools = different expectations
4. **Visual variety** - Icons change based on action

### Why Disable Input During Streaming?

```typescript
<PromptInputTextarea disabled={isStreaming} />
<PromptInputSubmit disabled={isStreaming || !input.trim()} />
```

**Reasons:**
1. **Prevent spam** - Can't queue multiple requests
2. **Clear feedback** - User knows agent is working
3. **UX consistency** - One request at a time
4. **Backend simplicity** - No request queueing

### Why Separate Clear from Delete?

```typescript
// Clear: Removes messages, keeps session
await clearHistory(sessionId);
reset();

// Delete: Removes entire session (in SessionItem)
await deleteSession(sessionId);
```

**Reasons:**
1. **Different intents** - Start fresh vs. remove entirely
2. **Session preservation** - Keep session metadata
3. **Confirmation UX** - Both require confirmation

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 6.1 (State Management) | useChatStore for messages, sessionId, agentStatus |
| Layer 6.2 (SSE Streaming) | useAgent for sendMessage, isStreaming |
| Layer 6.3 (Session UI) | clearHistory from useSessionStore |
| shadcn/ui | AlertDialog, Button components |
| use-stick-to-bottom | Scroll management in Conversation |
| streamdown | Streaming markdown rendering |
| motion/react | Animated status transitions |

### Component Hierarchy

```
ChatPane
├─ Header (static)
│  ├─ MessageSquare icon
│  ├─ Title + description
│  └─ AlertDialog (clear history)
│
├─ ConversationArea (memoized)
│  └─ Conversation
│     ├─ ConversationContent
│     │  └─ MessageList
│     │     ├─ Message[] (mapped)
│     │     │  └─ MessageContent
│     │     │     └─ MessageResponse (Streamdown, memoized)
│     │     └─ AgentStatusIndicator (animated)
│     └─ ConversationScrollButton
│
└─ ChatInput (isolated state)
   └─ PromptInput
      ├─ PromptInputBody
      │  └─ PromptInputTextarea
      └─ PromptInputFooter
         ├─ Status text
         └─ PromptInputSubmit
```

### Data Flow

```
User types → ChatInput local state (isolated, no parent re-render)
        │
        ▼
Enter pressed → onSendMessage(text)
        │
        ├─ sendMessage(text)  → useAgent → POST /v1/agent/stream
        └─ setInput("")       → clear input
        │
        ▼
isStreaming = true → Input disabled
        │
        ▼
SSE Events Flow:
├─ tool-call event → setAgentStatus({ state: 'tool-call', toolName })
│                    → AgentStatusIndicator shows "Creating content..."
├─ tool-result event → completeEntry() in trace-store
├─ text-streaming event → updateMessage() (character by character)
│                         → MessageResponse (memoized) only updates if content changes
└─ response-complete → setIsStreaming(false)
        │
        ▼
isStreaming = false → Input enabled, AgentStatusIndicator hidden
```

### State Updates and Re-renders

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Re-render Optimization                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   User typing in ChatInput                                                  │
│        │                                                                    │
│        ▼                                                                    │
│   setInput() → ChatInput re-renders                                        │
│                ConversationArea does NOT re-render (memoized)              │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────    │
│                                                                             │
│   isStreaming changes                                                       │
│        │                                                                    │
│        ▼                                                                    │
│   ChatPane re-renders                                                       │
│   ChatInput receives new isStreaming prop → re-renders                     │
│   ConversationArea does NOT re-render (messages unchanged)                 │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────    │
│                                                                             │
│   agentStatus changes                                                       │
│        │                                                                    │
│        ▼                                                                    │
│   AgentStatusIndicator re-renders (subscribes directly to store)           │
│   No other components re-render                                            │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────    │
│                                                                             │
│   New message added                                                         │
│        │                                                                    │
│        ▼                                                                    │
│   ConversationArea re-renders (messages prop changed)                      │
│   MessageList re-renders → auto-scroll triggered                           │
│   MessageResponse re-renders for new message only                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Common Issues / Debugging

### Messages Not Rendering

```
// Empty message list despite sending
```

**Cause:** addMessage not called or messages selector wrong.

**Debug:**

```typescript
const messages = useChatStore((state) => state.messages);
console.log('Current messages:', messages);
```

### Input Not Clearing After Send

```
// Old text remains in textarea
```

**Cause:** setInput("") not called in onSubmit.

**Fix:**

```typescript
onSubmit={(message) => {
  if (message.text?.trim() && !isStreaming) {
    onSendMessage(message.text);
    setInput("");  // Must be called
  }
}}
```

### Scroll Not Following New Messages

```
// New messages appear below viewport
```

**Cause:** MessageList not triggering scrollToBottom or prevMessagesLength not updating.

**Debug:**

```typescript
useEffect(() => {
  console.log('Messages changed:', messages.length, 'prev:', prevMessagesLength.current);
  if (messages.length > prevMessagesLength.current) {
    scrollToBottom({ animation: "smooth" });
  }
  prevMessagesLength.current = messages.length;
}, [messages.length, scrollToBottom]);
```

### Images Not Displaying

```
// Broken image icons or 404 errors
```

**Cause:** Agent generated malformed URL like `https://uploads/...`

**Fix:** Already handled by MarkdownImage component, but if still broken:

```typescript
// Check image URLs in console
console.log('Image src:', src);
// Should be "/uploads/images/..." not "https://uploads/images/..."
```

### AgentStatusIndicator Not Showing

```
// No status during tool execution
```

**Cause:** agentStatus not being set or isStreaming false.

**Debug:**

```typescript
const agentStatus = useChatStore((state) => state.agentStatus);
const isStreaming = useChatStore((state) => state.isStreaming);
console.log('Status:', { agentStatus, isStreaming });
// Should see: { agentStatus: { state: 'tool-call', toolName: 'cms_...' }, isStreaming: true }
```

### MessageResponse Re-rendering Too Often

```
// Performance issues during streaming
```

**Cause:** Memo comparison failing or parent re-rendering.

**Debug:**

```typescript
// Add logging to memo comparison
export const MessageResponse = memo(
  (props) => {
    console.log('MessageResponse render');
    return <Streamdown {...props} />;
  },
  (prevProps, nextProps) => {
    const same = prevProps.children === nextProps.children;
    console.log('Memo check:', same);
    return same;
  }
);
```

### Clear History Not Working

```
// Button clicks but messages remain
```

**Cause:** sessionId null or API error.

**Debug:**

```typescript
const handleClearHistory = async () => {
  console.log('Clearing session:', sessionId);
  if (!sessionId) {
    console.warn("No active session");
    return;
  }
  try {
    await clearHistory(sessionId);
    reset();
  } catch (error) {
    console.error("Clear failed:", error);
  }
};
```

### Typing Causes Entire Chat to Re-render

```
// Laggy typing, slow response
```

**Cause:** Input state not isolated in ChatInput component.

**Fix:** Ensure ChatInput has its own local state:

```typescript
// WRONG: Input state in parent
function ChatPane() {
  const [input, setInput] = useState("");  // ❌ Parent re-renders on every keystroke
}

// RIGHT: Input state isolated
function ChatInput({ onSendMessage, isStreaming }) {
  const [input, setInput] = useState("");  // ✅ Only ChatInput re-renders
}
```

---

## Further Reading

- [Layer 6.1: State Management](./LAYER_6.1_STATE_MANAGEMENT.md) - Chat store, agentStatus
- [Layer 6.2: SSE Streaming](./LAYER_6.2_SSE_STREAMING.md) - useAgent hook, SSE events
- [Streamdown](https://github.com/vercel/streamdown) - Streaming markdown renderer
- [use-stick-to-bottom](https://github.com/oasisjs/use-stick-to-bottom) - Auto-scroll hook
- [Motion/React](https://motion.dev/docs/react-quick-start) - Animation library
- [shadcn/ui AlertDialog](https://ui.shadcn.com/docs/components/alert-dialog)
