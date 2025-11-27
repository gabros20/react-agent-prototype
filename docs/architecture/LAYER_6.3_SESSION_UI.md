# Layer 6.3: Session UI

> Session sidebar, session list, creation, switching, deletion, history clearing

## Overview

The Session UI provides a slide-out sidebar for managing chat sessions. Users can create new sessions, switch between existing ones, clear history, or delete sessions entirely. The UI coordinates with both the session store (backend API) and chat store (local state).

**Key Responsibilities:**
- Display session list with metadata
- Create new sessions
- Load and switch between sessions
- Clear session history (messages + checkpoint)
- Delete sessions permanently
- Coordinate chat store on session change

---

## The Problem

Without proper session management UI:

```typescript
// WRONG: No session persistence
// Chat history lost on refresh

// WRONG: Single session only
// Can't switch between conversations

// WRONG: No confirmation for destructive actions
deleteSession(id);  // Immediate, no undo

// WRONG: State desync
// Chat store shows old messages after switching sessions
```

**Our Solution:**
1. Slide-out sidebar (Sheet component)
2. SessionItem with actions dropdown
3. Confirmation dialogs for clear/delete
4. Coordinated store updates on switch
5. Optimistic loading with error handling

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SESSION UI COMPONENTS                         │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  SessionSidebar                            │  │
│  │                                                            │  │
│  │  Trigger Button (PanelLeft icon)                          │  │
│  │       │                                                    │  │
│  │       ▼                                                    │  │
│  │  Sheet (slide from left)                                  │  │
│  │  ├─ Header: "Chat Sessions"                               │  │
│  │  ├─ New Session Button                                    │  │
│  │  └─ ScrollArea                                            │  │
│  │       └─ SessionItem (mapped)                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    SessionItem                             │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ [Title]                              [⋮ Menu]       │  │  │
│  │  │ 5 messages • 2 hours ago                            │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  Dropdown Menu:                                           │  │
│  │  ├─ Clear History → AlertDialog                          │  │
│  │  └─ Delete Session → AlertDialog                         │  │
│  │                                                            │  │
│  │  Click Action:                                            │  │
│  │  └─ handleLoadSession() → chatStore.setSessionId()       │  │
│  │                        → chatStore.setMessages()         │  │
│  │                        → close sheet                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   AlertDialogs                             │  │
│  │                                                            │  │
│  │  Clear History:                                           │  │
│  │  "This will delete all messages but keep the session"     │  │
│  │  [Cancel] [Clear History]                                 │  │
│  │                                                            │  │
│  │  Delete Session:                                          │  │
│  │  "This will permanently delete the session"               │  │
│  │  [Cancel] [Delete] (destructive style)                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `app/assistant/_components/session-sidebar.tsx` | Sidebar container, new session |
| `app/assistant/_components/session-item.tsx` | Individual session row |
| `app/assistant/_stores/session-store.ts` | API calls, session list |
| `app/assistant/_stores/chat-store.ts` | Current session state |

---

## Core Implementation

### Session Sidebar

