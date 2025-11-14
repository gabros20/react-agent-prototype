# Getting Started Guide

**Welcome!** This guide will walk you through setting up and testing the ReAct AI Agent CMS from scratch. No prior knowledge assumed.

---

## Table of Contents

1. [What Is This?](#what-is-this)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Understanding the Architecture](#understanding-the-architecture)
5. [Starting the Stack](#starting-the-stack)
6. [Testing the CMS API](#testing-the-cms-api)
7. [Testing the Preview Server](#testing-the-preview-server)
8. [Testing the AI Agent](#testing-the-ai-agent)
9. [Troubleshooting](#troubleshooting)

---

## What Is This?

This is an **AI-powered Content Management System** with three main components:

1. **CMS API** (port 8787): RESTful API for managing pages, sections, and content
2. **Preview Server** (port 4000): Renders your CMS pages as a real website  
3. **AI Assistant** (port 3000): Chat with a unified ReAct agent that manages your CMS

The AI agent can:
- ✅ Create, read, update, and delete pages
- ✅ Add sections to pages (hero, features, CTA)
- ✅ Update page content
- ✅ Search for resources using natural language (fuzzy search)
- ✅ Execute multi-step tasks autonomously
- ✅ Self-correct when errors occur

---

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   ```bash
   node --version
   # Should show v18.x.x or higher
   ```

2. **pnpm** (package manager)
   ```bash
   # Install if you don't have it
   npm install -g pnpm
   
   # Verify
   pnpm --version
   ```

3. **OpenRouter API Key** (for AI features)
   - Sign up at [https://openrouter.ai/](https://openrouter.ai/)
   - Get your API key from [https://openrouter.ai/keys](https://openrouter.ai/keys)
   - Free tier available!

### Recommended (Optional)

- **VS Code** with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
- **Postman** or **Insomnia** for API testing

---

## Installation

### Step 1: Clone & Install Dependencies

```bash
# Navigate to project directory
cd /path/to/react-agent-prototype

# Install all dependencies (~2-3 minutes)
pnpm install
```

**What this does**: Installs 300+ packages including Next.js, Express, Drizzle ORM, AI SDK, and more.

### Step 2: Configure Environment Variables

Create `.env` file in the project root:

```bash
# Copy example if it exists, or create new file
cp .env.example .env

# Or create manually
touch .env
```

Add your OpenRouter API key to `.env`:

```bash
# Required: OpenRouter API key
OPENROUTER_API_KEY=sk-or-v1-YOUR-API-KEY-HERE

# Optional: Override default model (default: google/gemini-2.0-flash-exp:free)
OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free

# Optional: Custom headers (for OpenRouter dashboard tracking)
OPENROUTER_HEADERS={"HTTP-Referer": "http://localhost:3000", "X-Title": "ReAct CMS Agent"}

# Optional: Database paths (defaults work fine)
DATABASE_URL=file:data/sqlite.db
LANCEDB_DIR=data/lancedb

# Optional: Server ports (defaults work fine)
EXPRESS_PORT=8787
PREVIEW_PORT=4000
NEXT_PORT=3000
```

**Important**: Replace `YOUR-API-KEY-HERE` with your actual OpenRouter API key!

### Step 3: Initialize Database

```bash
# Create database schema
pnpm db:push

# Seed with sample data (creates 1 page, 3 section definitions, 1 blog post)
pnpm seed
```

**Expected output**:
```
✅ Seed completed successfully!
Team ID: xxx-xxx-xxx
Site ID: xxx-xxx-xxx
Environment ID: xxx-xxx-xxx
Home Page ID: xxx-xxx-xxx
Session ID: xxx-xxx-xxx
```

### Step 4: Populate Vector Index (Optional but Recommended)

```bash
# Index existing content for semantic search
pnpm reindex
```

**Expected output**:
```
✅ Reindexing completed
   Pages indexed: 1
   Sections indexed: 3
   Collections indexed: 1
   Entries indexed: 1
```

### Step 5: Verify Installation

```bash
# Check TypeScript compilation
pnpm typecheck

# Expected: No errors
```

**Success!** You're ready to start the servers.

---

## Understanding the Architecture

Before starting, let's understand what you just installed:

### Three-Server Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Computer                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Port 3000: Next.js Frontend                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • AI Assistant Chat UI                              │  │
│  │  • Debug Log Panel                                   │  │
│  │  • Mode Selector (Architect/CRUD/Debug/Ask)        │  │
│  │  • HITL Approval Modal                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓ HTTP                             │
│  Port 8787: Express API Server                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • CMS CRUD endpoints (/v1/pages, /sections, etc)   │  │
│  │  • AI Agent streaming (/v1/agent/stream)            │  │
│  │  • Vector search (/v1/search/resources)             │  │
│  │  • 17 AI Tools (createPage, deletePage, etc)        │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  Port 4000: Preview Web Server                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • Renders CMS pages as HTML                         │  │
│  │  • Nunjucks template engine                          │  │
│  │  • Your actual website preview                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  Data Layer                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • SQLite database (data/sqlite.db)                  │  │
│  │  • LanceDB vector index (data/lancedb/)              │  │
│  │  • Uploaded media (data/uploads/)                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Example

**User asks AI**: "Create an About page with a hero section"

```
1. User types in Chat UI (port 3000)
2. Frontend sends to /api/agent  
3. Next.js proxies to Express (port 8787)
4. Unified ReAct Agent thinks step-by-step
5. Agent calls cms.createPage tool
6. Tool creates page in SQLite
7. Agent calls cms.addSectionToPage tool  
8. Agent calls cms.syncPageContent tool
9. Results streamed back via SSE
10. Frontend updates chat (blue bubbles) & execution log
11. User can preview at http://localhost:4000/pages/about
```

### Key Concepts

**1. Tools** (13 available)
- CMS tools: `cms.createPage`, `cms.updatePage`, `cms.getPage`, `cms.addSectionToPage`, etc.
- Search tools: `cms.findResource` (semantic/fuzzy search)
- HTTP tools: `http.get`, `http.post` (external APIs)
- Planning tools: `plan.analyzeTask` (task breakdown)

**2. Unified ReAct Agent**
- **Single agent** - No modes, all tools available always
- **Think → Act → Observe → Repeat** loop
- **Self-correcting** - Retries on errors with exponential backoff
- **Max 15 steps** per conversation turn
- **Autonomous** - Chains multiple operations without asking permission

**3. Native AI SDK v6 Pattern**
- Tools created once with `experimental_context`
- No custom abstractions or factories
- Memory managed via `prepareStep` callback
- Auto-checkpointing every 3 steps
- Streaming with full SSE support

---

## Starting the Stack

### Option 1: Start All Servers at Once (Recommended)

```bash
pnpm dev
```

**What this does**:
- Starts API server on port 8787
- Starts preview server on port 4000
- Starts Next.js on port 3000
- Runs all 3 in parallel with colored output

**Expected output**:
```
[server] ✅ Tool Registry initialized with 17 tools
[server] ⏳ Warming up prompt cache...
[server] ✓ Prompt cache warmed up (14 files, 1ms)
[server] ✓ Vector index opened
[server] ✓ Services initialized
[server] ✅ Express API server running on http://localhost:8787
[preview] ✅ Preview web server running on http://localhost:4000
[web]     ▲ Next.js 15.1.3 ready
[web]     - Local:        http://localhost:3000
```

### Option 2: Start Servers Individually

**Terminal 1: API Server**
```bash
pnpm dev:server
```

**Terminal 2: Preview Server**
```bash
pnpm dev:preview
```

**Terminal 3: Next.js Frontend**
```bash
pnpm dev:web
```

### Verify Servers Are Running

Open these URLs in your browser:

1. **API Health Check**: http://localhost:8787/health
   - Should show: `{"status":"ok","timestamp":"..."}`

2. **Preview Site**: http://localhost:4000/
   - Should redirect to homepage automatically
   - Or visit directly: http://localhost:4000/pages/home?locale=en
   - Should show rendered homepage with hero section

3. **AI Assistant**: http://localhost:3000/assistant
   - Should show chat interface with debug log

**Note**: The preview server only serves `/pages/:slug` routes. Visiting the root `/` redirects to the homepage for convenience.

**Success!** All servers are running.

---

## Testing the CMS API

Let's test the API directly using curl or your browser.

### Test 1: Health Check

```bash
curl http://localhost:8787/health
```

**Expected response**:
```json
{
  "status": "ok",
  "timestamp": "2025-11-10T12:34:56.789Z"
}
```

### Test 2: List Pages

```bash
curl http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages
```

**Expected response**:
```json
{
  "data": {
    "count": 1,
    "pages": [
      {
        "id": "...",
        "slug": "home",
        "name": "Homepage",
        "indexing": true,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ]
  },
  "statusCode": 200
}
```

### Test 3: Get Page with Sections

```bash
curl "http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages?slug=home"
```

**What to look for**:
- Page has sections array
- First section is "hero" type
- Content includes title, subtitle, etc.

### Test 4: Create a New Page

```bash
curl -X POST http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages \
  -H "Content-Type: application/json" \
  -d '{
    "name": "About Us",
    "slug": "about",
    "indexing": true,
    "meta": {
      "title": "About Us - Our Story",
      "description": "Learn more about our company"
    }
  }'
```

**Expected response**:
```json
{
  "data": {
    "id": "...",
    "slug": "about",
    "name": "About Us",
    "indexing": true,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "statusCode": 201
}
```

**Verify**: List pages again - you should now see 2 pages.

### Test 5: Vector Search

```bash
curl -X POST http://localhost:8787/v1/cms/search/resources \
  -H "Content-Type: application/json" \
  -d '{
    "query": "homepage",
    "type": "page",
    "limit": 3
  }'
```

**Expected response**:
```json
{
  "data": [
    {
      "id": "...",
      "type": "page",
      "name": "Homepage",
      "slug": "home",
      "similarity": 0.95
    }
  ],
  "statusCode": 200
}
```

**Try these search queries**:
- `"home page"` → finds "home"
- `"hme pag"` → still finds "home" (typo tolerance)
- `"landing"` → finds "home" (semantic match)

### Test 6: List Section Definitions

```bash
curl http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/sections
```

**Expected**: 3 section definitions (hero, feature, cta)

---

## Testing the Preview Server

The preview server renders your CMS pages as actual HTML.

### Test 1: View Homepage

**Browser**: http://localhost:4000/pages/home?locale=en

**What you should see**:
- Purple gradient hero section
- Title: "Welcome to Our CMS"
- Subtitle: "AI-powered content management"
- "Get Started" button
- Professional styling (not raw HTML)

### Test 2: View Raw JSON

**Browser**: http://localhost:4000/pages/home/raw?locale=en

**What you should see**:
```json
{
  "data": {
    "id": "...",
    "slug": "home",
    "sections": [
      {
        "sectionKey": "hero",
        "content": {
          "title": "Welcome to Our CMS",
          "subtitle": "AI-powered content management",
          ...
        }
      }
    ]
  }
}
```

### Test 3: Change Content and Reload

**Step 1**: Update page content via API
```bash
curl -X PUT http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages/PAGE_ID \
  -H "Content-Type: application/json" \
  -d '{"name": "Homepage - Updated!"}'
```

**Step 2**: Refresh preview
- Go to http://localhost:4000/pages/home?locale=en
- You should see the updated name

### Test 4: View Non-Existent Page

**Browser**: http://localhost:4000/pages/nonexistent?locale=en

**Expected**: 404 error page

---

## Testing the AI Agent

Now for the fun part - chatting with the AI!

### Getting to the Assistant

1. Open http://localhost:3000/assistant in your browser
2. You should see:
   - **Left side**: Execution log panel (1/3 width)
   - **Right side**: Chat interface (2/3 width) 
   - **Header**: Bot icon + "CMS ReAct Agent" title

### Understanding the UI

**Chat Pane** (Right side, main focus):
- Type messages to the agent
- Agent responds in **blue chat bubbles** (assistant messages)
- User messages in gray
- Streaming responses (text appears word-by-word)
- Auto-scrolls to show latest messages

**Execution Log** (Left side):
- Shows all agent actions in real-time
- Color-coded by type:
  - 🔵 Blue: Tool calls
  - 🟢 Green: Tool results  
  - 🟣 Purple: Step complete
  - 🔴 Red: Errors
  - ⚪ Gray: Info messages
- Terminal icon with "Execution Log" label

---

## Test Cases for AI Agent

### Test Case 1: List Existing Pages

**Prompt**:
```
What pages exist in the CMS?
```

**Expected behavior**:
1. Execution log shows: Tool call → `cms.listPages`
2. Execution log shows: Tool result with page list
3. Chat responds in blue bubble: "There are 2 pages: home and about"

**Look for**:
- Agent uses appropriate tool
- Results displayed clearly
- Friendly response format

---

### Test Case 2: Create a Simple Page

**Prompt**:
```
Create a "Contact" page with slug "contact"
```

**Expected behavior**:
1. Agent calls `cms.createPage` with correct slug
2. Execution log shows page created successfully
3. Chat responds with confirmation
4. Check: http://localhost:8787/v1/.../pages shows 3 pages

**Look for**:
- Correct slug format (lowercase, hyphens only)
- Success message with page details
- Blue chat bubble for assistant response

**Verify**:
```bash
curl http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages | grep contact
```

---

### Test Case 3: Add Section to Page

**Prompt**:
```
Add a hero section to the contact page with title "Get in Touch"
```

**Expected behavior**:
1. Agent uses `cms.findResource` to find contact page
2. Agent uses `cms.findResource` to find hero section definition
3. Agent calls `cms.addSectionToPage`
4. Agent calls `cms.syncPageContent` with title content
5. All steps chained autonomously

**Look for**:
- Multi-step reasoning (4-5 tool calls)
- Proper chaining without asking permission
- Content populated correctly

**Verify**:
- Visit http://localhost:4000/pages/contact?locale=en
- Should show hero with "Get in Touch" title

---

### Test Case 4: Semantic Search

**Prompt**:
```
Find pages about contacting us
```

**Expected behavior**:
1. Agent calls `cms.findResource` with query "contacting us"
2. Vector search returns contact page (fuzzy match)
3. Agent responds with page details

**Look for**:
- Fuzzy matching works (finds "contact" from "contacting")
- Agent interprets results naturally
- Blue bubble response

---

### Test Case 5: Error Recovery with Retry

**Prompt**:
```
Create a page with slug "home"
```

**Expected behavior**:
1. Agent calls `cms.createPage` with slug "home"
2. Database returns UNIQUE constraint error (home already exists)
3. Agent observes error in red
4. Agent retries automatically with exponential backoff
5. Eventually provides helpful error message

**Look for**:
- Red error log entry
- Retry attempts visible in execution log
- Agent explains the issue clearly
- Exponential backoff delays (1s, 2s, 4s)

---

### Test Case 6: Complex Multi-Step Task

**Prompt**:
```
Create a "Services" page with a hero section (title: "Our Services") and a feature section (heading: "What We Offer")
```

**Expected behavior**:
1. Agent autonomously chains 6+ steps:
   - Creates page
   - Finds hero section definition
   - Adds hero section
   - Syncs hero content
   - Finds feature section definition
   - Adds feature section
   - Syncs feature content
2. All steps execute without asking permission
3. Final confirmation in blue bubble

**Look for**:
- Think → Act → Observe → Repeat pattern
- Each tool call logged separately
- Smooth chaining of operations
- Final success message

**Verify**:
```bash
# Check page exists
curl http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages | grep services

# View rendered page
open http://localhost:4000/pages/services?locale=en
```

---

## Session Management

The assistant supports multiple chat sessions with full history persistence.

**Features**:
- Create unlimited sessions
- Switch between sessions instantly  
- All messages saved to database
- Sessions persist across browser reloads

**How to Use**:
1. Click "New Session" button to start fresh conversation
2. Switch between sessions by clicking on them in the sidebar (left panel, mobile hidden)
3. Each session maintains its own conversation history
4. Messages auto-saved after each agent response

---

## Troubleshooting

### Problem: Agent not responding

**Symptom**: Message sent but no response appears

**Solution**:
1. Check browser console for errors (F12 → Console)
2. Check API server logs in terminal
3. Verify OpenRouter API key is valid in `.env`
4. Try refreshing the page (Cmd/Ctrl + R)
5. Try a simpler prompt: "What pages exist?"

### Problem: "Cannot read properties of undefined"

**Symptom**: JavaScript errors in browser console

**Solution**:
1. Hard refresh: Cmd/Ctrl + Shift + R
2. Clear browser cache
3. Restart dev servers: `pnpm dev`
4. Check that all dependencies installed: `pnpm install`

### Problem: Tool execution fails

**Symptom**: Execution log shows red error entries

**Solution**:
1. Check error message in execution log
2. Common issues:
   - Slug already exists → Use different slug
   - Page/section not found → Use `cms.findResource` first
   - Invalid format → Check slug is lowercase with hyphens only
3. Agent should retry automatically with exponential backoff
4. If agent doesn't recover, provide more context in next message

### Problem: Preview shows 404

**Symptom**: http://localhost:4000/pages/slug shows "Page not found"

**Solution**:
```bash
# Check database has pages
pnpm db:studio
# Open browser → check "pages" table has data

# Re-seed if empty
pnpm seed

# Check slug is correct
curl http://localhost:8787/v1/.../pages
# Use exact slug from response
```

### Problem: Vector search returns no results

**Symptom**: Agent can't find resources with semantic search

**Solution**:
```bash
# Reindex vector database
pnpm reindex

# Check LanceDB directory exists
ls -la data/lancedb/

# Verify OpenRouter API key works (same key for chat + embeddings)
```

---

## Next Steps

### Learn More

- Read [README.md](README.md) for architecture overview
- Read [PROGRESS.md](docs/PROGRESS.md) for implementation history
- Read [IMPLEMENTATION_SPRINTS.md](docs/IMPLEMENTATION_SPRINTS.md) for detailed sprint breakdown

### Key Documentation

- **Native AI SDK v6 Pattern**: `docs/NATIVE_AI_SDK_REFACTOR_PLAN.md`
- **Unified ReAct Agent**: `docs/UNIFIED_REACT_AGENT_REFACTOR.md`
- **UI Overhaul**: `docs/UI_OVERHAUL_SUMMARY.md`

### Development

**Explore the code**:
1. `server/agent/orchestrator.ts` - Unified ReAct agent orchestrator
2. `server/tools/all-tools.ts` - All 13 tools with native patterns
3. `server/prompts/react.xml` - Single unified prompt
4. `app/assistant/_hooks/use-agent.ts` - Frontend streaming integration

**Add new tools**:
1. Add tool to `server/tools/all-tools.ts` using `tool()` from AI SDK
2. Export from `ALL_TOOLS` object
3. Tool automatically available to agent (no registration needed)

**Modify prompt**:
1. Edit `server/prompts/react.xml`
2. Server auto-reloads in development
3. Test with agent immediately

---

## Summary Checklist

Before testing, verify:

- [x] Dependencies installed (`pnpm install`)
- [x] `.env` file created with OpenRouter API key
- [x] Database initialized (`pnpm db:push`)
- [x] Sample data seeded (`pnpm seed`)
- [x] Vector index populated (`pnpm reindex`)
- [x] All servers running (`pnpm dev`)
- [x] API health check passes (http://localhost:8787/health)
- [x] Preview renders pages (http://localhost:4000/pages/home?locale=en)
- [x] Assistant UI loads (http://localhost:3000/assistant)

**You're ready to test!** Start with simple prompts and progress to complex multi-step tasks.

Happy testing! 🚀

**Step 2**: Create a test page
```
Create a "Test Delete" page
```

**Step 3**: Try to delete it
```
Delete the "Test Delete" page
```

### HITL Flow Walkthrough

**1. Agent Detection**
- Agent wants to call `cms.deletePage`
- Detects `requiresApproval: true`
- Pauses execution

**2. Approval Event Emitted**
- SSE event sent to frontend
- Type: `approval-required`
- Contains: toolName, input, description, traceId

**3. Frontend Response**
- Debug log shows: 🛡️ Yellow "Approval Required" badge
- Modal automatically appears
- Modal content:
  ```
  ⚠️ Approval Required
  
  Tool: cms.deletePage
  Description: Delete a page and all sections. DESTRUCTIVE - Cannot be undone.
  
  Input:
  {
    "id": "...",
    "confirm": true
  }
  
  [Reject] [Approve]
  ```

**4. User Decision**

**Option A: Click Approve**
- POST to /api/agent/approve with decision: "approve"
- Backend receives approval
- Modal closes
- Tool executes
- Page deleted
- Success message in chat

**Option B: Click Reject**
- POST to /api/agent/approve with decision: "reject"
- Backend receives rejection
- Modal closes
- Tool does NOT execute
- Page remains in database
- Agent informed of rejection

**5. Logging**
- All approval requests logged with traceId
- Audit trail maintained
- Circuit breaker tracks rejections

### Testing Different Approval Scenarios

**Test 1: Multiple Approvals**
```
Delete pages: "test1", "test2", "test3"
```
- Should show 3 approval modals sequentially
- Each requires separate approval
- Can mix approve/reject

**Test 2: Approval with Validation Failure**
```
Delete a page that doesn't exist
```
- Tool calls with approval
- User approves
- Tool executes but fails (not found)
- Agent observes failure
- Agent reports error naturally

**Test 3: Reject then Retry**
```
User: Delete the contact page
Agent: [Shows approval modal]
User: [Clicks Reject]
Agent: Okay, I won't delete it.
User: Actually, go ahead and delete it
Agent: [Shows approval modal again]
User: [Clicks Approve]
Agent: Done! Page deleted.
```

---

## Troubleshooting

### Problem: "OPENROUTER_API_KEY not found"

**Symptom**: Server starts but agent fails with API key error

**Solution**:
```bash
# Check .env file exists
ls -la .env

# Check key is set
cat .env | grep OPENROUTER_API_KEY

# Make sure no spaces around =
# Correct: OPENROUTER_API_KEY=sk-or-v1-...
# Wrong:   OPENROUTER_API_KEY = sk-or-v1-...
```

### Problem: "Port already in use"

**Symptom**: Server fails to start with EADDRINUSE error

**Solution**:
```bash
# Find process using port 8787
lsof -i :8787

# Kill process (replace PID)
kill -9 PID

# Or use different ports in .env
EXPRESS_PORT=8788
PREVIEW_PORT=4001
NEXT_PORT=3001
```

### Problem: Database locked

**Symptom**: "database is locked" error

**Solution**:
```bash
# Stop all servers
# Delete database and recreate
rm data/sqlite.db
pnpm db:push
pnpm seed
```

### Problem: "Can't resolve 'tw-animate-css'"

**Symptom**: Next.js fails to start with CSS import error

**Solution**:
This was already fixed in the codebase. If you still see it:
```bash
# Check app/globals.css line 1
# Should NOT have: @import "tw-animate-css";
# Should have: @plugin "tailwindcss-animate";

# If needed, remove the import line manually
```

### Problem: TypeScript errors

**Symptom**: Red squiggly lines in VS Code

**Solution**:
```bash
# Verify no actual errors
pnpm typecheck

# Restart TypeScript server in VS Code
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Problem: Agent not responding

**Symptom**: Message sent but no response in chat

**Solution**:
1. Check browser console for errors (F12)
2. Check API server logs (terminal)
3. Verify API key is valid
4. Try simpler prompt: "Hello"
5. Check debug log for error messages

### Problem: Preview shows 404

**Symptom**: http://localhost:4000/pages/home shows "Page not found" (or root `/` shows "Cannot GET /")

**Solution**:
```bash
# Check database has pages
pnpm db:studio
# Open browser → check "pages" table has data

# Re-seed if empty
pnpm seed

# Check slug is correct
curl http://localhost:8787/v1/.../pages
# Use exact slug from response
```

### Problem: Vector search returns no results

**Symptom**: Agent can't find resources with semantic search

**Solution**:
```bash
# Reindex vector database
pnpm reindex

# Check LanceDB directory exists
ls -la data/lancedb/

# Verify OpenRouter embeddings API key works
# (same key as chat API)
```

### Problem: Modal doesn't appear for approval

**Symptom**: HITL approval expected but modal doesn't show

**Solution**:
1. Check browser console for JavaScript errors
2. Verify approval-store is imported in use-agent.ts
3. Check debug log for "🛡️ Approval Required" entry
4. Try refreshing page (Cmd+R)
5. Check Network tab for SSE events

---

## Next Steps

### Learn More

- Read [PLAN.md](PLAN.md) for architecture details
- Read [PROGRESS.md](PROGRESS.md) for implementation status
- Read [PROMPT_ARCHITECTURE_BLUEPRINT.md](docs/PROMPT_ARCHITECTURE_BLUEPRINT.md) for prompt system

### Explore the Code

**Start with these files**:
1. `server/agent/orchestrator.ts` - AI agent brain
2. `server/tools/registry.ts` - Tool system
3. `app/assistant/_hooks/use-agent.ts` - Frontend integration
4. `server/prompts/` - Agent instructions

### Extend the System

**Add a new tool**:
1. Create `server/tools/categories/cms/your-tool.ts`
2. Use `createCMSTool()` factory
3. Export from `server/tools/categories/cms/index.ts`
4. Auto-registered on server restart

**Add a new agent mode**:
1. Create `server/prompts/modes/your-mode.xml`
2. Add to `AgentMode` type in `server/tools/types.ts`
3. Add config in `server/agent/orchestrator.ts`
4. Update registry filters

**Add a new template**:
1. Create `server/templates/sections/your-section/default.njk`
2. Add section definition via API or seed script
3. Template auto-discovered by renderer

### Get Help

- **Issues**: Check [GitHub Issues](https://github.com/...)
- **Discussions**: Use [GitHub Discussions](https://github.com/...)
- **Discord**: Join our community server

---

## Summary Checklist

Before you start testing, verify:

- [x] Dependencies installed (`pnpm install`)
- [x] `.env` file created with OpenRouter API key
- [x] Database initialized (`pnpm db:push`)
- [x] Sample data seeded (`pnpm seed`)
- [x] Vector index populated (`pnpm reindex`)
- [x] All servers running (`pnpm dev`)
- [x] API health check passes (http://localhost:8787/health)
- [x] Preview root redirects (http://localhost:4000/ → /pages/home)
- [x] Preview renders pages (http://localhost:4000/pages/home)
- [x] Assistant UI loads (http://localhost:3000/assistant)

**You're ready to test!** Start with simple prompts and work your way up to complex multi-step tasks.

Happy testing! 🚀
