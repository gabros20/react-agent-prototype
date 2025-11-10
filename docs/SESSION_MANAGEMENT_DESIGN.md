# Session Management Design — ChatGPT-Style UX

**Goal**: Implement session-based chat like ChatGPT where users can:
1. **Clear History** - Keep session, clear messages (new conversation in same session)
2. **New Session** - Archive current, start fresh (create new session ID)
3. **Delete Session** - Permanently delete session + all data from everywhere

**Date**: 2025-11-10  
**Based on**: Current architecture (Sprints 0-10 completed)

---

## 1. Current Architecture Analysis

### ✅ What We Have

**Database Schema** (`server/db/schema.ts`):
```sql
-- Sessions table
sessions(
  id TEXT PRIMARY KEY,           -- UUID
  title TEXT,                    -- "New Session" or user-provided title
  checkpoint JSON,               -- AgentCheckpoint (for crash recovery)
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
)

-- Messages table (cascade delete on session delete)
messages(
  id TEXT PRIMARY KEY,
  sessionId TEXT FK -> sessions.id (CASCADE),
  role ENUM('system', 'user', 'assistant', 'tool'),
  content JSON,
  toolName TEXT,
  stepIdx INTEGER,
  createdAt TIMESTAMP
)
```

**Frontend State** (`app/assistant/_stores/chat-store.ts`):
```typescript
{
  sessionId: string | null,
  messages: ChatMessage[],        // In-memory only
  currentTraceId: string | null,
  isStreaming: boolean
}
```

**Checkpoint System** (`server/services/agent/checkpoint-manager.ts`):
- Stores agent state in `sessions.checkpoint` JSON column
- Contains: messages, memory state, execution state, subgoals
- Used for crash recovery
- Cleared on successful completion

**Vector Index** (LanceDB):
- Indexes CMS resources (pages, sections, entries)
- NOT session-specific (global resource search)
- No cleanup needed for session deletion

### ❌ What's Missing

1. **No session CRUD endpoints** - Can't list/create/delete sessions from frontend
2. **No session history UI** - Can't see past sessions or switch between them
3. **No message persistence** - Messages only in frontend localStorage (lost on clear)
4. **No "archived" flag** - All sessions treated equally (no active vs archived)
5. **No cascade cleanup** - Deleting session doesn't clean up messages (FK cascade exists but no endpoint)
6. **No session title generation** - All sessions called "New Session"

---

## 2. Three User Actions — Data Flow

### Action 1: **Clear History** (Keep Session)
**UX**: Like clicking "Clear conversation" in ChatGPT — fresh slate, same session

**What it does**:
- ✅ Keep: Session ID, session metadata (createdAt, title)
- ❌ Clear: Messages (frontend + backend), checkpoint, currentTraceId

**Frontend Flow**:
```typescript
async function clearHistory() {
  const sessionId = useChatStore.getState().sessionId
  
  if (!sessionId) return
  
  // 1. DELETE all messages from backend
  await fetch(`/api/sessions/${sessionId}/messages`, { method: 'DELETE' })
  
  // 2. Clear checkpoint
  await fetch(`/api/sessions/${sessionId}/checkpoint`, { method: 'DELETE' })
  
  // 3. Clear frontend state (keep sessionId)
  useChatStore.setState({
    messages: [],
    currentTraceId: null,
    isStreaming: false
  })
  useLogStore.getState().clearLogs()
}
```

**Backend Endpoints Needed**:
```typescript
// DELETE /v1/sessions/:sessionId/messages
// Deletes all messages for session, keeps session record
router.delete('/sessions/:sessionId/messages', async (req, res) => {
  const { sessionId } = req.params
  
  await db.delete(schema.messages)
    .where(eq(schema.messages.sessionId, sessionId))
  
  res.json({ success: true, deletedCount: result.rowsAffected })
})

// DELETE /v1/sessions/:sessionId/checkpoint
// Clears checkpoint JSON from session
router.delete('/sessions/:sessionId/checkpoint', async (req, res) => {
  await checkpointManager.clear(sessionId)
  res.json({ success: true })
})
```

**Result**:
- Session still exists in DB
- User can continue chatting in same session
- Message history gone (clean slate)
- Session appears in history list with 0 messages

---

### Action 2: **New Session** (Archive Current)
**UX**: Like "New chat" in ChatGPT — archive current, open fresh session

**What it does**:
- ✅ Archive: Current session (mark as archived, keep all data)
- ✅ Create: New session with new ID
- ✅ Switch: Frontend switches to new session
- ✅ Keep: Old session recoverable from history

