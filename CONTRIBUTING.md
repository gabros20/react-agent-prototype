# Contributing

This document describes the patterns and conventions used in this codebase.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start services
pnpm start:all    # Start Redis, then run dev

# Development
pnpm dev          # Next.js + Express servers
pnpm worker       # Image processing worker (separate terminal)

# Database
pnpm db:generate  # Generate migrations
pnpm db:push      # Apply migrations

# Verification
pnpm typecheck    # TypeScript check
```

## Architecture Overview

This is a CMS agent built with:
- **AI SDK v6** - ToolLoopAgent with 41 tools
- **Express** - API server (port 8787)
- **Next.js** - Frontend (port 3000)
- **SQLite + Drizzle** - Database ORM
- **Redis + BullMQ** - Background job processing
- **Zustand** - Frontend state management

---

## Creating a New Tool

Tools are the primary way the AI agent interacts with the CMS.

### Tool Definition Pattern

```typescript
// server/tools/my-tools.ts
import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "./types";

export const myNewTool = tool({
  description: "Clear description of what this tool does",
  inputSchema: z.object({
    param1: z.string().describe("What this param is for"),
    param2: z.number().optional().describe("Optional param"),
  }),
  execute: async (input, { experimental_context }) => {
    // 1. Get context (ALWAYS use this pattern)
    const ctx = experimental_context as AgentContext;

    // 2. Use context services
    const result = await ctx.db.query.pages.findFirst({
      where: eq(pages.slug, input.param1),
    });

    // 3. Log if needed
    ctx.logger.info("Did something", { param1: input.param1 });

    // 4. Return consistent format
    return {
      success: true,
      data: result,
    };
  },
});
```

### Register Tool

Add to `server/tools/all-tools.ts`:

```typescript
import { myNewTool } from "./my-tools";

export const ALL_TOOLS = {
  // ...existing tools
  my_new_tool: myNewTool,
};
```

### Anti-Patterns (DON'T DO)

```typescript
// ❌ BAD: Module-level service instantiation
const service = new MyService();
export const badTool = tool({
  execute: async (input) => {
    return service.doSomething(); // No context!
  },
});

// ❌ BAD: ServiceContainer.get() singleton
export const badTool2 = tool({
  execute: async (input) => {
    const service = ServiceContainer.get().myService; // Anti-pattern!
  },
});

// ❌ BAD: Direct database import
import { db } from "../db/client";
export const badTool3 = tool({
  execute: async (input) => {
    return db.query.pages.findFirst(); // No context!
  },
});
```

---

## Creating a Service

Services contain business logic, separate from HTTP concerns.

### Service Pattern

```typescript
// server/services/my-service.ts
import type { DrizzleDB } from "../db/types";

export class MyService {
  constructor(
    private db: DrizzleDB,
    private vectorIndex?: VectorIndexService
  ) {}

  async doSomething(input: Input): Promise<Output> {
    // Business logic here
    const result = await this.db.query.items.findMany({
      where: eq(items.status, "active"),
    });

    // Optional: Vector indexing
    if (this.vectorIndex) {
      await this.vectorIndex.indexContent({...});
    }

    return result;
  }
}
```

### Register in Container

```typescript
// server/services/service-container.ts
class ServiceContainer {
  private _myService: MyService | null = null;

