# Architecture Visualization Index

Complete guide to understanding the ReAct AI Agent codebase through visual diagrams and code references.

## 📚 Documentation Overview

### 1. **ARCHITECTURE_VISUALIZATIONS.md** - Start Here
High-level system diagrams with direct code references.

**Best for:** Understanding the overall system, seeing how pieces fit together.

**Contains:**
- System Architecture Overview (3-server setup)
- Agent Execution Flow (ReAct loop with state machine)
- Data Flow & Integration Layers
- CMS Operations & Services
- Memory & Context Management
- Session & Human-in-the-Loop Flow
- Tool Execution & Dependency Injection
- Frontend-Backend Integration (SSE streaming)

**Code References Added:**
- File paths for every major component
- Key function names (`streamAgentWithApproval()`, `EntityExtractor.extract()`, etc.)
- Line number ranges for important sections
- Class and method names

---

### 2. **MODULE_INTEGRATION_PATTERNS.md** - Technical Deep Dive
Detailed technical patterns with implementation examples.

**Best for:** Understanding HOW patterns work, seeing actual code.

**Contains:**
- Prompt System Integration (Handlebars templating)
- Tool Registry & Execution Pipeline (AI SDK v6)
- Memory Management Architecture (entity extraction)
- Session Lifecycle & Persistence (CRUD operations)
- HITL Approval Flow (promise-based)
- Vector Search Integration (auto-sync)
- Service Container & DI (singleton pattern)
- Retry & Error Recovery (exponential backoff)

**Code References Added:**
- Complete file paths with line numbers
- Full code examples showing implementation
- Function signatures and usage patterns
- Configuration constants and their values

---

### 3. **CORE_PATTERN_CONNECTIONS.md** - Conceptual Understanding
How patterns interconnect and why they exist.

**Best for:** Understanding WHY patterns exist, seeing the big picture.

**Contains:**
- Pattern Ecosystem (complete system flow)
- Pattern Relationships (dependency matrix)
- Data Flow Through Patterns (sequence diagrams)
- Pattern Dependencies (5-layer hierarchy)
- Why Patterns Matter (problem/solution/benefit)
- Pattern Cheat Sheet (quick reference)

**Code References Added:**
- Quick file lookup map
- Function names in pattern descriptions
- Line number references for key implementations
- Code snippets showing pattern usage

---

## 🎯 Quick Navigation Guide

### By Task

**"I want to understand the agent execution flow"**
→ Start: `ARCHITECTURE_VISUALIZATIONS.md` Section 2
→ Code: `server/agent/orchestrator.ts` lines 300-500
→ Function: `streamAgentWithApproval()`

**"I want to see how tools work"**
→ Start: `MODULE_INTEGRATION_PATTERNS.md` Section 2
→ Code: `server/tools/all-tools.ts` (all 45 tools)
→ Example: `cmsGetPage` tool

**"I want to understand memory management"**
→ Start: `ARCHITECTURE_VISUALIZATIONS.md` Section 5
→ Deep Dive: `MODULE_INTEGRATION_PATTERNS.md` Section 3
→ Code: `server/services/working-memory/` directory
→ Key Classes: `EntityExtractor`, `WorkingContext`

**"I want to see how HITL confirmation works"**
→ Start: `ARCHITECTURE_VISUALIZATIONS.md` Section 6
→ Deep Dive: `MODULE_INTEGRATION_PATTERNS.md` Section 5
→ Pattern: Conversational confirmed flag (see `LAYER_3.5_HITL.md`)
→ Example: `cmsDeletePage` tool with `confirmed` parameter

**"I want to understand session management"**
→ Start: `MODULE_INTEGRATION_PATTERNS.md` Section 4
→ Code: `server/services/session-service.ts`
→ Frontend: `app/assistant/_stores/session-store.ts`
→ Routes: `server/routes/sessions.ts`

**"I want to see the complete data flow"**
→ Start: `ARCHITECTURE_VISUALIZATIONS.md` Section 3
→ Pattern View: `CORE_PATTERN_CONNECTIONS.md` Section 3
→ Follow: User → API → Service → Agent → Data

### By Component

**Agent System:**
```
orchestrator.ts:
- createAgent() - lines 90-110
- streamAgentWithApproval() - lines 300-500
- executeWithRetry() - lines 200-250
- getSystemPrompt() - lines 45-65
```