```typescript
// app/assistant/_components/session-sidebar.tsx
export function SessionSidebar() {
  const { sessions, currentSessionId, isLoading, loadSessions, createSession } = useSessionStore();
  const { setSessionId, setMessages } = useChatStore();
  const [open, setOpen] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleNewSession = async () => {
    try {
      const newSessionId = await createSession();
      setSessionId(newSessionId);
      setMessages([]);  // Clear chat store
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          {open ? <PanelLeftClose /> : <PanelLeft />}
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-80 p-0">
        <div className="flex h-full flex-col">
          {/* Header */}
          <SheetHeader className="border-b p-4">
            <SheetTitle>Chat Sessions</SheetTitle>
            <SheetDescription>Manage your conversation history</SheetDescription>
          </SheetHeader>

          {/* New Session Button */}
          <div className="border-b p-4">
            <Button onClick={handleNewSession} className="w-full" disabled={isLoading}>
              <Plus className="mr-2 h-4 w-4" />
              New Session
            </Button>
          </div>

          {/* Session List */}
          <ScrollArea className="flex-1">
            <div className="space-y-1 p-2">
              {sessions.length === 0 && !isLoading && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No sessions yet. Click "New Session" to start.
                </div>
              )}

              {sessions.map((session, index) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === currentSessionId}
                  onSessionLoad={() => setOpen(false)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

### Session Item

```typescript
// app/assistant/_components/session-item.tsx
export function SessionItem({ session, isActive, onSessionLoad }: SessionItemProps) {
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { loadSession, clearHistory, deleteSession } = useSessionStore();
  const { setSessionId, setMessages } = useChatStore();

  const handleLoadSession = async () => {
    try {
      const loadedSession = await loadSession(session.id);
      if (loadedSession) {
        setSessionId(loadedSession.id);
        // Convert messages to ChatMessage format
        const chatMessages = loadedSession.messages.map((msg) => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content),
          createdAt: msg.createdAt,
        }));
        setMessages(chatMessages);
        onSessionLoad?.();  // Close sheet
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory(session.id);
      if (isActive) {
        setMessages([]);  // Clear chat store if active
      }
      setShowClearDialog(false);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const handleDeleteSession = async () => {
    try {
      await deleteSession(session.id);
      if (isActive) {
        setSessionId(null);
        setMessages([]);
      }
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  return (
    <>
      <div className={`group flex items-center gap-2 rounded-lg px-3 py-2
        ${isActive ? 'bg-white shadow-sm' : 'hover:bg-white'}`}>

        {/* Session Info - Clickable */}
        <button onClick={handleLoadSession} className="flex-1 text-left">
          <div className="truncate text-sm font-medium">{session.title}</div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{session.messageCount} messages</span>
            <span>•</span>
            <span>{formatDistanceToNow(session.lastActivity, { addSuffix: true })}</span>
          </div>
        </button>

        {/* Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowClearDialog(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Clear History
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Clear History Confirmation */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all messages from "{session.title}" but keep the session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory}>Clear History</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Session Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{session.title}" and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

---

## Design Decisions

### Why Sheet (Slide-Out) Over Modal?

```typescript
<Sheet>
  <SheetContent side="left" className="w-80">
```

**Reasons:**
1. **Non-blocking** - Chat visible while browsing sessions
2. **Familiar pattern** - Common in chat apps (Slack, Discord)
3. **Space efficient** - Doesn't cover entire viewport
4. **Easy dismiss** - Click outside or press Escape

### Why Confirmation Dialogs?

```typescript
<AlertDialog open={showDeleteDialog}>
  <AlertDialogTitle>Delete Session?</AlertDialogTitle>
```

**Reasons:**
1. **Destructive actions** - Delete is irreversible
2. **User confidence** - Prevents accidental clicks
3. **Context** - Shows session name being affected
4. **Escape hatch** - Cancel button available

### Why Coordinate Both Stores?

```typescript
const handleLoadSession = async () => {
  const session = await loadSession(id);
  setSessionId(session.id);      // Chat store
  setMessages(session.messages); // Chat store
};
```

**Reasons:**
1. **State consistency** - Both stores must agree
2. **Immediate update** - UI reflects change instantly
3. **Backend authority** - Messages come from API
4. **Local ID tracking** - Chat store knows current session

### Why Close Sheet on Load?

```typescript
onSessionLoad={() => setOpen(false)}
```

**Reasons:**
1. **Task completion** - User wanted to switch sessions
2. **Focus chat** - Attention goes to loaded messages
3. **Mobile UX** - Sheet covers significant screen area
4. **Consistent behavior** - Same as clicking message

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 6.1 (State Management) | session-store for API, chat-store for UI |
| Layer 4.2 (Session Management) | Backend /api/sessions endpoints |
| Layer 6.4 (Chat Components) | ChatPane shows loaded messages |
| shadcn/ui | Sheet, AlertDialog, DropdownMenu components |

### API Endpoints Used

```typescript
// Load all sessions
GET /api/sessions
→ { sessions: SessionMetadata[] }

// Load single session with messages
GET /api/sessions/:id
→ { session: Session }

// Create new session
POST /api/sessions
→ { id: string }

// Clear session messages + checkpoint
DELETE /api/sessions/:id/messages
DELETE /api/sessions/:id/checkpoint

// Delete session entirely
DELETE /api/sessions/:id
```

### State Flow: Switch Session

```
User clicks SessionItem
        │
        ▼
loadSession(id)  ──────► GET /api/sessions/:id
        │                        │
        │◄───────────────────────┘
        │
        ▼
setSessionId(session.id)  ──────► chat-store
setMessages(session.messages) ──► chat-store
        │
        ▼
onSessionLoad() ──────► setOpen(false)
        │
        ▼
ChatPane re-renders with new messages
```

---

## Common Issues / Debugging

### Sessions Not Loading

```
// Session list empty
```

**Cause:** API error or loadSessions not called.

**Debug:**

```typescript
useEffect(() => {
  console.log('Loading sessions...');
  loadSessions().catch(console.error);
}, [loadSessions]);
```

### Active Session Not Highlighted

```
// Current session not visually distinct
```

**Cause:** currentSessionId not matching.

**Debug:**

```typescript
console.log('currentSessionId:', currentSessionId);
console.log('session.id:', session.id);
console.log('isActive:', session.id === currentSessionId);
```

### Messages Not Appearing After Switch

```
// Switched session but old messages shown
```

**Cause:** setMessages not called or called with wrong data.

**Fix:** Ensure proper message conversion:

```typescript
const chatMessages = loadedSession.messages.map((msg) => ({
  id: msg.id,
  role: msg.role,
  content: typeof msg.content === 'string'
    ? msg.content
    : JSON.stringify(msg.content),  // Handle non-string content
  createdAt: msg.createdAt,
}));
setMessages(chatMessages);
```

### Clear History Not Clearing Checkpoint

```
// Messages cleared but agent still has context
```

**Cause:** Checkpoint not deleted.

**Fix:** Delete both:

```typescript
clearHistory: async (sessionId) => {
  await fetch(`/api/sessions/${sessionId}/messages`, { method: 'DELETE' });
  await fetch(`/api/sessions/${sessionId}/checkpoint`, { method: 'DELETE' });
  await get().loadSessions();
},
```

---

## Further Reading

- [Layer 6.1: State Management](./LAYER_6.1_STATE_MANAGEMENT.md) - Store definitions
- [Layer 4.2: Session Management](./LAYER_4.2_SESSION_MANAGEMENT.md) - Backend session service
- [shadcn/ui Sheet](https://ui.shadcn.com/docs/components/sheet)
- [shadcn/ui AlertDialog](https://ui.shadcn.com/docs/components/alert-dialog)
