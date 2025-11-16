# Migration Plans Index

**Last Updated**: 2024-11-16  
**Status**: Ready for Team Review

---

## 📚 Available Migration Plans

You now have **3 comprehensive migration plans** to choose from, each with detailed implementation guides.

---

## 1. Frontend Agent + Laravel Backend

📄 **File**: `FRONTEND_AGENT_LARAVEL_MIGRATION_PLAN.md` (74 KB, 2,536 lines)

**Summary**: Move AI agent to Next.js frontend, migrate backend from Express/Node.js to Laravel 11/PHP.

**Timeline**: 7 weeks

**Key Features**:
- ✅ Complete backend rebuild in Laravel/PHP
- ✅ Database migration (SQLite → MySQL/PostgreSQL)
- ✅ Vector search (LanceDB → Meilisearch/Typesense)
- ✅ Preview rendering (Nunjucks → Laravel Blade)
- ✅ Full AI SDK 6 integration on frontend
- ✅ All 20 tools as HTTP clients calling Laravel API

**Best For**:
- Teams with PHP expertise
- Backend team prefers Laravel over Express
- Want Laravel ecosystem (Eloquent, Scout, Queues, Broadcasting)
- Clear team split: JS frontend / PHP backend
- Production database will be MySQL/PostgreSQL

**What's Included**:
- Executive summary with architecture diagrams
- Current implementation inventory (all 20 tools, 18 tables)
- Migration benefits & trade-offs analysis
- **6 critical decision points** with A/B options:
  1. Vector Search Location → **Laravel-Managed**
  2. Working Memory Storage → **Client-Side**
  3. Session Storage → **Hybrid (localStorage + Laravel cached)**
  4. System Prompt Location → **Frontend Template**
  5. Approval Flow → **Frontend-Only**
  6. Preview Rendering → **Laravel Blade**
- 4-phase detailed migration plan with complete code examples
- File/folder structure reorganization
- State management strategy (Zustand + Laravel with optimistic updates)
- Streaming architecture (AI SDK 6 native)
- Testing & validation strategies
- Risk mitigation (5 risks with solutions)
- Timeline & milestones (7-week plan)
- Appendix (env vars, commands, Docker Compose)

---

## 2. Frontend Agent + Express Backend (RECOMMENDED for Speed)

📄 **File**: `FRONTEND_AGENT_EXPRESS_SEPARATION_PLAN.md` (37 KB, 1,184 lines)

**Summary**: Move AI agent to Next.js frontend, keep existing Express/Node.js backend with minimal changes.

**Timeline**: 2-3 weeks ⚡

**Key Features**:
- ✅ Keep 90% of existing Express backend
- ✅ No database migration (keep SQLite/Drizzle)
- ✅ No vector search migration (keep LanceDB)
- ✅ Keep preview server (Nunjucks on port 4000)
- ✅ Add only 3 new Express endpoints
- ✅ Full AI SDK 6 integration on frontend
- ✅ All 20 tools as HTTP clients calling Express API

**Best For**:
- Teams 100% comfortable with TypeScript/Node.js
- Want fastest time to market (2-3 weeks vs 7 weeks)
- Want to minimize migration risk
- SQLite/Drizzle working well
- Prefer unified language (TypeScript everywhere)
- Backend team can maintain Express services

**What's Included**:
- Current vs target architecture (90% already built!)
- Comparison: Express vs Laravel migration
- **Same 6 critical decisions** adapted for Express:
  1. Vector Search → **Keep LanceDB in Express**
  2. Working Memory → **Client-Side**
  3. Sessions → **Hybrid (localStorage + Express/SQLite)**
  4. System Prompt → **Frontend Template**
  5. Approvals → **Frontend-Only**
  6. Preview → **Keep Express Nunjucks Server**
- 3-phase migration plan with code examples
- File/folder reorganization (what to move, keep, delete)
- Express endpoint mapping (existing routes + 3 new ones)
- Tool migration examples (direct DB → HTTP clients)
- Testing strategy
- Timeline (2-3 weeks)

---

## 3. Architecture Decision Guide

📄 **File**: `ARCHITECTURE_DECISION_EXPRESS_VS_LARAVEL.md` (12 KB)

**Summary**: Comprehensive comparison to help you choose between Express and Laravel backends.

