# Enhanced Debug Panel - Implementation Plan

## Overview

Design a professional-grade debug panel for agent traces, prompt inspection, and metrics - inspired by LangSmith's observability features but tailored for our ReAct agent architecture.

---

## Current State Analysis

### Existing Infrastructure
- **Log Store** (`log-store.ts`): Basic Zustand store with 6 log types
- **Debug Pane** (`debug-pane.tsx`): Simple collapsible log viewer with filtering
- **SSE Events**: `log`, `text-delta`, `tool-call`, `tool-result`, `approval-required`, `step`, `result`, `error`, `done`, `finish`
- **Agent Status**: Real-time status indicator component

### Gaps Identified
1. No timing/duration metrics between events
2. No prompt/response inspection (full LLM payloads)
3. No hierarchical trace visualization (parent/child spans)
4. No background job event streaming
5. No export/copy functionality
6. No full-screen modal for large payloads
7. No token usage visualization
8. No error stack trace display

---

## Architecture Design

### 1. Enhanced Data Model

```typescript
// Enhanced trace entry with timing and hierarchy
interface TraceEntry {
  id: string;
  traceId: string;
  parentId?: string;           // For nested spans
  timestamp: number;           // Unix timestamp (ms)
  duration?: number;           // Calculated on completion

  // Event classification
  type: TraceEntryType;
  level: 'debug' | 'info' | 'warn' | 'error';

  // Context
  stepNumber?: number;
  toolName?: string;
  toolCallId?: string;

  // Payloads (expandable)
  summary: string;             // Short display text
  input?: unknown;             // Tool args / prompt
  output?: unknown;            // Tool result / response

  // Metadata
  tokens?: { input: number; output: number };
  error?: { message: string; stack?: string };

  // UI state
  isExpanded?: boolean;
}

type TraceEntryType =
  | 'trace-start'      // New trace initiated
  | 'prompt-sent'      // System + user prompt to LLM
  | 'llm-response'     // LLM text response
  | 'tool-call'        // Tool invocation started
  | 'tool-result'      // Tool execution completed
  | 'tool-error'       // Tool execution failed
  | 'step-complete'    // Agent step finished
  | 'approval-request' // HITL approval needed
  | 'approval-response'// User approved/rejected
  | 'job-queued'       // Background job added
  | 'job-progress'     // Job progress update
  | 'job-complete'     // Job finished
  | 'job-failed'       // Job failed
  | 'trace-complete'   // Trace finished
  | 'error';           // General error
```

### 2. Enhanced Store Design

```typescript
interface TraceState {
  // Entries indexed by traceId for quick lookup
  entries: Map<string, TraceEntry[]>;
  activeTraceId: string | null;

  // Filters
  filters: {
    types: TraceEntryType[];
    levels: ('debug' | 'info' | 'warn' | 'error')[];
    searchQuery: string;
    showJobEvents: boolean;
  };

  // UI state
  selectedEntryId: string | null;
  isModalOpen: boolean;
  modalEntry: TraceEntry | null;

  // Actions
  addEntry: (entry: TraceEntry) => void;
  updateEntry: (id: string, updates: Partial<TraceEntry>) => void;
  setActiveTrace: (traceId: string) => void;
  setFilters: (filters: Partial<TraceState['filters']>) => void;
  openModal: (entry: TraceEntry) => void;
  closeModal: () => void;
  clearTrace: (traceId?: string) => void;
  exportTrace: (traceId: string) => string; // JSON export
  copyAllLogs: () => Promise<void>;
}
```

### 3. Component Hierarchy

```
EnhancedDebugPanel/
├── TraceHeader
│   ├── TraceSelector (dropdown for historical traces)
│   ├── TraceMetrics (duration, steps, tokens)
│   └── ActionButtons (copy, export, clear)
│
├── TraceFilters
│   ├── TypeFilter (multi-select badges)
│   ├── LevelFilter (error/warn/info toggle)
│   ├── SearchInput (fuzzy search)
│   └── JobEventsToggle
│
├── TraceTimeline
│   ├── TimelineEntry (compact row)
│   │   ├── Timestamp
│   │   ├── TypeBadge (color-coded)
│   │   ├── DurationBadge (if applicable)
│   │   ├── Summary (truncated)
│   │   ├── ExpandButton (accordion)
│   │   └── FullViewButton (modal)
│   │
│   └── TimelineEntryExpanded
│       ├── InputSection (collapsible JSON)
│       └── OutputSection (collapsible JSON)
│
├── TraceDetailModal
│   ├── ModalHeader (type, timestamp, duration)
│   ├── ModalTabs (Input | Output | Metadata)
│   ├── CodeBlock (syntax-highlighted JSON)
│   └── CopyButton
│
└── JobEventsPanel (collapsible sidebar)
    ├── ActiveJobs (progress bars)
    └── RecentJobs (completed/failed)
```

