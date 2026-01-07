# Appendix A: TypeScript Schemas

> **Summary**: Complete TypeScript interface definitions for all major types in the V7 architecture.
>
> **Prerequisites**: [../00-overview.md](../00-overview.md)

## AgentConfig (Complete)

```typescript
interface AgentConfig {
  // ─────────────────────────────────────────────────────────────
  // IDENTITY
  // ─────────────────────────────────────────────────────────────
  id: string;
  name: string;
  description: string;

  // V7: Explicit agent types replace implicit mode
  type: 'router' | 'orchestrator' | 'specialist';

  // ─────────────────────────────────────────────────────────────
  // MODEL CONFIGURATION
  // Maps to AI SDK model settings
  // ─────────────────────────────────────────────────────────────
  model: {
    default: string;              // e.g., 'gpt-4o', 'claude-sonnet-4-20250514'
    reasoning?: string;           // For complex planning (e.g., 'o1-mini')
    temperature?: number;         // 0-1, controls randomness (default: 0.7)
    topP?: number;                // 0-1, nucleus sampling
    maxOutputTokens?: number;     // Max tokens per response (default: 4096)
  };

  // ─────────────────────────────────────────────────────────────
  // SYSTEM PROMPT
  // ─────────────────────────────────────────────────────────────
  prompt: string | { file: string };

  // ─────────────────────────────────────────────────────────────
  // TOOL CONFIGURATION
  // Maps to AI SDK tools, activeTools, toolChoice
  // ─────────────────────────────────────────────────────────────
  tools: {
    include: string[];            // ['cms_*', 'web_search'] - patterns allowed
    exclude?: string[];           // ['cms_delete_*']
    searchEnabled?: boolean;      // Use hybrid search for tool discovery
    maxTools?: number;            // Max tools in context (default: 20)

    // AI SDK 6: toolChoice parameter
    toolChoice?: 'auto' | 'required' | 'none' | { tool: string };
  };

  // ─────────────────────────────────────────────────────────────
  // LOOP CONTROL (AI SDK 6 stopWhen + prepareStep)
  // ─────────────────────────────────────────────────────────────
  loop: {
    maxSteps: number;

    stopConditions?: {
      onToolCall?: string;        // Stop when this tool is called
      onTextContains?: string;    // Stop when response contains string
      custom?: string;            // Reference to custom StopCondition function
    }[];

    stepBehavior?: {
      restrictToolsAfterStep?: {
        step: number;
        tools: string[];
      };
      switchModelAfterStep?: {
        step: number;
        model: string;
      };
      changeToolChoiceAfterStep?: {
        step: number;
        toolChoice: 'auto' | 'required' | 'none' | { tool: string };
      };
    };
  };

  // ─────────────────────────────────────────────────────────────
  // TYPE-SPECIFIC CONFIGURATION (V7)
  // Only one of these should be set based on agent type
  // ─────────────────────────────────────────────────────────────

  // For type: 'router'
  routing?: {
    intents: string[];
    complexityRules: {
      escalateToOrchestrator: string[];
    };
    simpleRoutes: Record<string, string>;
    complexRoute: string;
  };

  // For type: 'orchestrator'
  orchestration?: {
    decomposition: {
      enabled: boolean;
      maxSubtasks: number;
    };
    availableSpecialists: string[];
    spawning: {
      maxConcurrent: number;
    };
    contextModes: {
      independent: 'fresh' | 'inherited';
      dependent: 'selective' | 'inherited';
    };
    todoTracking: boolean;
    synthesis: {
      enabled: boolean;
    };
  };

  // For type: 'specialist'
  specialist?: {
    domain: string;
    tools: string[];
    maxSteps: number;
    canSpawn: false;  // Always false for specialists
  };

  // ─────────────────────────────────────────────────────────────
  // SPAWNING (DEPRECATED - use orchestration config)
  // ─────────────────────────────────────────────────────────────
  spawning?: {
    enabled: boolean;
    mode: 'parallel' | 'sequential';
    maxConcurrent?: number;
  };

  // ─────────────────────────────────────────────────────────────
  // STREAMING
  // ─────────────────────────────────────────────────────────────
  streaming?: {
    smoothStream?: boolean;
    delayMs?: number;
    chunking?: 'word' | 'line';
  };

  // ─────────────────────────────────────────────────────────────
  // PERMISSIONS
  // ─────────────────────────────────────────────────────────────
  permission: {
    write: 'allow' | 'ask' | 'deny';
    delete: 'allow' | 'ask' | 'deny';
  };

  // ─────────────────────────────────────────────────────────────
  // SAFETY & ERROR HANDLING
  // ─────────────────────────────────────────────────────────────
  doomLoop?: 'ask' | 'deny' | 'allow';

  // ─────────────────────────────────────────────────────────────
  // MEMORY
  // ─────────────────────────────────────────────────────────────
  memory: {
    compactionEnabled: boolean;
    todoEnabled: boolean;
    preserveErrorsInContext?: boolean;
  };
}
```

---

## Session