**Tools:**
```
all-tools.ts:
- cms.getPage - lines 15-65
- cms.createPage - lines 70-120
- cms.listPages - lines 125-160
- ALL_TOOLS export - line 750
- TOOL_METADATA - line 760
```

**Memory:**
```
working-memory/entity-extractor.ts:
- EntityExtractor.extract() - lines 15-60

working-memory/working-context.ts:
- WorkingContext.add() - line 20
- WorkingContext.toContextString() - lines 35-55
```

**Sessions:**
```
session-service.ts:
- SessionService.createSession() - line 35
- SessionService.loadMessages() - line 85
- SessionService.saveMessages() - line 110
```

**HITL (Conversational Confirmation):**
```
all-tools.ts:
- cmsDeletePage({ confirmed: true }) - confirmed flag pattern
- See LAYER_3.5_HITL.md for flow details
```

### By Pattern

**Native AI SDK v6 Pattern:**
- Concept: `CORE_PATTERN_CONNECTIONS.md` Section 5
- Implementation: `MODULE_INTEGRATION_PATTERNS.md` Section 2
- Code: `server/tools/all-tools.ts` (any tool definition)
- Key: `experimental_context` parameter injection

**ReAct Loop Pattern:**
- Flow: `ARCHITECTURE_VISUALIZATIONS.md` Section 2
- Concept: `CORE_PATTERN_CONNECTIONS.md` Section 1
- Code: `server/agent/orchestrator.ts` lines 300-500
- Key: Think → Act → Observe → Repeat

**Working Memory Pattern:**
- Diagram: `ARCHITECTURE_VISUALIZATIONS.md` Section 5
- Technical: `MODULE_INTEGRATION_PATTERNS.md` Section 3
- Code: `server/services/working-memory/` directory
- Key: Entity extraction + sliding window

**HITL Pattern (Conversational):**
- Sequence: `ARCHITECTURE_VISUALIZATIONS.md` Section 6
- Technical: `MODULE_INTEGRATION_PATTERNS.md` Section 5
- Code: Tools with `confirmed` parameter (e.g., `cmsDeletePage`)
- Key: Conversational confirmation via chat

---

## 📁 File Reference Map

### Core Agent Files
```
server/agent/
└── orchestrator.ts ..................... Agent orchestration, retry logic

server/tools/
├── all-tools.ts ........................ All 45 tool definitions
└── types.ts ............................ AgentContext interface

server/prompts/
└── react.xml ........................... Unified prompt template
```

### Service Layer
```
server/services/
├── working-memory/
│   ├── entity-extractor.ts ............. Entity extraction logic
│   ├── working-context.ts .............. Sliding window storage
│   └── types.ts ........................ Entity interfaces
├── agent/
│   ├── orchestrator.ts ................. AgentOrchestrator service
│   └── types.ts ........................ Orchestrator types
├── session-service.ts .................. Message persistence
├── conversation-log-service.ts ......... Debug log persistence
├── service-container.ts ................ DI container (singleton)
├── vector-index.ts ..................... LanceDB operations
└── cms/
    ├── page-service.ts ................. Page CRUD + validation
    ├── section-service.ts .............. Section management
    └── entry-service.ts ................ Collection entries
```

### API Routes
```
server/routes/
├── agent.ts ............................ SSE streaming endpoint
├── sessions.ts ......................... Session CRUD routes
└── cms.ts .............................. CMS REST endpoints

server/index.ts ......................... Express server entry point
```

### Database
```
server/db/
├── schema.ts ........................... Drizzle table definitions
└── client.ts ........................... Database connection

data/
├── sqlite.db ........................... SQLite database file
└── lancedb/ ............................ Vector index storage
```

### Frontend
```
app/assistant/
├── page.tsx ............................ Main assistant layout
├── _hooks/
│   ├── use-agent.ts .................... SSE streaming hook
│   └── use-worker-events.ts ............ Worker SSE events
├── _stores/
│   ├── chat-store.ts ................... Message state (Zustand)
│   ├── trace-store.ts .................. Trace entries + metrics
│   ├── session-store.ts ................ Session list + logs
│   └── models-store.ts ................. OpenRouter models
└── _components/
    ├── chat-pane.tsx ................... Chat UI
    └── enhanced-debug/ ................. Debug panel components

app/api/
├── agent/route.ts ...................... API proxy for agent
└── sessions/[sessionId]/route.ts ....... Session API proxy
```

---

## 🚀 Recommended Learning Path