---

## UI/UX Design Specifications

### Color Palette for Entry Types

| Type | Badge Color | Icon |
|------|-------------|------|
| `trace-start` | `bg-slate-500` | Play |
| `prompt-sent` | `bg-blue-500` | MessageSquare |
| `llm-response` | `bg-indigo-500` | Bot |
| `tool-call` | `bg-amber-500` | Wrench |
| `tool-result` | `bg-green-500` | CheckCircle |
| `tool-error` | `bg-red-500` | XCircle |
| `step-complete` | `bg-purple-500` | Layers |
| `approval-request` | `bg-orange-500` | Shield |
| `approval-response` | `bg-cyan-500` | ShieldCheck |
| `job-queued` | `bg-yellow-500` | Clock |
| `job-progress` | `bg-blue-400` | Loader |
| `job-complete` | `bg-emerald-500` | CheckCircle2 |
| `job-failed` | `bg-rose-500` | AlertCircle |
| `trace-complete` | `bg-slate-600` | Flag |
| `error` | `bg-red-600` | AlertTriangle |

### Timeline Entry Design

```
┌─────────────────────────────────────────────────────────────────────┐
│ 10:42:31.234  [tool-call]  [42ms]  cms_get_page                    ▼│
│ ─────────────────────────────────────────────────────────────────── │
│ Getting page data for slug: "home"                                  │
│                                                            [Expand] │
└─────────────────────────────────────────────────────────────────────┘

Expanded:
┌─────────────────────────────────────────────────────────────────────┐
│ 10:42:31.234  [tool-call]  [42ms]  cms_get_page              ▼ [📋]│
│ ─────────────────────────────────────────────────────────────────── │
│ Getting page data for slug: "home"                                  │
│                                                                     │
│ ▼ Input                                                             │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ {                                                               │ │
│ │   "slug": "home",                                               │ │
│ │   "locale": "en"                                                │ │
│ │ }                                                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ▼ Output                                                   [🔍 Full]│
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ {                                                               │ │
│ │   "id": "abc-123",                                              │ │
│ │   "title": "Home Page",                                         │ │
│ │   "sections": [...] // 5 items                                  │ │
│ │ }                                                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Full-Screen Modal Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  [tool-result] cms_get_page                              [📋] [✕]  │
│  10:42:31.276 • Duration: 42ms • Step 3                             │
├─────────────────────────────────────────────────────────────────────┤
│  [Input] [Output] [Metadata]                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ {                                                           │    │
│  │   "success": true,                                          │    │
│  │   "data": {                                                 │    │
│  │     "id": "abc-123",                                        │    │
│  │     "title": "Home Page",                                   │    │
│  │     "slug": "home",                                         │    │
│  │     "sections": [                                           │    │
│  │       {                                                     │    │
│  │         "type": "hero",                                     │    │
│  │         "content": {                                        │    │
│  │           "heading": "Welcome",                             │    │
│  │           "subheading": "..."                               │    │
│  │         }                                                   │    │
│  │       },                                                    │    │
│  │       // ... more sections                                  │    │
│  │     ]                                                       │    │
│  │   }                                                         │    │
│  │ }                                                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Metrics Bar Design

```
┌─────────────────────────────────────────────────────────────────────┐
│ Trace: abc-123-def                                                  │
│ ───────────────────────────────────────────────────────────────────│
│ ⏱ 2.4s total  │  🔧 5 tools  │  📊 1,234 tokens  │  ✅ 3 steps     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Enhanced Store & Data Model (Foundation)

**Files to create:**
- `app/assistant/_stores/trace-store.ts` - Enhanced Zustand store

**Tasks:**
1. Define `TraceEntry` type with all fields
2. Create store with entries Map, filters, and UI state
3. Implement `addEntry`, `updateEntry`, `setFilters`
4. Add `exportTrace` (JSON) and `copyAllLogs` (clipboard)
5. Add timing calculation (duration = end - start)

### Phase 2: Modify SSE Event Processing

**Files to modify:**
- `app/assistant/_hooks/use-agent.ts` - Add timing + enhanced logging