**Frontend Flow**:
```typescript
async function newSession() {
  const currentSessionId = useChatStore.getState().sessionId
  
  // 1. Archive current session (if exists)
  if (currentSessionId) {
    await fetch(`/api/sessions/${currentSessionId}/archive`, { 
      method: 'PATCH',
      body: JSON.stringify({ title: generateTitle() })
    })
  }
  
  // 2. Create new session
  const response = await fetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: 'New Session' })
  })
  const { sessionId: newSessionId } = await response.json()
  
  // 3. Reset frontend state with new session
  useChatStore.setState({
    sessionId: newSessionId,
    messages: [],
    currentTraceId: null,
    isStreaming: false
  })
  useLogStore.getState().clearLogs()
}
```

**Backend Endpoints Needed**:
```typescript
// POST /v1/sessions
// Creates new session
router.post('/sessions', async (req, res) => {
  const { title } = req.body
  
  const sessionId = randomUUID()
  await db.insert(schema.sessions).values({
    id: sessionId,
    title: title || 'New Session',
    checkpoint: null,
    createdAt: new Date(),
    updatedAt: new Date()
  })
  
  res.json({ data: { sessionId, title }, statusCode: 201 })
})

// PATCH /v1/sessions/:sessionId/archive
// Marks session as archived (optional: generates smart title)
router.patch('/sessions/:sessionId/archive', async (req, res) => {
  const { title } = req.body
  
  await db.update(schema.sessions)
    .set({
      title: title || 'Archived Session',
      updatedAt: new Date()
    })
    .where(eq(schema.sessions.id, sessionId))
  
  res.json({ success: true })
})
```

**Smart Title Generation** (Optional Enhancement):
```typescript
// Generate title from first user message
function generateTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find(m => m.role === 'user')
  if (!firstUserMsg) return 'New Session'
  
  // Truncate and clean
  const title = firstUserMsg.content
    .slice(0, 50)
    .replace(/\n/g, ' ')
    .trim()
  
  return title.length > 50 ? title + '...' : title
}
```

**Result**:
- Old session still exists in DB (archived with title)
- New session created with fresh ID
- User continues in new session
- Old session appears in history sidebar

---

### Action 3: **Delete Session** (Permanent)
**UX**: Like deleting a chat in ChatGPT — removes everything permanently

**What it does**:
- ❌ Delete: Session record, all messages (cascade), checkpoint
- ⚠️ Warn: "This action cannot be undone"
- ✅ Keep: CMS data (pages, sections created during session)

**Frontend Flow**:
```typescript
async function deleteSession(sessionId: string) {
  // 1. Confirm deletion (HITL-style modal)
  const confirmed = await showConfirmDialog({
    title: 'Delete Session?',
    message: 'This will permanently delete all messages. This cannot be undone.',
    confirmText: 'Delete',
    confirmVariant: 'destructive'
  })
  
  if (!confirmed) return
  
  // 2. DELETE session from backend (cascade deletes messages)
  await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
  
  // 3. If current session, reset frontend
  if (useChatStore.getState().sessionId === sessionId) {
    useChatStore.getState().reset()
    useLogStore.getState().clearLogs()
  }
  
  // 4. Refresh session list
  refreshSessionList()
}
```

**Backend Endpoint Needed**:
```typescript
// DELETE /v1/sessions/:sessionId
// Permanently deletes session + messages (cascade)
router.delete('/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params
  
  // 1. Delete messages (explicit, though FK cascade handles it)
  const messagesDeleted = await db.delete(schema.messages)
    .where(eq(schema.messages.sessionId, sessionId))
  
  // 2. Delete session (also clears checkpoint JSON)
  const sessionDeleted = await db.delete(schema.sessions)
    .where(eq(schema.sessions.id, sessionId))
  
  res.json({ 
    success: true, 
    deleted: { session: 1, messages: messagesDeleted.rowsAffected }
  })
})
```

**Cascade Verification**:
```sql
-- Foreign key already has CASCADE in schema:
messages.sessionId FK -> sessions.id (onDelete: 'cascade')

-- Deleting session auto-deletes all messages ✅
```

**Result**:
- Session completely removed from database
- All messages removed (cascade delete)
- Checkpoint cleared (part of session JSON)
- If current session, frontend switches to "no session" state
- CMS data (pages/sections) created during session still exists

---

## 3. Session List UI — Sidebar Component

**UX**: Like ChatGPT sidebar — shows all sessions, click to load

**Component Structure**:
```
<SessionSidebar>
  <Header>
    <Button onClick={newSession}>+ New Session</Button>
  </Header>
  
  <ScrollArea>
    {sessions.map(session => (
      <SessionItem
        key={session.id}
        session={session}
        isActive={session.id === currentSessionId}
        onSelect={() => loadSession(session.id)}
        onDelete={() => deleteSession(session.id)}
      />
    ))}
  </ScrollArea>
</SessionSidebar>
```