```typescript
interface Session {
  id: string;
  parentId: string | null;
  agentId: string;
  userId: string;
  cmsType: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  depth: number;
  finalResponse?: string;
  artifacts?: string[];
  metadata: {
    totalTokens?: number;
    totalSteps?: number;
    childSessions?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

interface SessionResult {
  sessionId: string;
  status: 'completed' | 'error' | 'aborted';
  finalResponse?: string;
  artifacts?: string[];
  error?: string;
  metrics: {
    totalTokens: number;
    totalSteps: number;
    durationMs: number;
  };
}

interface SpawnChildOptions {
  parentSessionId: string;
  agentId: string;
  task: string;
  context?: string;
  sessionId?: string;
}
```

---

## ToolDefinition

```typescript
interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'cms' | 'search' | 'media' | 'utility';

  searchMetadata: {
    keywords: string[];
    useCases: string[];
  };

  parameters: z.ZodSchema;

  execute: (input: unknown, ctx: ToolContext) => Promise<ToolResult>;
}

interface ToolContext {
  sessionId: string;
  agentId: string;
  userId: string;
  cmsType: string;
  abortSignal: AbortSignal;
  eventBus: EventBus;
  orchestrator: SessionOrchestrator;
  spawningMode?: 'parallel' | 'sequential';
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  artifacts?: string[];
}
```

---

## CmsAdapter

```typescript
interface CmsAdapter {
  id: string;
  name: string;

  getTools(): Promise<Record<string, ToolDefinition>>;
  getPrompts(): Promise<Record<string, string>>;
  getAgents(): Promise<Record<string, AgentConfig>>;
  getSchemas(): Record<string, z.ZodSchema>;

  getPromptContext(): Promise<string>;
  parseWebhook(payload: unknown): CmsWebhookEvent;
  authenticate(credentials: unknown): Promise<void>;
}

interface CmsWebhookEvent {
  type: string;
  entityId: string;
  entityType: string;
  data: unknown;
}
```

---

## Todo

```typescript
interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
}

interface SessionTodos {
  sessionId: string;
  todos: TodoItem[];
}
```

---

## SystemConfig

```typescript
interface SystemConfig {
  features: {
    routerEnabled: boolean;
    complexityAssessment: boolean;
    orchestrationEnabled: boolean;
    parallelSpawning: boolean;
    freshContextMode: boolean;
    visualBuilderEnabled: boolean;
  };
  defaults: {
    simpleSpecialist: string;
    complexHandler: string;
  };
}
```

---

## Event Types

```typescript
// Session Events
interface SessionStartedEvent {
  sessionId: string;
  agentId: string;
  userId: string;
  parentId?: string;
}

interface SessionCompactedEvent {
  sessionId: string;
  tokensBefore: number;
  tokensAfter: number;
}

interface SessionCompletedEvent {
  sessionId: string;
  result: string;
  artifacts: string[];
}

interface SessionErrorEvent {
  sessionId: string;
  error: string;
  recoverable: boolean;
}

// Agent Events
interface AgentThinkingEvent {
  sessionId: string;
  step: number;
  maxSteps: number;
  toolCalls?: string[];
}

interface AgentStuckEvent {
  sessionId: string;
  lastToolCalls: { name: string; params: unknown }[];
  reason: string;
}

interface AgentSpawnedEvent {
  parentSessionId: string;
  childSessionId: string;
  agentId: string;
  task: string;
  resumed: boolean;
}

interface AgentChildCompletedEvent {
  parentSessionId: string;
  childSessionId: string;
  agentId: string;
  result: string;
}

// Tool Events
interface ToolExecutingEvent {
  sessionId: string;
  tool: string;
  input: unknown;
  step: number;
}

interface ToolCompletedEvent {
  sessionId: string;
  tool: string;
  result: unknown;
  durationMs: number;
}

interface ToolErrorEvent {
  sessionId: string;
  tool: string;
  error: string;
  isRetryable: boolean;
}

// Approval Events
interface ApprovalRequiredEvent {
  sessionId: string;
  action: string;
  resource: string;
  preview: {
    description: string;
    affectedEntities: string[];
    reversible: boolean;
  };
}

interface ApprovalReceivedEvent {
  sessionId: string;
  action: string;
  approved: boolean;
  feedback?: string;
}

// Todo Events
interface TodoUpdatedEvent {
  sessionId: string;
  todos: TodoItem[];
}

// Event Map for typed EventBus
interface EventMap {
  'session.started': SessionStartedEvent;
  'session.compacted': SessionCompactedEvent;
  'session.completed': SessionCompletedEvent;
  'session.error': SessionErrorEvent;
  'agent.thinking': AgentThinkingEvent;
  'agent.stuck': AgentStuckEvent;
  'agent.spawned': AgentSpawnedEvent;
  'agent.child_completed': AgentChildCompletedEvent;
  'tool.executing': ToolExecutingEvent;
  'tool.completed': ToolCompletedEvent;
  'tool.error': ToolErrorEvent;
  'approval.required': ApprovalRequiredEvent;
  'approval.received': ApprovalReceivedEvent;
  'todo.updated': TodoUpdatedEvent;
}
```

---

## Related Documents

- → [../2-agents/09-agent-catalog.md](../2-agents/09-agent-catalog.md) - Agent configs using these schemas
- → [../1-subsystems/03-tool-subsystem.md](../1-subsystems/03-tool-subsystem.md) - Tool interface usage
- → [../3-implementation/13-event-bus.md](../3-implementation/13-event-bus.md) - Event usage