### Day 1: High-Level Understanding
1. Read `ARCHITECTURE_VISUALIZATIONS.md` - All 8 diagrams
2. Open `server/agent/orchestrator.ts` - Follow along with Section 2
3. Open `server/tools/all-tools.ts` - Browse tool definitions
4. Open `app/assistant/page.tsx` - See the UI entry point

### Day 2: Pattern Deep Dive
1. Read `CORE_PATTERN_CONNECTIONS.md` - Sections 1-3
2. Pick ONE pattern (e.g., Working Memory)
3. Read its diagram in `ARCHITECTURE_VISUALIZATIONS.md`
4. Read its technical details in `MODULE_INTEGRATION_PATTERNS.md`
5. Open the actual code files and follow the flow

### Day 3: Implementation Study
1. Choose a feature (e.g., Session Management)
2. Read the pattern documentation
3. Open ALL related files (service, store, routes, API)
4. Trace a complete flow: User action → API → Service → DB
5. Try modifying something small

### Day 4: Agent Flow Walkthrough
1. Start a request in `app/assistant/_hooks/use-agent.ts`
2. Follow to `app/api/agent/route.ts`
3. Follow to `server/routes/agent.ts`
4. Follow to `server/agent/orchestrator.ts`
5. Follow tool execution in `server/tools/all-tools.ts`
6. Follow service calls in `server/services/cms/`
7. See results return to frontend

### Day 5: Build Something
Pick one:
- Add a new tool to `all-tools.ts`
- Add a new service method
- Modify the prompt in `react.xml`
- Add a UI component
- Create a new API route

---

## 🔍 Search Tips

**Find by concept:**
```bash
# Memory management
grep -r "EntityExtractor" server/
grep -r "WorkingContext" server/

# HITL approval
grep -r "approvalQueue" server/
grep -r "needsApproval" server/

# Session management
grep -r "SessionService" server/
grep -r "loadMessages" server/
```

**Find by pattern:**
```bash
# Tool definitions
grep "export const cms" server/tools/all-tools.ts

# Agent functions
grep "async function" server/agent/orchestrator.ts

# Service methods
grep "async " server/services/session-service.ts
```

---

## 📊 Diagram Legend

**Mermaid Diagram Colors:**
- 🔵 Light Blue (`#e1f5ff`) - Agent/ReAct components
- 🟣 Light Purple (`#ffe1f5`) - Memory components
- 🔴 Light Red (`#ffebeb`) - HITL/Safety components
- 🟡 Light Yellow (`#fff4e1`) - Tool components
- 🟢 Light Green (`#e8f5e9`) - Data/Persistence components

**Box Types:**
- Rectangle - Process/Component
- Diamond - Decision point
- Cylinder - Database/Storage
- Rounded Rectangle - Service/Module

**Line Types:**
- Solid Arrow (`→`) - Data flow
- Dashed Arrow (`-.->`) - Optional/conditional flow
- Bidirectional (`↔`) - Two-way relationship

---

## 💡 Pro Tips

1. **Start with diagrams** - Get the visual understanding first
2. **Use line numbers** - Jump directly to referenced code
3. **Follow one flow** - Trace a complete request end-to-end
4. **Run the code** - See it execute while reading
5. **Add console.log** - Trace actual values in key functions
6. **Use debugger** - Set breakpoints in key areas
7. **Read tests** - See patterns in action (if tests exist)

---

## 🎯 Quick Wins

**Want to understand agents quickly?**
→ Read orchestrator.ts lines 300-500 + Section 2 of ARCHITECTURE_VISUALIZATIONS.md

**Want to add a tool?**
→ Copy any tool from all-tools.ts, modify execute function, add to ALL_TOOLS

**Want to understand memory?**
→ Read working-memory/ files + Section 5 of ARCHITECTURE_VISUALIZATIONS.md

**Want to modify the UI?**
→ Start at app/assistant/page.tsx, follow components

**Want to add API endpoint?**
→ Copy pattern from routes/agent.ts, add to server/index.ts

---

## 🤝 Getting Help

**Documentation Issues:**
- File path not working? → Check if file was moved/renamed
- Line numbers off? → Code may have changed since docs written
- Diagram unclear? → Check other diagrams for same concept

**Code Understanding:**
- Read the pattern documentation FIRST
- Follow ONE complete flow end-to-end
- Use VS Code "Go to Definition" (Cmd+Click)
- Search for function calls to see usage

---

This index is your roadmap to mastering the ReAct AI Agent codebase. Start with high-level diagrams, dive into patterns, then explore the actual code with confidence! 🚀