**Session Item Design**:
```
┌─────────────────────────────────────┐
│ 📝 Create homepage with hero...     │ ← Title (truncated)
│    3 messages • 2 hours ago         │ ← Stats
│                            [⋮]      │ ← Menu (Clear/Delete)
└─────────────────────────────────────┘
```

**Frontend State** (new store):
```typescript
// app/assistant/_stores/session-store.ts
interface SessionState {
  sessions: SessionMetadata[]
  loadSessions: () => Promise<void>
  loadSession: (sessionId: string) => Promise<void>
  createSession: () => Promise<string>
  deleteSession: (sessionId: string) => Promise<void>
  clearHistory: (sessionId: string) => Promise<void>
}

interface SessionMetadata {
  id: string
  title: string
  messageCount: number
  lastMessageAt: Date
  createdAt: Date
}
```

**Backend Endpoint Needed**:
```typescript
// GET /v1/sessions
// Lists all sessions with metadata
router.get('/sessions', async (req, res) => {
  const sessions = await db.query.sessions.findMany({
    orderBy: (sessions, { desc }) => [desc(sessions.updatedAt)],
    with: {
      messages: {
        columns: { id: true, createdAt: true },
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        limit: 1 // Only need last message for timestamp
      }
    }
  })
  
  const sessionList = sessions.map(s => ({
    id: s.id,
    title: s.title,
    messageCount: s.messages.length,
    lastMessageAt: s.messages[0]?.createdAt || s.createdAt,
    createdAt: s.createdAt
  }))
  
  res.json({ data: sessionList, statusCode: 200 })
})

// GET /v1/sessions/:sessionId
// Loads single session with all messages
router.get('/sessions/:sessionId', async (req, res) => {
  const session = await db.query.sessions.findFirst({
    where: eq(schema.sessions.id, req.params.sessionId),
    with: {
      messages: {
        orderBy: (messages, { asc }) => [asc(messages.createdAt)]
      }
    }
  })
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found', statusCode: 404 })
  }
  
  res.json({ data: session, statusCode: 200 })
})
```

---

## 4. Message Persistence — Save to DB

**Problem**: Messages currently only in frontend localStorage (lost on clear)

**Solution**: Save messages to DB as they're sent/received

**Frontend Integration** (update use-agent hook):
```typescript
// app/assistant/_hooks/use-agent.ts
const sendMessage = useCallback(async (prompt: string) => {
  // ... existing code ...
  
  // Add user message
  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: prompt,
    createdAt: new Date()
  }
  addMessage(userMessage)
  
  // 💾 NEW: Persist to backend
  await fetch('/api/sessions/${sessionId}/messages', {
    method: 'POST',
    body: JSON.stringify({
      role: 'user',
      content: prompt
    })
  })
  
  // ... agent streaming ...
  
  // When assistant response complete:
  const assistantMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: assistantText,
    createdAt: new Date()
  }
  addMessage(assistantMessage)
  
  // 💾 NEW: Persist to backend
  await fetch('/api/sessions/${sessionId}/messages', {
    method: 'POST',
    body: JSON.stringify({
      role: 'assistant',
      content: assistantText
    })
  })
})
```

**Backend Endpoint Needed**:
```typescript
// POST /v1/sessions/:sessionId/messages
// Saves single message to DB
router.post('/sessions/:sessionId/messages', async (req, res) => {
  const { role, content, toolName, stepIdx } = req.body
  
  const messageId = randomUUID()
  await db.insert(schema.messages).values({
    id: messageId,
    sessionId: req.params.sessionId,
    role,
    content: JSON.stringify(content),
    toolName: toolName || null,
    stepIdx: stepIdx || null,
    createdAt: new Date()
  })
  
  res.json({ data: { messageId }, statusCode: 201 })
})
```

**Load Messages on Session Switch**:
```typescript
async function loadSession(sessionId: string) {
  // 1. Fetch session with messages from backend
  const response = await fetch(`/api/sessions/${sessionId}`)
  const { data: session } = await response.json()
  
  // 2. Load into frontend state
  useChatStore.setState({
    sessionId: session.id,
    messages: session.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      createdAt: new Date(m.createdAt)
    })),
    currentTraceId: null,
    isStreaming: false
  })
  
  // 3. Clear debug logs (not session-specific)
  useLogStore.getState().clearLogs()
}
```

---

## 5. Implementation Plan — Step-by-Step

