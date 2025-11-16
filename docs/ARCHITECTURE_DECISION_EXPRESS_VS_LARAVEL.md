# Architecture Decision: Express vs Laravel Backend

**Decision Date**: 2024-11-16  
**Status**: Pending Team Decision  
**Impact**: High (affects entire backend stack and timeline)

---

## TL;DR - Quick Recommendation

**If your team is 100% TypeScript/Node.js:** → Choose **Express Separation** (2-3 weeks)  
**If your backend team prefers PHP:** → Choose **Laravel Migration** (7 weeks)

---

## Side-by-Side Comparison

| Criteria | Express Separation | Laravel Migration |
|----------|-------------------|-------------------|
| **Timeline** | **2-3 weeks** ⚡ | 7 weeks |
| **Backend Changes** | **Minimal** (add 3 endpoints) | **Complete rebuild** in PHP |
| **Database Migration** | **None** (keep SQLite) | SQLite → MySQL + data migration |
| **Vector Search** | **Keep LanceDB** (working) | Rebuild with Meilisearch/Typesense |
| **Preview Server** | **Keep Nunjucks** (port 4000) | Migrate to Laravel Blade |
| **Risk Level** | **Low** (same stack) | Medium-High (new stack) |
| **Team Learning Curve** | **Zero** (existing knowledge) | PHP ecosystem for backend team |
| **Code Reuse** | **90%** backend code kept | 0% backend code kept |
| **API Routes** | **Already exist** (410 lines) | Build from scratch |
| **Services Layer** | **Keep as-is** | Rebuild in PHP |
| **Production Database** | SQLite or MySQL | MySQL/PostgreSQL required |

---

## Detailed Analysis

### 1. Development Timeline

#### **Express Separation: 2-3 Weeks**
- **Week 1**: API client + tool migration (5 days)
- **Week 2**: Agent migration + UI (5 days)
- **Week 3**: Testing + polish (3 days)

**Why faster:**
- ✅ Express API already exists (410 lines in `server/routes/cms.ts`)
- ✅ Just need to add 3 granular endpoints
- ✅ All services stay unchanged
- ✅ No database migration
- ✅ No vector search migration

#### **Laravel Migration: 7 Weeks**
- **Week 1-2**: Laravel API foundation (10 days)
- **Week 2-3**: Tool library (8 days)
- **Week 3-4**: Agent migration (8 days)
- **Week 4-5**: State management (8 days)
- **Week 5-6**: Testing (8 days)
- **Week 6-7**: Preview + deploy (6 days)

**Why slower:**
- ⚠️ Build entire Laravel API from scratch
- ⚠️ Migrate database schema to MySQL
- ⚠️ Migrate all data from SQLite
- ⚠️ Setup Meilisearch/Typesense
- ⚠️ Migrate Nunjucks templates to Blade
- ⚠️ Learn Laravel ecosystem

---

### 2. Technical Risk

#### **Express Separation: LOW Risk** 🟢
- Same stack (TypeScript/Node.js)
- 90% of code unchanged
- Proven infrastructure (already working)
- Easy rollback (just revert tool changes)

#### **Laravel Migration: MEDIUM-HIGH Risk** 🟡
- New stack (PHP)
- Complete backend rebuild
- Data migration risk (SQLite → MySQL)
- Vector search provider change
- New deployment infrastructure

---

### 3. Team Considerations

#### **Express Separation**

**Best if:**
- ✅ Entire team knows TypeScript
- ✅ Team comfortable with Node.js/Express
- ✅ Backend devs can handle Express services
- ✅ Want to minimize learning curve
- ✅ Prefer faster time to market

**Team ownership:**
- **Frontend devs**: Agent (TypeScript), Tools (TypeScript), UI (React)
- **Backend devs**: Express API (TypeScript), Services (TypeScript), DB (Drizzle)

#### **Laravel Migration**

**Best if:**
- ✅ Backend team already knows PHP
- ✅ Backend team prefers Laravel over Express
- ✅ Want Laravel ecosystem (Eloquent, Scout, Queues, Broadcasting)
- ✅ Production database will be MySQL/PostgreSQL anyway
- ✅ Can afford longer timeline
- ✅ Clear team split: JS frontend / PHP backend

**Team ownership:**
- **Frontend devs**: Agent (TypeScript), Tools (TypeScript), UI (React)
- **Backend devs**: Laravel API (PHP), Services (PHP), DB (Eloquent)

---

### 4. Code Changes Required

#### **Express Separation**

