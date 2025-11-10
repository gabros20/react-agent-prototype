# Quick Reference Card

Quick commands and URLs for daily development.

---

## 🚀 Start/Stop

```bash
# Start everything
pnpm dev

# Start individually
pnpm dev:server   # API (8787)
pnpm dev:preview  # Preview (4000)
pnpm dev:web      # Next.js (3000)

# Stop all
Ctrl+C in terminal
```

---

## 🌐 URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **AI Assistant** | http://localhost:3000/assistant | Chat with AI agent |
| **Preview Homepage** | http://localhost:4000/pages/home?locale=en | See rendered site |
| **API Health** | http://localhost:8787/health | Check API status |
| **Database Studio** | `pnpm db:studio` | Browse database |

---

## 🛠️ Common Commands

```bash
# Database
pnpm db:push      # Update schema
pnpm seed         # Add sample data
pnpm reindex      # Rebuild vector search
pnpm db:studio    # Open DB browser

# Code Quality
pnpm typecheck    # Check types
pnpm lint         # Run linter
pnpm format       # Format code

# Preview
pnpm preview      # Open homepage in browser
```

---

## 📡 API Endpoints

Base URL: `http://localhost:8787/v1/teams/dev-team/sites/local-site/environments/main`

```bash
# List pages
curl $BASE/pages

# Get page
curl $BASE/pages/PAGE_ID

# Create page
curl -X POST $BASE/pages \
  -H "Content-Type: application/json" \
  -d '{"name":"About","slug":"about"}'

# Vector search
curl -X POST http://localhost:8787/v1/cms/search/resources \
  -H "Content-Type: application/json" \
  -d '{"query":"homepage","type":"page"}'
```

---

## 💬 AI Agent Test Prompts

### Easy (1-2 steps)
```
What pages exist?
Show me the homepage content
List all section definitions
```

### Medium (3-5 steps)
```
Create a "Services" page
Add a hero section to the contact page
Find pages about contact
```

### Hard (6+ steps)
```
Create an About page with hero and feature sections
Build a blog system with categories
Update all pages to use the new hero variant
```

### HITL Testing (requires approval)
```
Delete the about page
Change the homepage slug to "landing"
```

---

## 🎯 Agent Modes

| Mode | Use Case | Max Steps | Tools |
|------|----------|-----------|-------|
| **Architect** | Planning | 6 | Read-only + validatePlan |
| **CMS CRUD** | Execution | 10 | All tools |
| **Debug** | Fix errors | 4 | Read + limited writes |
| **Ask** | Questions | 6 | Read-only |

---

## 🔧 Troubleshooting

```bash
# Reset database
rm data/sqlite.db && pnpm db:push && pnpm seed

# Clear vector index
rm -rf data/lancedb && pnpm reindex

# Check logs
# API server logs: Terminal running dev:server
# Browser console: F12 → Console tab

# Port in use?
lsof -i :8787  # Find process
kill -9 PID    # Kill it

# TypeScript errors?
pnpm typecheck  # Check real errors
# VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"
```

---

## 📊 Debug Log Color Codes

| Color | Type | Meaning |
|-------|------|---------|
| 🔵 Blue | tool-call | Agent calling tool |
| 🟢 Green | tool-result | Tool returned success |
| 🟣 Purple | step-complete | Step finished |
| 🔴 Red | error | Something failed |
| 🟡 Yellow | system | HITL approval needed |
| ⚪ Gray | info | General information |

---

## 🔑 Environment Variables

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-...

# Optional (good defaults)
OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free
DATABASE_URL=file:data/sqlite.db
LANCEDB_DIR=data/lancedb
EXPRESS_PORT=8787
PREVIEW_PORT=4000
NEXT_PORT=3000
```

---

## 📁 Key Files

```
server/
├── agent/orchestrator.ts      # AI agent brain
├── tools/registry.ts           # Tool system
├── prompts/modes/*.xml         # Agent instructions
└── services/cms/*.ts           # Business logic

app/
├── assistant/_hooks/use-agent.ts  # Frontend integration
└── assistant/_components/*.tsx    # UI components

data/
├── sqlite.db                   # Database
└── lancedb/                    # Vector index
```

---

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| "Can't resolve 'tw-animate-css'" | Remove `@import "tw-animate-css";` from `app/globals.css` (already fixed) |
| "API key not found" | Check `.env` file has `OPENROUTER_API_KEY=...` |
| "Port in use" | Kill process: `lsof -i :8787` then `kill -9 PID` |
| "Database locked" | Stop all servers, delete `data/sqlite.db`, re-seed |
| "No results in search" | Run `pnpm reindex` |
| "Modal doesn't appear" | Check browser console (F12) for errors |
| Agent not responding | Check API server logs, verify API key valid |

---

## 📚 Documentation

- [GETTING_STARTED.md](GETTING_STARTED.md) - Beginner guide with test cases
- [README.md](README.md) - Architecture and features
- [TAILWIND_ANALYSIS.md](TAILWIND_ANALYSIS.md) - Tailwind CSS v4 setup analysis
- [TAILWIND_CONFIG_ANALYSIS.md](TAILWIND_CONFIG_ANALYSIS.md) - Do we need tailwind.config.ts?
- [TAILWIND_FIX_SUMMARY.md](TAILWIND_FIX_SUMMARY.md) - How we fixed the styling issues
- [PLAN.md](PLAN.md) - Technical specification
- [PROGRESS.md](PROGRESS.md) - Implementation status
- [PROMPT_ARCHITECTURE_BLUEPRINT.md](docs/PROMPT_ARCHITECTURE_BLUEPRINT.md) - Prompt system

---

## 🎓 Learning Path

1. **Day 1**: Follow [GETTING_STARTED.md](GETTING_STARTED.md)
2. **Day 2**: Try all test cases
3. **Day 3**: Read [PLAN.md](PLAN.md) architecture
4. **Day 4**: Explore code (start with orchestrator.ts)
5. **Day 5**: Create your first tool
6. **Day 6**: Add your own agent mode
7. **Day 7**: Build a custom feature

---

## 🚦 Health Check Checklist

Before reporting issues, verify:

- [ ] All 3 servers running (`pnpm dev`)
- [ ] API health check passes (http://localhost:8787/health)
- [ ] Preview loads (http://localhost:4000/pages/home)
- [ ] Assistant UI loads (http://localhost:3000/assistant)
- [ ] `.env` file exists with valid API key
- [ ] Database has data (`pnpm db:studio`)
- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] Browser console has no errors (F12)

---

**Pro Tip**: Keep this file open in a second monitor while developing!