**What's Included**:
- Side-by-side comparison table
- Detailed analysis (8 criteria)
- Development timeline comparison
- Technical risk assessment
- Team considerations
- Code changes required
- Long-term considerations
- Production deployment comparison
- Cost comparison
- Migration complexity matrix
- Decision framework
- Recommendation

**Quick Comparison**:

| Criteria | Express | Laravel |
|----------|---------|---------|
| **Timeline** | **2-3 weeks** ⚡ | 7 weeks |
| **Risk** | **Low** | Medium-High |
| **Backend Work** | **Minimal** (add 3 endpoints) | Complete rebuild |
| **Team Learning** | **Zero** | PHP ecosystem |
| **Code Reuse** | **90%** | 0% |

**Recommendation**: Start with **Express Separation** for:
- 90% of backend already built
- 2-3 weeks vs 7 weeks (4-5 weeks saved)
- Low risk (same stack, proven code)
- Can migrate to Laravel later if team prefers PHP

---

## How to Use These Plans

### Step 1: Read the Decision Guide First

📖 Start here: `ARCHITECTURE_DECISION_EXPRESS_VS_LARAVEL.md`

This will help you understand:
- What's the difference between the two approaches
- Which one fits your team better
- Timeline and risk comparison

### Step 2: Review Your Chosen Plan

**If choosing Express (faster, lower risk):**
📖 Read: `FRONTEND_AGENT_EXPRESS_SEPARATION_PLAN.md`

**If choosing Laravel (PHP team, Laravel ecosystem):**
📖 Read: `FRONTEND_AGENT_LARAVEL_MIGRATION_PLAN.md`

### Step 3: Review with Your Team

**Frontend Team**:
- Focus on: Tool migration section (HTTP clients)
- Focus on: Agent setup (app/api/chat/route.ts)
- Focus on: Working memory (client-side)
- Focus on: UI with useChat hook

**Backend Team**:

For Express:
- Focus on: Adding 3 new endpoints
- Focus on: Keeping existing services
- Timeline: 1 week of work

For Laravel:
- Focus on: Database migration
- Focus on: Eloquent models and controllers
- Focus on: API design
- Timeline: 4-5 weeks of work

### Step 4: Create Timeline

**Express Timeline (2-3 weeks)**:
- Week 1: API client + tool migration
- Week 2: Agent migration + UI
- Week 3: Testing + polish

**Laravel Timeline (7 weeks)**:
- Week 1-2: Laravel API foundation
- Week 2-3: Tool library
- Week 3-4: Agent migration
- Week 4-5: State management
- Week 5-6: Testing
- Week 6-7: Preview + deploy

---

## Common Elements (Both Plans)

Both plans achieve **identical frontend results**:

✅ **Agent on Frontend**:
- ToolLoopAgent in Next.js (app/api/chat/route.ts)
- Full AI SDK 6 integration
- useChat hook with DefaultChatTransport
- AI Elements components (Conversation, Message, Context, etc.)

✅ **Tools as HTTP Clients**:
- All 20 tools converted to HTTP clients
- Call backend API (Express or Laravel)
- Same tool interfaces maintained

✅ **State Management**:
- Client-side: Zustand stores with localStorage
- Server-side: Database (SQLite or MySQL)
- Hybrid sync: Optimistic updates + background sync

✅ **Working Memory**:
- Client-side implementation (sessionStorage)
- Entity tracking and reference resolution
- Injected into system prompt

✅ **Streaming**:
- AI SDK 6 native streaming (createAgentUIStreamResponse)
- No manual SSE parsing
- Built-in tool call/result streaming

✅ **Approvals (HITL)**:
- Frontend-only using AI SDK 6 native approvals
- needsApproval flag on tools
- React approval dialog component

**Difference is ONLY the backend**:
- Express: Keep existing TypeScript/Node.js backend
- Laravel: Rebuild backend in PHP

---

## Additional Resources

### Related Documentation

- `PLAN.md` - Original project plan (146 KB)
- `NATIVE_AI_SDK_REFACTOR_PLAN.md` - AI SDK 6 refactor plan (26 KB)
- `WORKING_MEMORY_PLAN.md` - Working memory design (13 KB)

### Current Codebase Reference

**Backend (Express)**:
- `server/routes/cms.ts` - 410 lines of existing API endpoints
- `server/routes/sessions.ts` - Session management
- `server/agent/orchestrator.ts` - Current agent (to be moved)
- `server/tools/all-tools.ts` - 20 tools (to be migrated)
- `server/services/` - All services (keep for Express, rebuild for Laravel)

