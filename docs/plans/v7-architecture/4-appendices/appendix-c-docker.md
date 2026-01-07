# Appendix C: Docker & Environment

> **Summary**: Docker Compose configuration, environment variables, and production Dockerfiles for the V7 architecture.
>
> **Prerequisites**: [../00-overview.md](../00-overview.md), [appendix-b-directory.md](appendix-b-directory.md)

## Docker Compose (Local Development)

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  # ═══════════════════════════════════════════════════════════
  # INFRASTRUCTURE (Always running)
  # ═══════════════════════════════════════════════════════════

  postgres:
    image: postgres:16-alpine
    container_name: cms-postgres
    environment:
      POSTGRES_USER: cms
      POSTGRES_PASSWORD: cms_dev_password
      POSTGRES_DB: cms_agent
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cms"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: cms-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ═══════════════════════════════════════════════════════════
  # APPLICATIONS (Optional - can run locally with pnpm dev)
  # ═══════════════════════════════════════════════════════════

  # Uncomment to run apps in Docker instead of locally

  # agent-server:
  #   build:
  #     context: ..
  #     dockerfile: docker/Dockerfile.agent-server
  #   container_name: cms-agent-server
  #   ports:
  #     - "8787:8787"
  #   environment:
  #     - DATABASE_URL=postgresql://cms:cms_dev_password@postgres:5432/cms_agent
  #     - REDIS_URL=redis://redis:6379
  #     - CMS_SERVER_URL=http://cms-server:3001
  #   depends_on:
  #     postgres:
  #       condition: service_healthy
  #     redis:
  #       condition: service_healthy

  # cms-server:
  #   build:
  #     context: ..
  #     dockerfile: docker/Dockerfile.cms-server
  #   container_name: cms-cms-server
  #   ports:
  #     - "3001:3001"
  #   environment:
  #     - DATABASE_URL=postgresql://cms:cms_dev_password@postgres:5432/cms_agent
  #   depends_on:
  #     postgres:
  #       condition: service_healthy

volumes:
  postgres_data:
  redis_data:
```

---

## Environment Variables

```bash
# .env.example

# ═══════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════
DATABASE_URL=postgresql://cms:cms_dev_password@localhost:5432/cms_agent

# ═══════════════════════════════════════════════════════════
# REDIS (Job Queue)
# ═══════════════════════════════════════════════════════════
REDIS_URL=redis://localhost:6379

# ═══════════════════════════════════════════════════════════
# SERVICE URLs (Inter-service communication)
# ═══════════════════════════════════════════════════════════
AGENT_SERVER_URL=http://localhost:8787
CMS_SERVER_URL=http://localhost:3001
WEBSITE_URL=http://localhost:3000

# ═══════════════════════════════════════════════════════════
# AI PROVIDERS
# ═══════════════════════════════════════════════════════════
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# ═══════════════════════════════════════════════════════════
# EXTERNAL SERVICES (Optional)
# ═══════════════════════════════════════════════════════════
# EXA_API_KEY=...
# CONTENTFUL_ACCESS_TOKEN=...
# SANITY_PROJECT_ID=...
```

---

## Root package.json Scripts

```json
{
  "name": "cms-agent",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "format": "biome format --write .",
    "clean": "turbo clean && rm -rf node_modules",

    "docker:up": "docker compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker compose -f docker/docker-compose.yml down",
    "docker:logs": "docker compose -f docker/docker-compose.yml logs -f",
    "docker:reset": "docker compose -f docker/docker-compose.yml down -v && docker compose -f docker/docker-compose.yml up -d",

    "db:generate": "turbo db:generate",
    "db:migrate": "turbo db:migrate",
    "db:studio": "pnpm --filter @cms-agent/cms-server db:studio",

    "dev:agent": "pnpm --filter @cms-agent/agent-server dev",
    "dev:cms": "pnpm --filter @cms-agent/cms-server dev",
    "dev:chat": "pnpm --filter @cms-agent/chat-ui dev",
    "dev:website": "pnpm --filter @cms-agent/website-renderer dev"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.14.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

---

## Turborepo Configuration

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

---

## pnpm Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## Production Dockerfiles

### Agent Server

```dockerfile
# docker/Dockerfile.agent-server
FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @cms-agent/agent-server build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/agent-server/dist ./dist
COPY --from=builder /app/apps/agent-server/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8787
CMD ["node", "dist/main.js"]
```

### CMS Server

```dockerfile
# docker/Dockerfile.cms-server
FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @cms-agent/cms-server build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/cms-server/dist ./dist
COPY --from=builder /app/apps/cms-server/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001
CMD ["node", "dist/main.js"]
```

---

## Development Workflow

```bash
# 1. Clone and install
git clone <repo>
cd cms-agent
pnpm install

# 2. Start infrastructure (PostgreSQL + Redis)
pnpm docker:up

# 3. Setup environment
cp .env.example .env
# Edit .env with your API keys

# 4. Run database migrations
pnpm db:migrate

# 5. Start all apps in development mode
pnpm dev

# Or start individual apps:
pnpm dev:agent    # Agent Server @ 8787
pnpm dev:cms      # CMS Server @ 3001
pnpm dev:chat     # Chat UI @ 3002
pnpm dev:website  # Website @ 3000
```

---

## Tooling Stack

| Tool | Purpose | Version |
|------|---------|---------|
| **pnpm** | Package manager with workspace support | 9.x |
| **Turborepo** | Monorepo build orchestration, caching | 2.x |
| **Docker Compose** | Local infrastructure (Redis, PostgreSQL) | 3.8+ |
| **TypeScript** | Shared type safety across all apps | 5.x |
| **Biome** | Linting and formatting (fast, unified) | 1.x |

---

## Related Documents

- → [appendix-b-directory.md](appendix-b-directory.md) - Directory structure
- → [../3-implementation/15-implementation-stages.md](../3-implementation/15-implementation-stages.md) - Setup in Stage 1
