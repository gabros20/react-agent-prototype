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
9. [Testing HITL Approval System](#testing-hitl-approval-system)
10. [Troubleshooting](#troubleshooting)

---

## What Is This?

This is an **AI-powered Content Management System** with three main components:

1. **CMS API** (port 8787): RESTful API for managing pages, sections, and content
2. **Preview Server** (port 4000): Renders your CMS pages as a real website
3. **AI Assistant** (port 3000): Chat with an AI agent that can manage your CMS

The AI agent can:
- ✅ Create, read, update, and delete pages
- ✅ Add sections to pages (hero, features, CTA)
- ✅ Sync content in multiple languages
- ✅ Search for resources using natural language
- ✅ Validate changes before executing them
- ✅ Ask for approval before destructive operations

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
4. AI Agent (ToolLoopAgent) thinks and plans
5. Agent calls cms.createPage tool
6. Tool creates page in SQLite
7. Tool indexes page in LanceDB
8. Agent calls cms.addSectionToPage tool
9. Results streamed back via SSE
10. Frontend updates chat & debug log
11. User can preview at http://localhost:4000/pages/about
```

### Key Concepts

**1. Tools** (17 available)
- CMS tools: `cms.createPage`, `cms.updatePage`, `cms.deletePage`, etc.
- Search tools: `cms.findResource` (semantic search)
- Planning tools: `cms.validatePlan` (preflight checks)
- HTTP tools: `http.fetch` (external data)

**2. Agent Modes** (4 modes)
- **Architect**: Planning mode (read-only, max 6 steps)
- **CMS CRUD**: Execution mode (all tools, max 10 steps)
- **Debug**: Error analysis (limited writes, max 4 steps)
- **Ask**: Inspection mode (read-only, max 6 steps)

**3. Intelligence Layer**
- **Memory Manager**: Prevents context overflow on long tasks
- **Checkpoint Manager**: Save/resume state after crashes
- **Error Recovery**: Circuit breaker pattern (fail fast)
- **Validation Service**: Pre/post-mutation checks

**4. HITL (Human-in-the-Loop)**
- High-risk tools require user approval
- Modal shows tool details before execution
- Example: `cms.deletePage` asks "Delete page 'About'?"

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

2. **Preview Homepage**: http://localhost:4000/pages/home?locale=en
   - Should show rendered homepage with hero section

3. **AI Assistant**: http://localhost:3000/assistant
   - Should show chat interface with debug log

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
   - **Left side**: Debug log panel (2/3 width)
   - **Right side**: Chat interface (1/3 width)
   - **Top**: Mode selector with 4 tabs

### Understanding the UI

**Mode Selector**:
- **Architect**: Planning and validation (can't create/edit)
- **CMS CRUD**: Full access to create/edit/delete
- **Debug**: Analyze errors and suggest fixes
- **Ask**: Answer questions about CMS structure

**Debug Log**:
- Shows all agent actions in real-time
- Color-coded by type:
  - 🔵 Blue: Tool calls
  - 🟢 Green: Tool results
  - 🟣 Purple: Step complete
  - 🔴 Red: Errors
  - 🟡 Yellow: System events (HITL approval)
  - ⚪ Gray: Info messages

**Chat Pane**:
- Type messages to the agent
- Agent responds with actions + final answer
- Streaming responses (see text appear word-by-word)

---

## Test Cases for AI Agent

### Test Case 1: List Existing Pages (Ask Mode)

**Mode**: Ask (read-only)

**Prompt**:
```
What pages exist in the CMS?
```

**Expected behavior**:
1. Debug log shows: Tool call → `cms.listPages`
2. Debug log shows: Tool result with page list
3. Chat responds: "There are 2 pages: home and about"

**Look for**:
- Agent uses read-only tool
- No mutations attempted
- Friendly response format

---

### Test Case 2: Create a Simple Page (CMS CRUD Mode)

**Mode**: CMS CRUD (full access)

**Prompt**:
```
Create a "Contact" page with slug "contact"
```

**Expected behavior**:
1. Agent calls `cms.createPage` with correct slug
2. Debug log shows validation (page exists after creation)
3. Chat responds: "Page created successfully"
4. Check: http://localhost:8787/v1/.../pages shows 3 pages

**Look for**:
- Correct slug format (lowercase, hyphens only)
- Validation step after creation
- Success message with page details

**Verify**:
```bash
curl http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages | grep contact
```

---

### Test Case 3: Add Section to Page (CMS CRUD Mode)

**Mode**: CMS CRUD

**Prompt**:
```
Add a hero section to the contact page with title "Get in Touch"
```

**Expected behavior**:
1. Agent calls `cms.getPage` to find contact page
2. Agent calls `cms.listSections` to find hero section def
3. Agent calls `cms.addSectionToPage`
4. Agent calls `cms.syncPageContents` with title content
5. All steps succeed

**Look for**:
- Multi-step reasoning (4-5 tool calls)
- Proper chaining of operations
- Content validation

**Verify**:
- Visit http://localhost:4000/pages/contact?locale=en
- Should show hero with "Get in Touch" title

---

### Test Case 4: Semantic Search (Any Mode)

**Mode**: Ask

**Prompt**:
```
Find pages about contacting us
```

**Expected behavior**:
1. Agent calls `cms.findResource` with query "contacting us"
2. Vector search returns contact page
3. Agent responds with page details

**Look for**:
- Fuzzy matching works
- Similarity scores shown
- Agent interprets results naturally

---

### Test Case 5: Validation Failure (CMS CRUD Mode)

**Mode**: CMS CRUD

**Prompt**:
```
Create a page with slug "CONTACT-US-123"
```

**Expected behavior**:
1. Agent calls `cms.createPage`
2. Tool throws validation error (uppercase not allowed)
3. Agent observes error
4. Agent retries with corrected slug "contact-us-123"
5. Second attempt succeeds

**Look for**:
- Red error log entry
- Agent self-corrects
- Retry with valid slug
- Final success message

---

### Test Case 6: HITL Approval - Delete Page (CMS CRUD Mode)

**Mode**: CMS CRUD

**Prompt**:
```
Delete the about page
```

**Expected behavior**:
1. Agent calls `cms.deletePage` (high-risk tool)
2. **PAUSE**: Modal appears with approval request
3. Modal shows:
   - Tool: cms.deletePage
   - Description: "DESTRUCTIVE - Cannot be undone"
   - Input: `{ id: "...", confirm: true }`
4. Debug log shows yellow "🛡️ Approval Required" entry
5. **User Action Required**: Click "Approve" or "Reject"

**If you click Approve**:
- Agent continues execution
- Page deleted from database
- Success message shown

**If you click Reject**:
- Agent stops execution
- Page remains in database
- Rejection logged

**Verify deletion**:
```bash
curl http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages
# Should NOT show "about" page
```

**Verify rejection** (if you rejected):
```bash
curl http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages
# Should STILL show "about" page
```

---

### Test Case 7: Complex Multi-Step Task (CMS CRUD Mode)

**Mode**: CMS CRUD

**Prompt**:
```
Create a "Services" page with a hero section (title: "Our Services") and a feature section (heading: "What We Offer")
```

**Expected behavior**:
1. Agent plans 5-6 steps
2. Creates page
3. Adds hero section
4. Syncs hero content
5. Adds feature section
6. Syncs feature content
7. Validates all changes

**Look for**:
- ReAct pattern: Think → Act → Observe → Reflect
- Each tool call logged separately
- Proper error handling if failures
- Intelligence metrics at end (memory tokens, subgoals completed)

**Verify**:
```bash
# Check page exists
curl http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main/pages | grep services

# View rendered page
open http://localhost:4000/pages/services?locale=en
```

---

### Test Case 8: Error Recovery (CMS CRUD Mode)

**Mode**: CMS CRUD

**Prompt**:
```
Create a page with slug "home"
```

**Expected behavior**:
1. Agent calls `cms.createPage` with slug "home"
2. Database returns UNIQUE constraint error (home already exists)
3. Agent observes error
4. Agent suggests alternative: "home-2" or "home-new"
5. Agent retries with alternative slug
6. Second attempt succeeds

**Look for**:
- Circuit breaker tracks failures
- Agent self-corrects without user intervention
- Fallback strategy applied
- Final success with modified slug

---

### Test Case 9: Architect Mode - Planning Only (Architect Mode)

**Mode**: Architect (read-only)

**Prompt**:
```
Plan how to build a blog system with categories
```

**Expected behavior**:
1. Agent uses read-only tools only
2. Agent calls `cms.validatePlan` with proposed operations
3. Agent provides detailed plan without executing
4. Plan includes:
   - Create collection definition for blog
   - Define elements structure (title, body, cover, tags)
   - Create entries
   - Link to pages

**Look for**:
- No mutations attempted
- Planning steps clearly outlined
- Validation of feasibility
- Actionable steps for user

---

### Test Case 10: Debug Mode - Analyze Failure (Debug Mode)

**Mode**: Debug

**Setup**: First cause an error in CMS CRUD mode (e.g., try to add section to non-existent page)

**Prompt** (in Debug mode):
```
Why did the last operation fail?
```

**Expected behavior**:
1. Agent reviews recent log entries
2. Agent identifies error cause
3. Agent suggests corrective action
4. Agent may offer to fix automatically

**Look for**:
- Root cause analysis
- Specific suggestion (e.g., "Page ID doesn't exist")
- Option to correct the issue

---

## Testing HITL Approval System

### Setup: Create Test Scenario

**Step 1**: Start with CMS CRUD mode

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

**Symptom**: http://localhost:4000/pages/home shows "Page not found"

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
- [x] Preview loads (http://localhost:4000/pages/home)
- [x] Assistant UI loads (http://localhost:3000/assistant)

**You're ready to test!** Start with simple prompts and work your way up to complex multi-step tasks.

Happy testing! 🚀