**Files to MOVE:**
```bash
server/agent/orchestrator.ts     → app/api/chat/route.ts
server/tools/all-tools.ts        → tools/* (20 HTTP clients)
server/prompts/react.xml         → lib/prompts/react.ts
server/services/working-memory/  → lib/working-memory/
```

**Files to DELETE:**
```bash
app/api/agent/route.ts           # Proxy no longer needed
server/routes/agent.ts           # Moved to frontend
server/services/approval-queue.ts # Use AI SDK 6 native
```

**Files to KEEP (no changes):**
```bash
server/services/cms/*            # ✅ All services
server/routes/cms.ts             # ✅ API routes (add 3 endpoints)
server/routes/sessions.ts        # ✅ Session routes
server/db/                       # ✅ Database layer
server/preview.ts                # ✅ Preview server
data/sqlite.db                   # ✅ Database
data/lancedb/                    # ✅ Vector store
```

**Backend changes:** Add 3 endpoints (~30 lines)

---

#### **Laravel Migration**

**Files to CREATE (from scratch):**
```bash
database/migrations/             # All 18 tables
app/Models/                      # 18 Eloquent models
app/Http/Controllers/API/        # 6+ controllers
app/Http/Resources/              # 6+ resources
app/Services/                    # PageService, etc. in PHP
config/scout.php                 # Meilisearch config
resources/views/preview/         # Blade templates
```

**Files to MIGRATE:**
```bash
server/db/schema.ts              → database/migrations/*.php
server/services/cms/*.ts         → app/Services/*.php
server/routes/cms.ts             → routes/api.php
server/preview.ts templates      → resources/views/
data/sqlite.db                   → MySQL (via seeder)
```

**Backend changes:** Complete rebuild (~2000+ lines)

---

### 5. Feature Parity

Both achieve **100% feature parity** for frontend:
- ✅ Full AI SDK 6 integration
- ✅ useChat hook
- ✅ AI Elements components
- ✅ Client-side working memory
- ✅ Frontend approvals
- ✅ All 20 tools as HTTP clients

**Difference is backend only:**
- Express: Keep TypeScript/Node.js
- Laravel: Rebuild in PHP

---

### 6. Long-term Considerations

#### **Express Separation**

**Pros:**
- ✅ Unified language (TypeScript everywhere)
- ✅ Easier code sharing between frontend/backend
- ✅ Faster iterations (one language to master)
- ✅ Simpler deployment (Node.js)

**Cons:**
- ⚠️ Drizzle ORM less mature than Eloquent
- ⚠️ Express less opinionated than Laravel
- ⚠️ Manual setup for queues, events, etc.

#### **Laravel Migration**

**Pros:**
- ✅ Laravel ecosystem (queues, broadcasting, events, notifications)
- ✅ Eloquent ORM (more powerful than Drizzle)
- ✅ Laravel Scout (built-in search)
- ✅ Stronger conventions (less decision fatigue)
- ✅ Better for traditional CMS patterns

**Cons:**
- ⚠️ Two languages to maintain (TS + PHP)
- ⚠️ Harder to share code between stacks
- ⚠️ More complex deployment (Node + PHP)

---

### 7. Production Deployment

#### **Express Separation**

**Stack:**
- Frontend: Vercel (Next.js)
- Backend: Node.js hosting (Railway, Render, Fly.io, DigitalOcean)
- Database: SQLite (dev), PostgreSQL (production)
- Vector: LanceDB

**Deployment:**
```bash
# Frontend
vercel deploy

# Backend
git push railway main
```

#### **Laravel Migration**

**Stack:**
- Frontend: Vercel (Next.js)
- Backend: PHP hosting (Laravel Forge, Vapor, DigitalOcean, AWS)
- Database: MySQL/PostgreSQL
- Vector: Meilisearch cloud or self-hosted

**Deployment:**
```bash
# Frontend
vercel deploy

# Backend
php artisan deploy
```

---

### 8. Cost Comparison

#### **Express Separation**

**Hosting:**
- Frontend: Vercel (free tier or $20/mo)
- Backend: Railway ($5-20/mo for Node.js)
- Database: Railway PostgreSQL (included) or Supabase (free tier)
- Vector: Self-hosted LanceDB (free)

**Total:** ~$25-40/mo

#### **Laravel Migration**

**Hosting:**
- Frontend: Vercel (free tier or $20/mo)
- Backend: Laravel Forge ($12/mo) + DigitalOcean ($20/mo) OR Laravel Vapor (serverless, $20/mo)
- Database: DigitalOcean MySQL ($15/mo) or AWS RDS ($30/mo)
- Vector: Meilisearch Cloud ($29/mo) or self-hosted