**Frontend (Next.js)**:
- `app/assistant/` - Current UI
- `app/api/agent/route.ts` - Proxy (to be deleted)
- `app/assistant/_hooks/use-agent.ts` - Custom hook (to be replaced with useChat)

---

## Quick Start Commands

### Express Separation

```bash
# Week 1: Setup
mkdir -p lib/express-api tools/cms lib/working-memory lib/prompts

# Create API client
touch lib/express-api/client.ts
touch lib/express-api/cms-context.ts

# Migrate tools (example)
touch tools/cms/get-page.ts
touch tools/cms/create-page.ts
# ... create all 20 tools

# Week 2: Agent
touch app/api/chat/route.ts
mv server/services/working-memory/* lib/working-memory/
mv server/prompts/react.xml lib/prompts/react.ts
```

### Laravel Migration

```bash
# Week 1: Laravel setup
composer create-project laravel/laravel laravel-cms-backend
cd laravel-cms-backend
composer require laravel/sanctum laravel/scout

# Create migrations
php artisan make:migration create_cms_tables

# Week 2-3: Models and controllers
php artisan make:model Page -mcr
php artisan make:model PageSection -mcr
# ... create all 18 models
```

---

## Decision Matrix

Use this to quickly decide:

| Your Situation | Recommended Plan |
|----------------|------------------|
| Team is 100% TypeScript | ✅ Express |
| Backend team knows PHP | ✅ Laravel |
| Need it done in 2-3 weeks | ✅ Express |
| Can afford 7 weeks | ✅ Laravel |
| SQLite working well | ✅ Express |
| Need MySQL/PostgreSQL | ✅ Laravel |
| Want Laravel ecosystem | ✅ Laravel |
| Want unified language | ✅ Express |
| Minimize risk | ✅ Express |
| Backend prefers opinionated framework | ✅ Laravel |

---

## Support & Questions

**For Express Plan Questions**:
- Review: `FRONTEND_AGENT_EXPRESS_SEPARATION_PLAN.md`
- Focus on: Sections 5 (Migration Plan) and 6 (File Structure)

**For Laravel Plan Questions**:
- Review: `FRONTEND_AGENT_LARAVEL_MIGRATION_PLAN.md`
- Focus on: Sections 5 (Migration Plan) and 4 (Decision Points)

**For Choosing Between Them**:
- Review: `ARCHITECTURE_DECISION_EXPRESS_VS_LARAVEL.md`
- Focus on: Decision Framework section

---

## Success Metrics (Both Plans)

After migration, you should achieve:

### Functional
- [ ] All 20 tools working via backend API
- [ ] Agent runs on frontend with AI SDK 6
- [ ] useChat hook integrated
- [ ] Working memory on client-side
- [ ] Session persistence working
- [ ] Vector search working
- [ ] Preview server working
- [ ] Approval flow working

### Performance
- [ ] API response < 200ms (p95)
- [ ] Agent response < 5s for simple tasks
- [ ] Zero data loss

### Developer Experience
- [ ] useChat hook integrated
- [ ] AI Elements components working
- [ ] Type-safe tool definitions
- [ ] Hot reload working
- [ ] Clear error messages

### Production Ready
- [ ] 90%+ test coverage
- [ ] Deployed to production
- [ ] Monitoring active
- [ ] Documentation complete

---

## Final Recommendation

**Start with Express Separation** because:
1. You already have 90% of the backend built
2. 2-3 weeks vs 7 weeks (get AI SDK 6 benefits faster)
3. Low risk (same stack)
4. Can always migrate to Laravel later if team prefers PHP

**Then evaluate:**
- After Express separation is done, run it for 2-4 weeks
- See if team is happy with Express
- If backend team strongly prefers Laravel, migrate then
- You'll have gained 4-5 weeks of using AI SDK 6 features

**Progressive migration path:**
```
Current (Backend Agent)
    ↓ (2-3 weeks)
Express Separation (Frontend Agent)
    ↓ (evaluate)
Laravel Migration (if desired)
    ↓ (7 weeks from Express, not from scratch)
```

Good luck! 🚀

---

## Document Changelog

- **2024-11-16**: Created all three migration plans
  - Laravel plan: 2,536 lines, 74 KB
  - Express plan: 1,184 lines, 37 KB
  - Decision guide: 12 KB
  - This index: Created
