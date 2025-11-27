# Layer 6.4: Chat Components

> Message display, input form, markdown rendering, conversation flow

## Overview

The Chat Components form the primary user interface for agent interaction. The ChatPane component orchestrates message display, user input, and streaming state. It uses custom AI element components for consistent chat UX and renders assistant responses with markdown support.

**Key Responsibilities:**
- Display message history with role-based styling
- Handle user input with streaming awareness
- Render markdown in assistant messages
- Provide clear history functionality
- Show streaming status indicator

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
| `app/assistant/_components/chat-pane.tsx` | Main chat interface |
| `components/ai-elements/conversation.tsx` | Scroll container |
| `components/ai-elements/message.tsx` | Message display |
| `components/ai-elements/prompt-input.tsx` | Input form |
| `components/markdown.tsx` | Markdown renderer |

---

## Core Implementation

### ChatPane Component

```typescript
// app/assistant/_components/chat-pane.tsx
export function ChatPane() {
  const [input, setInput] = useState("");
  const { sendMessage, isStreaming } = useAgent();
  const { messages, reset, sessionId } = useChatStore();
  const { clearHistory } = useSessionStore();

  const handleClearHistory = async () => {
    if (!sessionId) {
      console.warn("No active session to clear");
      return;
    }

    try {
      await clearHistory(sessionId);
      reset();  // Clear local state
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex-none p-4 border-b bg-muted/30">
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-3 flex-1 min-w-0">
            <MessageSquare className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Conversation</h2>
              <p className="text-sm text-muted-foreground">
                Ask anything about your CMS
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" disabled={messages.length === 0}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete all messages. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearHistory}>
                  Clear History
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <p className="text-lg font-medium mb-2">No messages yet</p>
                  <p className="text-sm">Start a conversation to manage your CMS</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    <Markdown className="text-sm">{message.content}</Markdown>
                  </MessageContent>
                </Message>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      {/* Input */}
      <div className="flex-none p-4 border-t">
        <PromptInput
          onSubmit={(message) => {
            if (message.text?.trim() && !isStreaming) {
              sendMessage(message.text);
              setInput("");
            }
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={isStreaming}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <span className="text-xs text-muted-foreground">
              {isStreaming ? "Agent is thinking..." : "Press Enter to send"}
            </span>
            <PromptInputSubmit disabled={isStreaming || !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
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
    <Markdown>{message.content}</Markdown>
  </MessageContent>
</Message>

// Props: from = 'user' | 'assistant' | 'system'
// User messages: right-aligned, primary color
// Assistant messages: left-aligned, muted background
```

### Conversation Auto-Scroll

```typescript
// Conversation provides scroll container
<Conversation className="h-full">
  <ConversationContent>
    {messages.map(m => <Message ... />)}
  </ConversationContent>
  {/* Shows when scrolled up, click to jump to bottom */}
  <ConversationScrollButton />
</Conversation>
```

### Markdown Rendering

```typescript
// components/markdown.tsx
export function Markdown({ children, className }: {
  children: string;
  className?: string;
}) {
  return (
    <ReactMarkdown
      className={cn("prose prose-sm dark:prose-invert", className)}
      components={{
        // Custom renderers for code blocks, links, etc.
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return <code className="bg-muted px-1 rounded">{children}</code>;
          }
          return <code className={className}>{children}</code>;
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
```

---

## Design Decisions

### Why Fixed Header/Input, Scrollable Messages?

```typescript
<div className="flex flex-col h-full">
  <div className="flex-none">Header</div>
  <div className="flex-1 min-h-0 overflow-hidden">Messages</div>
  <div className="flex-none">Input</div>
</div>
```

**Reasons:**
1. **Input always visible** - User can always type
2. **Header context** - Title and clear button accessible
3. **Scroll isolation** - Only messages scroll
4. **Mobile-friendly** - Keyboard doesn't push layout

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

### Why Markdown for Assistant Messages?

```typescript
<MessageContent>
  <Markdown>{message.content}</Markdown>
</MessageContent>
```

**Reasons:**
1. **Rich formatting** - Headers, lists, bold, etc.
2. **Code blocks** - Syntax highlighting for snippets
3. **Links** - Clickable references
4. **Agent flexibility** - LLM naturally uses markdown

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
2. **Checkpoint handling** - Clear also clears AI checkpoint
3. **Session preservation** - Keep session metadata
4. **Confirmation UX** - Both require confirmation

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 6.1 (State Management) | useChatStore for messages, sessionId |
| Layer 6.2 (SSE Streaming) | useAgent for sendMessage, isStreaming |
| Layer 6.3 (Session UI) | clearHistory from useSessionStore |
| shadcn/ui | AlertDialog, Button components |

### Component Hierarchy

```
ChatPane
├─ Header
│  ├─ MessageSquare icon
│  ├─ Title + description
│  └─ AlertDialog (clear history)
│
├─ Conversation
│  ├─ ConversationContent
│  │  └─ Message[] (mapped)
│  │     └─ MessageContent
│  │        └─ Markdown
│  └─ ConversationScrollButton
│
└─ PromptInput
   ├─ PromptInputBody
   │  └─ PromptInputTextarea
   └─ PromptInputFooter
      ├─ Status text
      └─ PromptInputSubmit
```

### Data Flow

```
User types → input state → Enter pressed
        │
        ▼
onSubmit callback
        │
        ├─ sendMessage(text)  → useAgent → /api/agent
        └─ setInput("")       → clear input
        │
        ▼
isStreaming = true → Input disabled, "Agent is thinking..."
        │
        ▼
SSE events → messages state updated → Messages re-render
        │
        ▼
isStreaming = false → Input enabled, "Press Enter to send"
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
    sendMessage(message.text);
    setInput("");  // Must be called
  }
}}
```

### Scroll Not Following New Messages

```
// New messages appear below viewport
```

**Cause:** ConversationScrollButton not showing or auto-scroll disabled.

**Debug:** Check if ConversationContent is properly scrollable:

```typescript
<div className="flex-1 min-h-0 overflow-hidden">  // Parent must constrain
  <Conversation className="h-full">  // Full height
    <ConversationContent>...</ConversationContent>
  </Conversation>
</div>
```

### Markdown Not Rendering

```
// Raw markdown shown instead of formatted
```

**Cause:** Markdown component not imported or content not string.

**Fix:**

```typescript
// Ensure content is string
content: typeof msg.content === 'string'
  ? msg.content
  : JSON.stringify(msg.content)
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

---

## Further Reading

- [Layer 6.1: State Management](./LAYER_6.1_STATE_MANAGEMENT.md) - Chat store
- [Layer 6.2: SSE Streaming](./LAYER_6.2_SSE_STREAMING.md) - useAgent hook
- [React Markdown](https://github.com/remarkjs/react-markdown)
- [shadcn/ui AlertDialog](https://ui.shadcn.com/docs/components/alert-dialog)