**Total:** ~$50-100/mo

---

## Migration Complexity Matrix

| Task | Express | Laravel |
|------|---------|---------|
| Create API client | Easy ✅ | Easy ✅ |
| Migrate 20 tools | Medium 🟡 | Medium 🟡 |
| Move agent to frontend | Easy ✅ | Easy ✅ |
| Database migration | **None ✅** | **Complex 🔴** |
| Vector search migration | **None ✅** | **Medium 🟡** |
| Preview migration | **None ✅** | **Medium 🟡** |
| Add API endpoints | **3 endpoints ✅** | **20+ endpoints 🔴** |
| Test backend | **Existing tests ✅** | **Write new tests 🟡** |

---

## Decision Framework

### Choose **Express Separation** if:

1. ✅ Team is 100% comfortable with TypeScript/Node.js
2. ✅ Want fastest time to market (2-3 weeks)
3. ✅ Want to minimize risk
4. ✅ SQLite/Drizzle is working well
5. ✅ LanceDB vector search is sufficient
6. ✅ Prefer unified language (TS everywhere)
7. ✅ Backend team can maintain Express services

### Choose **Laravel Migration** if:

1. ✅ Backend team already knows PHP/Laravel
2. ✅ Backend team prefers PHP over Node.js
3. ✅ Want Laravel ecosystem features (Eloquent, Scout, Queues)
4. ✅ Production database will be MySQL/PostgreSQL
5. ✅ Clear team split: JS frontend / PHP backend
6. ✅ Can afford 7-week timeline
7. ✅ Want more opinionated backend framework

---

## Recommendation

### For Your Current Situation:

Based on your existing codebase analysis:
- ✅ You already have 410 lines of working Express routes
- ✅ All services are in TypeScript
- ✅ SQLite + Drizzle is working
- ✅ LanceDB vector search is working
- ✅ Preview server is working

**Recommendation:** **Start with Express Separation** because:

1. **90% of backend already built** - just add 3 endpoints
2. **2-3 weeks** vs 7 weeks (4-5 weeks saved)
3. **Low risk** - same stack, proven code
4. **Get AI SDK 6 benefits immediately**
5. **Can always migrate to Laravel later** if needed

**Migration path:** Express Separation (2-3 weeks) → Evaluate → Laravel Migration later if team prefers PHP

---

## Next Steps

### If Choosing Express Separation:
1. Review `FRONTEND_AGENT_EXPRESS_SEPARATION_PLAN.md`
2. Start Week 1: API client + tool migration
3. Timeline: 2-3 weeks to production

### If Choosing Laravel Migration:
1. Review `FRONTEND_AGENT_LARAVEL_MIGRATION_PLAN.md`
2. Collaborate on OpenAPI spec
3. Start Week 1: Laravel API foundation
4. Timeline: 7 weeks to production

### If Unsure:
1. **Prototype both** (1 week each)
2. Build Express separation first (2 weeks)
3. Evaluate with team
4. Decide on Laravel migration based on team preference

---

## Summary Table

| Aspect | Express | Laravel | Winner |
|--------|---------|---------|--------|
| **Timeline** | 2-3 weeks | 7 weeks | 🏆 Express |
| **Risk** | Low | Medium-High | 🏆 Express |
| **Backend Work** | Minimal | Complete rebuild | 🏆 Express |
| **Team Learning** | Zero | PHP ecosystem | 🏆 Express |
| **Code Reuse** | 90% | 0% | 🏆 Express |
| **Ecosystem** | Node.js | Laravel | 🏆 Laravel |
| **ORM** | Drizzle | Eloquent | 🏆 Laravel |
| **Conventions** | DIY | Opinionated | 🏆 Laravel |
| **Unified Language** | Yes (TS) | No (TS+PHP) | 🏆 Express |
| **Long-term PHP Team** | N/A | Great fit | 🏆 Laravel |

**Overall Winner for Fast Migration:** 🏆 **Express Separation**  
**Overall Winner for PHP Teams:** 🏆 **Laravel Migration**

---

## Final Thought

**You can't go wrong with either choice.** Both achieve the goal of:
- ✅ Frontend agent with AI SDK 6
- ✅ Full AI Elements integration
- ✅ Clean frontend/backend separation
- ✅ Production-ready architecture

The difference is **timeline and team preference**, not capability.

Choose based on:
1. **Team expertise** (TypeScript vs PHP)
2. **Timeline urgency** (2-3 weeks vs 7 weeks)
3. **Long-term vision** (unified TS vs specialized stacks)

Good luck! 🚀