### Phase 1: Backend Session API (Sprint 11.1)
**Duration**: 2-3 hours

**Tasks**:
1. Create session routes file (`server/routes/sessions.ts`)
2. Implement 7 endpoints:
   - `POST /v1/sessions` - Create new session
   - `GET /v1/sessions` - List all sessions with metadata
   - `GET /v1/sessions/:id` - Get single session with messages
   - `PATCH /v1/sessions/:id/archive` - Archive session (update title)
   - `DELETE /v1/sessions/:id` - Delete session permanently
   - `POST /v1/sessions/:id/messages` - Add message to session
   - `DELETE /v1/sessions/:id/messages` - Clear all messages
   - `DELETE /v1/sessions/:id/checkpoint` - Clear checkpoint
3. Add session service class (`server/services/session-service.ts`)
4. Update ServiceContainer to include SessionService
5. Test with curl

**Deliverables**:
- Working session CRUD API
- Message persistence to database
- Cascade delete verified
- Zero TypeScript errors

---

### Phase 2: Frontend Session Store (Sprint 11.2)
**Duration**: 1-2 hours

**Tasks**:
1. Create session store (`app/assistant/_stores/session-store.ts`)
2. Add actions: loadSessions, loadSession, createSession, deleteSession, clearHistory
3. Update use-agent hook to persist messages to backend
4. Add session loading logic (fetch messages from DB)
5. Update chat-store to remove localStorage persistence (now in DB)

**Deliverables**:
- Session store with all CRUD actions
- Messages saved to DB on send
- Session switching loads from DB
- localStorage only caches current session (optional)

---

### Phase 3: Session Sidebar UI (Sprint 11.3)
**Duration**: 2-3 hours

**Tasks**:
1. Create SessionSidebar component with:
   - Session list (scrollable)
   - "New Session" button
   - Session item with title, stats, menu
2. Create SessionItem component with:
   - Click to load
   - Dropdown menu (Clear History, Delete)
   - Active state styling
3. Create confirmation modals:
   - ClearHistoryModal (reuse HITL modal pattern)
   - DeleteSessionModal (warning: permanent)
4. Update assistant page layout:
   - Add sidebar (collapsible on mobile)
   - Adjust grid to 4 columns: Sidebar (1) | Debug (2) | Chat (1)
5. Add keyboard shortcuts:
   - `Cmd+N` / `Ctrl+N` - New session
   - `Cmd+K` / `Ctrl+K` - Session switcher

**Deliverables**:
- Working session sidebar
- Session switching functional
- Clear/Delete actions with confirmation
- Responsive layout (sidebar collapses on mobile)
- Zero TypeScript errors

---

### Phase 4: Smart Features (Sprint 11.4 - Optional)
**Duration**: 1-2 hours

**Tasks**:
1. Auto-generate session titles from first message
2. Add search/filter to session list
3. Add session pinning (favorite sessions at top)
4. Add session export (download as JSON/Markdown)
5. Add "Continue from checkpoint" UI (show unfinished sessions)

**Deliverables**:
- Smart title generation
- Session search functional
- Pin/unpin sessions
- Export session to file

---

## 6. API Summary

### New Endpoints (8 total)

| Method | Endpoint | Purpose | Body | Response |
|--------|----------|---------|------|----------|
| **POST** | `/v1/sessions` | Create new session | `{ title }` | `{ sessionId, title }` |
| **GET** | `/v1/sessions` | List all sessions | - | `{ sessions: [{ id, title, messageCount, lastMessageAt }] }` |
| **GET** | `/v1/sessions/:id` | Get session + messages | - | `{ session: { id, title, messages: [...] } }` |
| **PATCH** | `/v1/sessions/:id/archive` | Archive session (update title) | `{ title }` | `{ success: true }` |
| **DELETE** | `/v1/sessions/:id` | Delete session permanently | - | `{ success: true, deleted: { session: 1, messages: N } }` |
| **POST** | `/v1/sessions/:id/messages` | Add message to session | `{ role, content, toolName?, stepIdx? }` | `{ messageId }` |
| **DELETE** | `/v1/sessions/:id/messages` | Clear all messages | - | `{ success: true, deletedCount: N }` |
| **DELETE** | `/v1/sessions/:id/checkpoint` | Clear checkpoint | - | `{ success: true }` |

### Existing Endpoints (No Changes)
- `/v1/agent/stream` - Agent streaming (unchanged)
- `/v1/agent/approve` - HITL approval (unchanged)
- All CMS endpoints (unchanged)

---

## 7. Data Cleanup Strategy

### What Gets Deleted