**Tasks:**
1. Track event start times for duration calculation
2. Capture full tool inputs/outputs (not just summaries)
3. Add step numbers to trace entries
4. Parse token usage from `finish` events
5. Store prompt + response payloads

### Phase 3: UI Components

**Files to create:**
- `app/assistant/_components/enhanced-debug/` directory
  - `trace-header.tsx`
  - `trace-filters.tsx`
  - `trace-timeline.tsx`
  - `timeline-entry.tsx`
  - `trace-detail-modal.tsx`
  - `trace-metrics.tsx`
  - `job-events-panel.tsx`
  - `json-viewer.tsx`
  - `index.tsx` (main export)

**Tasks:**
1. TraceHeader: Title, metrics summary, action buttons
2. TraceFilters: Type badges, level toggle, search
3. TraceTimeline: ScrollArea with entries
4. TimelineEntry: Compact view + accordion expand
5. TraceDetailModal: Full-screen Dialog with tabs
6. JsonViewer: Syntax-highlighted, collapsible JSON
7. TraceMetrics: Token/time/step counters
8. JobEventsPanel: Background job monitoring

### Phase 4: Background Job Integration

**Files to modify:**
- `server/workers/image-worker.ts` - Emit SSE events
- `server/routes/agent.ts` - Add job event SSE endpoint

**Tasks:**
1. Create `/api/jobs/events` SSE endpoint
2. Emit job-queued, job-progress, job-complete, job-failed events
3. Connect frontend to job event stream
4. Display active/recent jobs in sidebar panel

### Phase 5: Polish & Edge Cases

**Tasks:**
1. Handle very large payloads (truncate + "show more")
2. Virtualized list for 100+ entries
3. Keyboard navigation (↑↓ to navigate, Enter to expand)
4. Dark/light mode consistency
5. Mobile responsive layout
6. Error boundaries for malformed data
7. Loading states during export

---

## File Structure

```
app/assistant/
├── _stores/
│   ├── log-store.ts          # Keep for backward compat
│   └── trace-store.ts        # NEW: Enhanced store
│
├── _hooks/
│   └── use-agent.ts          # MODIFY: Enhanced event capture
│
└── _components/
    ├── debug-pane.tsx        # DEPRECATED (keep for reference)
    │
    └── enhanced-debug/       # NEW: All debug components
        ├── index.tsx
        ├── trace-header.tsx
        ├── trace-filters.tsx
        ├── trace-timeline.tsx
        ├── timeline-entry.tsx
        ├── trace-detail-modal.tsx
        ├── trace-metrics.tsx
        ├── job-events-panel.tsx
        ├── json-viewer.tsx
        └── types.ts

components/
└── ui/
    └── (existing shadcn components)
```

---

## Dependencies

### Existing (no changes needed)
- `zustand` - State management
- `@radix-ui/react-collapsible` - Accordion
- `@radix-ui/react-dialog` - Modal
- `@radix-ui/react-tabs` - Tab navigation
- `@radix-ui/react-scroll-area` - Scrollable container
- `lucide-react` - Icons
- `shiki` - Syntax highlighting (via CodeBlock)

### Potential additions
- `react-window` - Virtual list for large traces (if needed)
- `date-fns` - Already installed, use for timestamp formatting

---

## Success Criteria

1. **Visibility**: Every LLM call shows full prompt + response
2. **Timing**: Duration displayed for all operations
3. **Inspection**: Large payloads viewable in full-screen modal
4. **Export**: One-click copy all logs as JSON
5. **Filtering**: Quick filter by type, level, or search text
6. **Jobs**: Background job status visible in real-time
7. **Performance**: Smooth scrolling with 100+ entries
8. **UX**: Compact timeline, expandable details, modal for deep inspection

---

## Example Usage Flow

1. User sends prompt to agent
2. Debug panel shows `trace-start` with traceId
3. `prompt-sent` entry appears with full system + user prompt
4. `tool-call` entries appear as tools execute (with duration)
5. `tool-result` entries show outputs (truncated in timeline, full in modal)
6. If image processing triggers, `job-queued` → `job-progress` → `job-complete`
7. `llm-response` shows final text
8. `trace-complete` with total duration and token usage
9. User clicks "Copy All" → JSON copied to clipboard
10. User clicks expand on large payload → full-screen modal opens

---

## Notes

- Keep backward compatibility with existing `log-store` until migration complete
- Use existing CodeBlock component for syntax highlighting
- Follow existing shadcn/Radix patterns for consistency
- All timestamps in milliseconds for precision timing
- Consider adding trace persistence to localStorage for debugging across refreshes