  get myService(): MyService {
    if (!this._myService) {
      this._myService = new MyService(this.db, this.vectorIndex);
    }
    return this._myService;
  }
}
```

---

## Frontend API Calls

All API calls go through `lib/api/*`. Never use inline `fetch()`.

### Using the API Client

```typescript
// In components/hooks
import { sessionsApi, agentApi, modelsApi } from "@/lib/api";

// Sessions
const sessions = await sessionsApi.list();
const session = await sessionsApi.get(sessionId);
await sessionsApi.create(title);
await sessionsApi.remove(sessionId);

// Agent
const stream = await agentApi.stream({ prompt, sessionId, modelId });
for await (const event of stream) {
  // Handle SSE events
}

// Models
const models = await modelsApi.list();
```

### Adding a New API Endpoint

```typescript
// lib/api/my-api.ts
import { apiClient } from "./client";

export const myApi = {
  async list(): Promise<MyItem[]> {
    return apiClient.get<MyItem[]>("/v1/my-items");
  },

  async create(data: CreateInput): Promise<MyItem> {
    return apiClient.post<MyItem>("/v1/my-items", { body: data });
  },
};

// lib/api/index.ts
export { myApi } from "./my-api";
```

---

## Debug Logging

Use the debug logger abstraction, not direct store manipulation.

### Quick Logging

```typescript
import { debugLogger } from "@/lib/debug-logger";

// Simple logging (goes to active trace)
debugLogger.info("Something happened", { data });
debugLogger.warn("Warning message");
debugLogger.error("Error occurred", new Error("details"));
```

### Trace Logging (Agent Flows)

```typescript
import { debugLogger } from "@/lib/debug-logger";

// Create scoped trace logger
const trace = debugLogger.trace(traceId);

// Start trace
trace.start({ sessionId, userPrompt: "User's question" });

// Log tool calls
trace.toolCall("cms_getPage", { slug: "home" }, "call-123");
trace.toolResult("call-123", { id: "page-1", name: "Home" });

// Log steps
trace.stepStart(1);
trace.textDelta("Streaming text...");
trace.stepComplete(1, { duration: 150 });

// Complete trace
trace.complete({ metrics });
```

### React Hook

```typescript
import { useDebugLogger, useQuickLog } from "@/lib/debug-logger";

function MyComponent() {
  // Full logger access
  const logger = useDebugLogger();
  logger.info("Component event");

  // Or with prefix
  const { log, warn, error } = useQuickLog("MyComponent");
  log("Something happened", { data });
}
```

---

## Express Routes

Routes are thin controllers - minimal logic, delegate to services.

### Route Pattern

```typescript
// server/routes/my-route.ts
import { Router } from "express";
import { z } from "zod";
import type { ServiceContainer } from "../services/service-container";

const inputSchema = z.object({
  name: z.string(),
});

export function createMyRouter(services: ServiceContainer) {
  const router = Router();

  // GET - fetch data
  router.get("/items", async (req, res) => {
    try {
      const items = await services.myService.getAll();
      res.json({ data: items, statusCode: 200 });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch items" });
    }
  });

  // POST - create/action
  router.post("/items", async (req, res) => {
    try {
      const input = inputSchema.parse(req.body);
      const item = await services.myService.create(input);
      res.json({ data: item, statusCode: 201 });
    } catch (error) {
      res.status(400).json({ error: "Invalid input" });
    }
  });

  return router;
}
```

---

## Zustand Stores

Use selectors to avoid unnecessary re-renders.

### Store Pattern

```typescript
// app/assistant/_stores/my-store.ts
import { create } from "zustand";

interface MyState {
  items: Item[];
  isLoading: boolean;

  // Actions
  setItems: (items: Item[]) => void;
  loadItems: () => Promise<void>;
}

export const useMyStore = create<MyState>((set, get) => ({
  items: [],
  isLoading: false,

  setItems: (items) => set({ items }),

  loadItems: async () => {
    set({ isLoading: true });
    try {
      const items = await myApi.list();
      set({ items, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
}));
```

### Using Selectors

```typescript
// ✅ GOOD: Select specific values
const items = useMyStore((state) => state.items);
const isLoading = useMyStore((state) => state.isLoading);

// ❌ BAD: Subscribe to entire store
const store = useMyStore();
```

---

## Type Safety

### AgentContext

```typescript
// server/tools/types.ts
export interface AgentContext {
  db: DrizzleDB;
  services: ServiceContainer;
  session: SessionService;
  logger: AgentLogger;
  writer: StreamWriter;
}
```

### ToolResult

```typescript
// Standardized tool response format
interface ToolResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  requiresConfirmation?: boolean;
}
```

### Avoid `any`

```typescript
// ✅ Use unknown + type guards
function processResult(result: unknown) {
  if (isObject(result) && hasId(result)) {
    return result.id;
  }
}

// ✅ Use proper generics
function mapItems<T>(items: T[], fn: (item: T) => string): string[] {
  return items.map(fn);
}
```

---

## Common Commands

```bash
# Development
pnpm dev              # Start dev servers
pnpm worker           # Start background worker
pnpm typecheck        # Run TypeScript

# Database
pnpm db:generate      # Generate migrations
pnpm db:push          # Apply migrations
pnpm reset:data       # Reset database

# Services
pnpm start:all        # Start Redis + show dev instructions
pnpm stop:all         # Stop all services
pnpm ps               # Show running processes
```

## File Naming

- Components: `PascalCase.tsx`
- Hooks: `use-kebab-case.ts`
- Stores: `kebab-case-store.ts`
- Services: `kebab-case.service.ts` or `kebab-case-service.ts`
- Tools: `kebab-case-tools.ts`
- Types: `types.ts` in relevant directory