| Action | Session Record | Messages | Checkpoint | Frontend State |
|--------|---------------|----------|-----------|---------------|
| **Clear History** | ✅ Keep | ❌ Delete | ❌ Delete | ❌ Clear messages, keep sessionId |
| **New Session** | ✅ Keep (archive) | ✅ Keep | ✅ Keep | ✅ Reset to new session |
| **Delete Session** | ❌ Delete | ❌ Delete (cascade) | ❌ Delete (part of session) | ❌ Reset if current |

### Database Cleanup
- **Messages**: Auto-deleted via FK cascade when session deleted
- **Checkpoints**: Stored in `sessions.checkpoint` JSON, deleted with session
- **CMS Data**: Never deleted (pages/sections independent of sessions)
- **Vector Index**: Never deleted (global resource search)

### Frontend Cleanup
- **localStorage**: Clear on logout or explicit clear
- **Zustand stores**: Reset on session switch or delete
- **Debug logs**: Clear on session switch (not persisted)

---

## 8. Component Tree (Updated)

```
app/assistant/page.tsx
├── Header (mode selector, session title)
├── SessionSidebar (new)
│   ├── NewSessionButton
│   └── SessionList
│       └── SessionItem[]
│           ├── Title + Stats
│           └── DropdownMenu
│               ├── ClearHistory
│               └── DeleteSession
├── DebugPane (2 cols)
└── ChatPane (1 col)
    ├── Header (session info)
    ├── Conversation
    └── PromptInput
```

---

## 9. Migration Strategy

### For Existing Users
1. First load detects no sessionId → create default session
2. Migrate localStorage messages to DB (one-time migration)
3. Show migration toast: "Chat history moved to server"

**Migration Code**:
```typescript
// Run on first load
async function migrateToSessionPersistence() {
  const localMessages = localStorage.getItem('chat-store')
  if (!localMessages) return
  
  const { messages, sessionId } = JSON.parse(localMessages)
  
  if (messages.length > 0 && sessionId) {
    // Create session if doesn't exist
    await fetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ id: sessionId, title: 'Migrated Session' })
    })
    
    // Save messages to DB
    for (const message of messages) {
      await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify(message)
      })
    }
    
    console.log('Migrated', messages.length, 'messages to DB')
  }
  
  // Clear localStorage (now using DB)
  localStorage.removeItem('chat-store')
}
```

---

## 10. Testing Checklist

### Manual Testing
- [ ] Create new session → appears in sidebar
- [ ] Send messages → saved to DB, visible after reload
- [ ] Switch sessions → loads correct messages
- [ ] Clear history → messages gone, session remains
- [ ] Delete session → removed from sidebar, data gone from DB
- [ ] Delete current session → frontend resets to "no session"
- [ ] Refresh page → current session restored from DB
- [ ] Multiple tabs → sessions sync across tabs

### Edge Cases
- [ ] Delete session while streaming → streaming stops gracefully
- [ ] Switch session while streaming → current stream cancelled
- [ ] Delete all sessions → shows empty state with "New Session" button
- [ ] Session with 1000+ messages → loads without lag (pagination if needed)
- [ ] Session title with special chars → renders correctly

---

## 11. Timeline & Effort

| Phase | Duration | Priority | Dependencies |
|-------|----------|---------|-------------|
| Phase 1: Backend API | 2-3 hours | **High** | None |
| Phase 2: Frontend Store | 1-2 hours | **High** | Phase 1 |
| Phase 3: Session Sidebar UI | 2-3 hours | **High** | Phase 2 |
| Phase 4: Smart Features | 1-2 hours | Medium | Phase 3 |

**Total Time**: 6-10 hours (1-1.5 days of focused work)

---

## 12. Success Criteria

✅ User can:
- Create unlimited sessions
- Switch between sessions instantly
- Clear chat history without losing session
- Delete sessions permanently
- See all sessions in sidebar
- Auto-save messages to database

✅ System:
- Messages persist across browser reloads
- Cascade delete removes all related data
- No orphaned messages in database
- Zero TypeScript errors
- Mobile-responsive sidebar

---

## Next Steps

1. **Review this design** with team/stakeholders
2. **Update IMPLEMENTATION_SPRINTS.md** with Sprint 11 subtasks
3. **Create GitHub issues** for each phase
4. **Start Phase 1** (Backend Session API)
5. **Test incrementally** after each phase

---

**Questions for Review**:
1. Should we add session "folders" (organize by project/topic)?
2. Should we implement session sharing (export/import)?
3. Should we limit max sessions per user (e.g., 100)?
4. Should we auto-delete old sessions (e.g., >30 days)?
5. Should we add session analytics (message count, tools used, errors)?
