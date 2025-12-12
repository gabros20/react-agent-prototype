# Modular Agent Architecture Plan

## Executive Summary

This plan transforms the agent system from a functional but tightly-coupled implementation into a modular, testable, and maintainable architecture following software engineering best practices.

**Goals:**
1. Fix architectural problems (state leakage, duplication, scattered concerns)
2. Reorganize by domain concept (not technical layer)
3. Achieve industry-standard code organization with clear separation of concerns

**Current State:** Working agent with ~31 tools, dynamic tool search, and streaming execution. However, responsibilities are scattered, state leaks through module-level variables, and metadata is duplicated.

**Target State:** Clean separation of concerns organized by domain concept, with single-responsibility classes, no module-level state, unified data sources, and composable patterns.

---

## Target Directory Structure

```
server/
├── agents/                      # Agent definitions (thin, config-focused)
│   ├── main-agent.ts           # AI SDK ToolLoopAgent config (~80 lines)
│   ├── system-prompt.ts        # System prompt template loading
│   └── types.ts                # Agent-specific types
│
├── tools/                       # Tool definitions
│   ├── _registry/              # NEW: Unified tool registry
│   │   ├── tool-registry.ts    # Single source of truth for metadata
│   │   └── types.ts
│   ├── _loaders/               # Tool assembly utilities
│   │   ├── tool-assembler.ts
│   │   └── tool-prompt-loader.ts
│   ├── _types/                 # Tool type definitions
│   │   ├── agent-context.ts
│   │   └── metadata.ts
│   └── {toolName}/             # Per-tool folders (31 tools)
│       ├── {toolName}-metadata.ts
│       ├── {toolName}-tool.ts
│       └── index.ts
│
├── memory/                      # NEW: All memory concerns unified
│   ├── working-context/        # Entity sliding window
│   │   ├── working-context.ts  # (moved from services/working-memory/)
│   │   ├── entity-extractor.ts
│   │   └── types.ts
│   ├── tool-search/            # NEW: Tool search state management
│   │   ├── tool-search-state.ts    # Immutable state (replaces module vars)
│   │   └── tool-search-manager.ts  # Search + extraction logic
│   ├── context-manager/        # Message trimming/validation
│   │   ├── context-manager.ts  # (moved from services/context-manager/)
│   │   └── types.ts
│   └── index.ts                # Exports
│
├── execution/                   # NEW: Runtime orchestration
│   ├── orchestrator.ts         # Thin coordinator (~150 lines)
│   ├── context-coordinator.ts  # Context lifecycle
│   ├── stream-processor.ts     # Stream handling
│   ├── result-processor.ts     # Post-execution processing
│   └── types.ts                # (moved from services/agent/types.ts)
│
├── prompts/                     # Prompt management (EXPANDED)
│   ├── agent/                  # Agent prompts
│   │   └── main-agent-prompt.xml
│   ├── tools/                  # Tool prompts
│   │   └── {toolName}-prompt.xml
│   ├── builder/                # NEW: Prompt building system
│   │   ├── prompt-builder.ts
│   │   ├── injection-points.ts
│   │   └── tool-prompt-injector.ts
│   └── _index.ts
│
├── events/                      # NEW: Event system
│   ├── event-emitter.ts        # SSE event emitter
│   ├── event-types.ts          # Typed event definitions
│   └── index.ts
│
├── services/                    # Domain services (pure business logic)
│   ├── cms/                    # CMS domain (unchanged)
│   │   ├── page-service.ts
│   │   ├── section-service.ts
│   │   ├── entry-service.ts
│   │   └── site-settings-service.ts
│   ├── ai/                     # External AI services (unchanged)
│   │   ├── pexels.service.ts
│   │   ├── unsplash.service.ts
│   │   ├── exa-research.service.ts
│   │   └── metadata-generation.service.ts
│   ├── storage/                # File storage (unchanged)
│   │   ├── image-storage.service.ts
│   │   └── image-processing.service.ts
│   ├── search/                 # RENAMED & SIMPLIFIED from tool-search
│   │   ├── bm25-search.ts
│   │   ├── vector-search.ts
│   │   ├── smart-search.ts
│   │   ├── tool-search.service.ts
│   │   └── types.ts
│   ├── session-service.ts      # (unchanged)
│   ├── vector-index.ts         # (unchanged)
│   └── service-container.ts    # (updated imports)
│
├── routes/                      # HTTP routes (unchanged)
├── db/                          # Database (unchanged)
├── middleware/                  # Middleware (unchanged)
├── queues/                      # Job queues (unchanged)
├── workers/                     # Background workers (unchanged)
├── templates/                   # Nunjucks templates (unchanged)
├── types/                       # Shared types (unchanged)
└── utils/                       # Utilities (unchanged)
```

---

## Problems & Solutions

### Problem 1: Module-Level State Leakage

**Location:** `server/agents/main-agent.ts:25-36`

```typescript
// CURRENT: Module-level mutable state - DANGEROUS
let lastInjectedInstructions: {...} | null = null;
let currentBaseSystemPrompt: string = "";
let persistedDiscoveredTools: string[] = [];
```

**Issues:**
- Race conditions with concurrent requests
- Testing impossible (can't isolate state)
- Hidden dependencies
- Memory leaks

**Solution:** Create immutable `ToolSearchState` class in `memory/tool-search/`

**New File:** `server/memory/tool-search/tool-search-state.ts`

```typescript
/**
 * Immutable state for tool search within a single execution.
 *
 * Design decisions:
 * - Immutable: All mutations return new instances
 * - Serializable: Can be persisted to session storage
 * - Testable: No hidden dependencies
 */
export interface ToolSearchStateData {
  /** Tools found in previous turns (loaded from WorkingContext) */
  persistedTools: readonly string[];
  /** Tools found in current execution (from searchTools calls) */
  currentTools: readonly string[];
  /** Last injected instructions (for debug panel emission) */
  lastInjection: InjectionRecord | null;
  /** Base system prompt before tool injection */
  baseSystemPrompt: string;
}

export interface InjectionRecord {
  instructions: string;
  tools: readonly string[];
  updatedSystemPrompt: string;
  stepNumber: number;
  timestamp: Date;
}

export class ToolSearchState {
  private readonly data: ToolSearchStateData;

  private constructor(data: ToolSearchStateData) {
    this.data = Object.freeze(data);
  }

  /** Create initial state from WorkingContext */
  static fromWorkingContext(
    workingContext: WorkingContext,
    baseSystemPrompt: string
  ): ToolSearchState {
    return new ToolSearchState({
      persistedTools: Object.freeze([...workingContext.getDiscoveredTools()]),
      currentTools: Object.freeze([]),
      lastInjection: null,
      baseSystemPrompt,
    });
  }

  /** Add tools found from searchTools call */
  withFoundTools(tools: string[]): ToolSearchState {
    const merged = [...new Set([...this.data.currentTools, ...tools])];
    return new ToolSearchState({
      ...this.data,
      currentTools: Object.freeze(merged),
    });
  }

  /** Record injection for debug emission */
  withInjection(record: Omit<InjectionRecord, 'timestamp'>): ToolSearchState {
    return new ToolSearchState({
      ...this.data,
      lastInjection: { ...record, timestamp: new Date() },
    });
  }

  /** Get all active tools (persisted + current) */
  getAllActiveTools(): string[] {
    return [...new Set([...this.data.persistedTools, ...this.data.currentTools])];
  }

  /** Get last injection and clear it (for SSE emission) */
  consumeLastInjection(): { state: ToolSearchState; injection: InjectionRecord | null } {
    const injection = this.data.lastInjection;
    return {
      state: new ToolSearchState({ ...this.data, lastInjection: null }),
      injection,
    };
  }

  get baseSystemPrompt(): string {
    return this.data.baseSystemPrompt;
  }

  get persistedTools(): readonly string[] {
    return this.data.persistedTools;
  }

  get currentTools(): readonly string[] {
    return this.data.currentTools;
  }
}
```

**New File:** `server/memory/tool-search/tool-search-manager.ts`

```typescript
/**
 * Manages tool search lifecycle within an execution.
 *
 * Responsibilities:
 * - Extract found tools from step results
 * - Merge persisted and current tools
 * - Determine active tools for each step
 * - NO knowledge of prompts (that's PromptBuilder's job)
 */
export class ToolSearchManager {
  /**
   * Extract tools found in current execution steps.
   * Replaces: extractToolsFromSteps in step-extraction.ts
   */
  extractFromSteps(steps: StepResult[]): string[] {
    const tools = new Set<string>();

    for (const step of steps) {
      const searchResults = step.toolResults?.filter(
        (tr) => tr.toolName === "searchTools"
      );

      searchResults?.forEach((sr) => {
        const output = sr.output as SearchToolsResult | undefined;
        output?.tools?.forEach((toolName) => {
          if (toolName && typeof toolName === "string") {
            tools.add(toolName);
          }
        });
      });
    }

    return Array.from(tools);
  }

  /**
   * Compute active tools for a given step.
   * Replaces: Logic in prepareStep that merges persisted + current
   */
  computeActiveTools(
    state: ToolSearchState,
    steps: StepResult[],
    coreTools: string[]
  ): { activeTools: string[]; updatedState: ToolSearchState } {
    // Extract from current steps
    const fromCurrentSteps = this.extractFromSteps(steps);

    // Update state with new findings
    const updatedState = fromCurrentSteps.length > 0
      ? state.withFoundTools(fromCurrentSteps)
      : state;

    // Combine: core + persisted + current
    const activeTools = [
      ...new Set([
        ...coreTools,
        ...updatedState.getAllActiveTools(),
      ])
    ];

    return { activeTools, updatedState };
  }
}

/** AI SDK 6 StepResult structure */
interface StepResult {
  toolResults?: Array<{
    toolName: string;
    output: unknown;
  }>;
}

interface SearchToolsResult {
  tools?: string[];
  message?: string;
}
```

**Before/After in main-agent.ts:**

```typescript
// BEFORE: Module-level state
let persistedDiscoveredTools: string[] = [];

prepareStep: ({ stepNumber, steps }) => {
  const { extractToolsFromSteps } = await import("../tools/_utils/step-extraction");
  const fromCurrentSteps = extractToolsFromSteps(steps);
  const discoveredTools = [...new Set([...persistedDiscoveredTools, ...fromCurrentSteps])];
  // ...
}

// AFTER: Immutable state via context
prepareStep: ({ stepNumber, steps, experimental_context }) => {
  const ctx = experimental_context as AgentContext;
  const { activeTools, updatedState } = ctx.toolSearchManager.computeActiveTools(
    ctx.toolSearchState,
    steps,
    CORE_TOOLS
  );
  ctx.toolSearchState = updatedState;
  // ...
}
```

---

### Problem 2: Tool Metadata Duplication

**Duplication Locations:**
1. `server/tools/{toolName}/{toolName}-metadata.ts` (31 files)
2. `server/services/tool-search/tool-registry.ts` (526 lines of duplicated metadata)

**Issues:**
- Data drift (changes require updates in 2 places)
- 526 lines of redundant code
- Inconsistency risk

**Solution:** Create unified `ToolRegistry` in `tools/_registry/` that loads from per-tool files.

**New File:** `server/tools/_registry/tool-registry.ts`

```typescript
/**
 * Unified Tool Registry
 *
 * Single source of truth for tool metadata.
 * Loads metadata dynamically from per-tool folders.
 *
 * Design decisions:
 * - Lazy loading: Only loads metadata when first accessed
 * - Caching: Production caches, development hot-reloads
 * - Type-safe: Full TypeScript support
 */
export class ToolRegistry {
  private static instance: ToolRegistry;
  private cache: Map<string, ToolMetadata> = new Map();
  private allToolsCache: ToolMetadata[] | null = null;
  private readonly isDev: boolean;

  private constructor() {
    this.isDev = process.env.NODE_ENV !== 'production';
  }

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * Get metadata for a specific tool
   */
  async getMetadata(toolName: string): Promise<ToolMetadata | null> {
    if (this.isDev) {
      return this.loadMetadata(toolName);
    }

    if (!this.cache.has(toolName)) {
      const metadata = await this.loadMetadata(toolName);
      if (metadata) {
        this.cache.set(toolName, metadata);
      }
    }
    return this.cache.get(toolName) || null;
  }

  /**
   * Get all tool metadata
   */
  async getAllMetadata(): Promise<ToolMetadata[]> {
    if (this.isDev) {
      return this.loadAllMetadata();
    }

    if (!this.allToolsCache) {
      this.allToolsCache = await this.loadAllMetadata();
    }
    return this.allToolsCache;
  }

  /**
   * Get search corpus for BM25/vector search
   */
  async getSearchCorpus(): Promise<SearchCorpusEntry[]> {
    const allMetadata = await this.getAllMetadata();
    return allMetadata.map(m => ({
      name: m.name,
      text: this.buildSearchText(m),
      phrases: m.phrases,
      relatedTools: m.relatedTools,
    }));
  }

  private buildSearchText(metadata: ToolMetadata): string {
    return [metadata.name, metadata.description, ...metadata.phrases].join(' ');
  }

  private async loadMetadata(toolName: string): Promise<ToolMetadata | null> {
    try {
      const module = await import(`../${toolName}/${toolName}-metadata`);
      return module.default as ToolMetadata;
    } catch {
      return null;
    }
  }

  private async loadAllMetadata(): Promise<ToolMetadata[]> {
    const { getToolFolders } = await import('../_loaders/tool-assembler');
    const toolFolders = await getToolFolders();
    const metadata: ToolMetadata[] = [];

    for (const folder of toolFolders) {
      const m = await this.loadMetadata(folder);
      if (m) metadata.push(m);
    }

    return metadata;
  }

  clearCache(): void {
    this.cache.clear();
    this.allToolsCache = null;
  }
}

interface SearchCorpusEntry {
  name: string;
  text: string;
  phrases: string[];
  relatedTools: string[];
}
```

**Delete:** `server/services/tool-search/tool-registry.ts` (526 lines removed!)

**Update:** `server/services/search/tool-search.service.ts` to use `ToolRegistry`

```typescript
export class ToolSearchService {
  private readonly registry: ToolRegistry;

  constructor() {
    this.registry = ToolRegistry.getInstance();
  }

  async initialize(): Promise<void> {
    const corpus = await this.registry.getSearchCorpus();
    // Initialize BM25 and vector indices with corpus...
  }
}
```

---

### Problem 3: Fragile Prompt Injection

**Current State:**
- `system-prompt.ts` - Loads template with Handlebars
- `tool-prompt-loader.ts` - Loads tool prompts from disk
- `main-agent.ts:184-189` - Regex replacement in `prepareStep`

```typescript
// CURRENT: Fragile regex in main-agent.ts
const updatedContent = toolInstructions
  ? currentBaseSystemPrompt.replace(
      /<tool-usage-instructions>[\s\S]*?<\/tool-usage-instructions>/g,
      `<tool-usage-instructions>\n${toolInstructions}\n</tool-usage-instructions>`
    )
  : currentBaseSystemPrompt;
```

**Issues:**
- Fragile regex that can silently fail
- No validation of injection points
- Logic scattered across 3 files
- Hard to trace what got injected

**Solution:** Create type-safe `PromptBuilder` system in `prompts/builder/`

**New File:** `server/prompts/builder/injection-points.ts`

```typescript
/**
 * Type-safe injection point definitions
 */
export const INJECTION_POINTS = {
  WORKING_MEMORY: {
    id: 'workingMemory',
    placeholder: '{{{workingMemory}}}',
    default: '',
    required: false,
  },
  TOOL_INSTRUCTIONS: {
    id: 'activeProtocols',
    tag: 'tool-usage-instructions',
    default: '<!-- No tool instructions -->',
    required: true,
  },
  CURRENT_DATE: {
    id: 'currentDate',
    placeholder: '{{currentDate}}',
    default: () => new Date().toISOString(),
    required: true,
  },
} as const;

export type InjectionPointId = keyof typeof INJECTION_POINTS;
```

**New File:** `server/prompts/builder/prompt-builder.ts`

```typescript
/**
 * Type-safe prompt builder with validation
 *
 * Features:
 * - Explicit injection points
 * - Validation before rendering
 * - Injection history tracking
 * - Hot-reload support
 */
export class PromptBuilder {
  private readonly templateLoader: TemplateLoader;
  private injections: Map<InjectionPointId, InjectionValue> = new Map();
  private history: InjectionHistory[] = [];

  constructor(templateLoader: TemplateLoader) {
    this.templateLoader = templateLoader;
  }

  inject(point: InjectionPointId, value: string): this {
    const definition = INJECTION_POINTS[point];
    if (!definition) {
      throw new Error(`Unknown injection point: ${point}`);
    }

    this.injections.set(point, {
      point,
      value,
      timestamp: new Date(),
    });

    return this;
  }

  build(): PromptBuildResult {
    const template = this.templateLoader.load('main-agent-prompt.xml');

    const missing = this.validateRequired();
    if (missing.length > 0) {
      throw new Error(`Missing required injections: ${missing.join(', ')}`);
    }

    let result = template;
    for (const [pointId, injection] of this.injections) {
      const definition = INJECTION_POINTS[pointId];
      result = this.applyInjection(result, definition, injection.value);
    }

    result = this.applyDefaults(result);

    this.history.push({
      timestamp: new Date(),
      injections: new Map(this.injections),
      result,
    });

    return { prompt: result, injections: this.injections, history: this.history };
  }

  updateInjection(point: InjectionPointId, value: string): PromptBuildResult {
    this.inject(point, value);
    return this.build();
  }

  private applyInjection(
    template: string,
    definition: InjectionPointDefinition,
    value: string
  ): string {
    if (definition.tag) {
      const regex = new RegExp(`<${definition.tag}>[\\s\\S]*?</${definition.tag}>`, 'g');
      return template.replace(regex, `<${definition.tag}>\n${value}\n</${definition.tag}>`);
    }
    return template.replace(definition.placeholder, value);
  }

  private validateRequired(): string[] {
    return Object.entries(INJECTION_POINTS)
      .filter(([_, def]) => def.required && !this.injections.has(_ as InjectionPointId))
      .map(([id]) => id);
  }

  private applyDefaults(template: string): string {
    let result = template;
    for (const [id, definition] of Object.entries(INJECTION_POINTS)) {
      if (!this.injections.has(id as InjectionPointId)) {
        const defaultValue = typeof definition.default === 'function'
          ? definition.default()
          : definition.default;
        result = this.applyInjection(result, definition, defaultValue);
      }
    }
    return result;
  }
}
```

**New File:** `server/prompts/builder/tool-prompt-injector.ts`

```typescript
/**
 * Specialized injector for tool prompts
 */
export class ToolPromptInjector {
  private readonly promptLoader: ToolPromptLoader;

  constructor(promptLoader: ToolPromptLoader) {
    this.promptLoader = promptLoader;
  }

  buildToolPrompts(toolNames: string[]): ToolPromptResult {
    const prompts: Map<string, string> = new Map();
    const missing: string[] = [];

    for (const name of toolNames) {
      const prompt = this.promptLoader.load(name);
      if (prompt) {
        prompts.set(name, prompt);
      } else {
        missing.push(name);
      }
    }

    return {
      combined: Array.from(prompts.values()).join('\n\n'),
      toolPrompts: prompts,
      missingPrompts: missing,
      toolCount: prompts.size,
    };
  }
}
```

---

### Problem 4: Monolithic Orchestrator

**Location:** `server/services/agent/orchestrator.ts` (881 lines)

**Current Responsibilities (9!):**
1. Session management
2. Working context loading/persistence
3. Message history loading
4. Token counting and emission
5. SSE event emission (8+ event types)
6. Agent options building
7. Stream processing (200+ lines)
8. Entity extraction
9. Message persistence

**Issues:**
- Untestable monolith
- Rigid structure
- Mixed abstraction levels

**Solution:** Decompose into focused classes in `execution/`

**New File:** `server/execution/context-coordinator.ts`

```typescript
/**
 * Manages the complete context lifecycle for agent execution.
 *
 * Single responsibility: Context lifecycle
 * - Load working context from session
 * - Load message history
 * - Trim context to fit token budget
 * - Persist updates after execution
 */
export class ContextCoordinator {
  private readonly sessionService: SessionService;
  private readonly contextManager: ContextManager;

  constructor(deps: ContextCoordinatorDeps) {
    this.sessionService = deps.sessionService;
    this.contextManager = deps.contextManager;
  }

  async prepareContext(sessionId: string): Promise<PreparedContext> {
    await this.sessionService.ensureSession(sessionId);
    const workingContext = await this.sessionService.loadWorkingContext(sessionId);
    const messages = await this.sessionService.loadMessages(sessionId);

    return { workingContext, messages, sessionId };
  }

  trimContext(
    messages: ModelMessage[],
    workingContext: WorkingContext,
    userPrompt: string
  ): TrimResult {
    const fullMessages: ModelMessage[] = [
      ...messages,
      { role: 'user', content: userPrompt },
    ];
    return this.contextManager.trimContext(fullMessages, workingContext);
  }

  async persistContext(
    sessionId: string,
    messages: ModelMessage[],
    workingContext: WorkingContext
  ): Promise<void> {
    await Promise.all([
      this.sessionService.saveMessages(sessionId, messages),
      this.sessionService.saveWorkingContext(sessionId, workingContext),
    ]);
  }
}
```

**New File:** `server/execution/stream-processor.ts`

```typescript
/**
 * Processes agent stream events and emits SSE events.
 *
 * Single responsibility: Stream handling
 * - Iterate over stream chunks
 * - Map chunk types to SSE events
 * - Track tool calls and results
 * - Handle special tools (finalAnswer, acknowledgeRequest, searchTools)
 */
export class StreamProcessor {
  private readonly eventEmitter: SSEEventEmitter;
  private readonly resultProcessor: ResultProcessor;

  constructor(deps: StreamProcessorDeps) {
    this.eventEmitter = deps.eventEmitter;
    this.resultProcessor = deps.resultProcessor;
  }

  async process(
    streamResult: AgentStreamResult,
    workingContext: WorkingContext
  ): Promise<StreamProcessResult> {
    const collector = new ResultCollector();

    for await (const chunk of streamResult.fullStream) {
      await this.handleChunk(chunk, collector, workingContext);
    }

    return collector.getResults();
  }

  private async handleChunk(
    chunk: StreamChunk,
    collector: ResultCollector,
    workingContext: WorkingContext
  ): Promise<void> {
    switch (chunk.type) {
      case 'text-delta':
        this.handleTextDelta(chunk, collector);
        break;
      case 'tool-call':
        this.handleToolCall(chunk, collector);
        break;
      case 'tool-result':
        await this.handleToolResult(chunk, collector, workingContext);
        break;
      case 'start-step':
        this.handleStepStart(chunk);
        break;
      case 'finish-step':
        this.handleStepFinish(chunk);
        break;
      case 'finish':
        this.handleFinish(chunk, collector);
        break;
      case 'error':
        this.handleError(chunk);
        break;
    }
  }

  // ... chunk handlers
}
```

**New File:** `server/execution/result-processor.ts`

```typescript
/**
 * Processes tool results for entity extraction and persistence.
 *
 * Single responsibility: Post-execution processing
 * - Extract entities from tool results
 * - Track tool usage statistics
 * - Format results for persistence
 */
export class ResultProcessor {
  private readonly entityExtractor: EntityExtractor;

  constructor() {
    this.entityExtractor = new EntityExtractor();
  }

  extractEntities(toolName: string, result: unknown): Entity[] {
    return this.entityExtractor.extract(toolName, result);
  }

  buildPersistenceMessages(
    previousMessages: ModelMessage[],
    userPrompt: string,
    responseMessages: ModelMessage[],
    displayContent?: string
  ): ModelMessage[] {
    let lastAssistantIndex = -1;
    for (let i = responseMessages.length - 1; i >= 0; i--) {
      if (responseMessages[i].role === 'assistant') {
        lastAssistantIndex = i;
        break;
      }
    }

    return [
      ...previousMessages,
      { role: 'user', content: userPrompt, displayContent: userPrompt },
      ...responseMessages.map((msg, index) => ({
        ...msg,
        displayContent: index === lastAssistantIndex ? displayContent : undefined,
      })),
    ];
  }
}
```

**New File:** `server/execution/orchestrator.ts`

```typescript
/**
 * Thin orchestrator that coordinates execution phases.
 *
 * Delegates to:
 * - ContextCoordinator: Context lifecycle
 * - StreamProcessor: Stream event handling
 * - ResultProcessor: Post-execution processing
 * - SSEEventEmitter: Event emission
 *
 * Target: ~150 lines (down from 881)
 */
export class ExecutionOrchestrator {
  private readonly contextCoordinator: ContextCoordinator;
  private readonly streamProcessor: StreamProcessor;
  private readonly resultProcessor: ResultProcessor;

  constructor(deps: OrchestratorDependencies) {
    this.contextCoordinator = new ContextCoordinator(deps);
    this.streamProcessor = new StreamProcessor(deps);
    this.resultProcessor = new ResultProcessor();
  }

  async *executeStream(
    options: ExecuteOptions,
    writeSSE: WriteSSEFn
  ): AsyncGenerator<void> {
    const resolved = await this.resolveOptions(options);
    const eventEmitter = new SSEEventEmitter(writeSSE, resolved.traceId);

    try {
      // Phase 1: Prepare context
      const { workingContext, messages } = await this.contextCoordinator.prepareContext(
        resolved.sessionId
      );

      // Emit context info
      this.emitContextInfo(eventEmitter, resolved, workingContext, messages);

      // Trim context
      const trimResult = this.contextCoordinator.trimContext(
        messages,
        workingContext,
        resolved.prompt
      );

      // Phase 2: Execute agent
      const streamResult = await this.executeAgent(trimResult.messages, resolved, workingContext);

      // Phase 3: Process stream
      const results = await this.streamProcessor.process(streamResult, workingContext);

      // Phase 4: Persist
      const persistMessages = this.resultProcessor.buildPersistenceMessages(
        messages,
        resolved.prompt,
        await streamResult.response.then(r => r.messages),
        results.displayTexts.join('\n\n')
      );

      await this.contextCoordinator.persistContext(
        resolved.sessionId,
        persistMessages,
        workingContext
      );

      // Emit final events
      eventEmitter.emit('result', results);
      eventEmitter.emit('done', { sessionId: resolved.sessionId });
    } catch (error) {
      eventEmitter.emit('error', { error: (error as Error).message });
    }
  }
}
```

---

### Problem 5: Scattered SSE Events

**Current State:**
- `writeSSE()` calls scattered throughout orchestrator
- No centralized event schema
- Hard to test event emission

**Solution:** Create typed event system in `events/`

**New File:** `server/events/event-types.ts`

```typescript
/**
 * Typed event definitions for SSE emission
 */
export interface EventDefinitions {
  'system-prompt': SystemPromptEvent;
  'user-prompt': UserPromptEvent;
  'model-info': ModelInfoEvent;
  'llm-context': LLMContextEvent;
  'context-cleanup': ContextCleanupEvent;
  'step-start': StepStartEvent;
  'step-finish': StepFinishEvent;
  'tool-call': ToolCallEvent;
  'tool-result': ToolResultEvent;
  'tool-error': ToolErrorEvent;
  'tools-found': ToolsFoundEvent;
  'instructions-injected': InstructionsInjectedEvent;
  'message-start': MessageStartEvent;
  'text-delta': TextDeltaEvent;
  'message-complete': MessageCompleteEvent;
  'finish': FinishEvent;
  'result': ResultEvent;
  'done': DoneEvent;
  'error': ErrorEvent;
  'log': LogEvent;
}

export type EventType = keyof EventDefinitions;
export type EventPayload<T extends EventType> = EventDefinitions[T];

// Event interfaces...
export interface SystemPromptEvent extends BaseEvent {
  type: 'system-prompt';
  prompt: string;
  promptLength: number;
  tokens: number;
  workingMemory: string;
  workingMemoryTokens: number;
}

// ... other event interfaces
```

**New File:** `server/events/event-emitter.ts`

```typescript
/**
 * Type-safe SSE event emitter
 *
 * Features:
 * - Type-safe event emission
 * - Event history tracking (for testing)
 * - Testable without HTTP
 */
export class SSEEventEmitter {
  private readonly writeSSE: WriteSSEFn;
  private readonly history: EmittedEvent[] = [];
  private readonly traceId: string;

  constructor(writeSSE: WriteSSEFn, traceId: string) {
    this.writeSSE = writeSSE;
    this.traceId = traceId;
  }

  emit<T extends EventType>(
    type: T,
    payload: Omit<EventPayload<T>, 'type' | 'timestamp' | 'traceId'>
  ): void {
    const event = {
      type,
      ...payload,
      traceId: this.traceId,
      timestamp: new Date().toISOString(),
    } as EventPayload<T>;

    this.history.push({ type, payload: event, timestamp: new Date() });
    this.writeSSE(type, event);
  }

  getHistory(): EmittedEvent[] {
    return [...this.history];
  }

  getEventsOfType<T extends EventType>(type: T): EventPayload<T>[] {
    return this.history
      .filter(e => e.type === type)
      .map(e => e.payload as EventPayload<T>);
  }
}

type WriteSSEFn = (event: string, data: unknown) => void;
```

---

## Migration Plan

### Sprint 1: Foundation - Memory & Tool Registry ✅ COMPLETED

**Goal:** Eliminate state leakage, consolidate metadata

**Completion Date:** 2025-12-11

**Tasks:**
1. ✅ Create `memory/` directory structure
2. ✅ Move `services/working-memory/*` → `memory/working-context/`
3. ✅ Move `services/context-manager/*` → `memory/context-manager/`
4. ✅ Create `memory/tool-search/tool-search-state.ts`
5. ✅ Create `memory/tool-search/tool-search-manager.ts`
6. ✅ Create `tools/_registry/tool-registry.ts`
7. ✅ Update `main-agent.ts` to use `ToolSearchManager` (note: full immutable state blocked by AI SDK limitation)
8. ✅ Rename `services/tool-search/` → `services/search/`
9. ✅ Delete `services/search/tool-registry.ts` - DELETED (new ToolRegistry provides async init + sync access)
10. ✅ Delete `tools/_utils/step-extraction.ts` - DELETED (logic in memory/tool-search/)
11. ✅ Update all imports

**Notes:**
- Module-level state in main-agent.ts is an AI SDK limitation (prepareStep lacks context access)
- Documented clearly with comments explaining the constraint
- ToolSearchManager replaces dynamic import with synchronous extraction

**Files Created:**
```
memory/
├── working-context/
│   ├── working-context.ts
│   ├── entity-extractor.ts
│   └── types.ts
├── tool-search/
│   ├── tool-search-state.ts
│   └── tool-search-manager.ts
├── context-manager/
│   ├── context-manager.ts
│   └── types.ts
└── index.ts

tools/_registry/
├── tool-registry.ts
└── types.ts
```

**Files Deleted:**
```
services/working-memory/ (moved to memory/working-context/)
services/context-manager/ (moved to memory/context-manager/)
services/search/tool-registry.ts (526 lines - consolidated into tools/_registry/)
tools/_utils/step-extraction.ts (logic moved to memory/tool-search/)
tools/_loaders/tool-prompt-loader.ts (replaced by prompts/builder/)
services/agent/ (entire folder - moved to execution/)
```

**Registry Consolidation (Fixed 2025-12-11):**
The duplicate `services/search/tool-registry.ts` (526 lines) was eliminated by:
1. Redesigning `tools/_registry/tool-registry.ts` with async init + sync access pattern
2. `ToolSearchService.initialize()` now calls `ToolRegistry.initialize()` first
3. All sync lookups use `ToolRegistry.getInstance().get()`, `.getAll()`, etc.
4. Legacy `TOOL_REGISTRY` constant uses Proxy to delegate to singleton (backward compat)

**Test:** Verify tool search still works with new state management

---

### Sprint 2: Prompt System ✅ COMPLETED

**Goal:** Replace fragile regex with type-safe injection

**Completion Date:** 2025-12-11

**Tasks:**
1. ✅ Create `prompts/builder/injection-points.ts` - Type-safe injection point definitions
2. ✅ Create `prompts/builder/prompt-builder.ts` - Immutable builder with memoization
3. ✅ Create `prompts/builder/tool-prompt-injector.ts` - Deduplicating tool prompt loader
4. ✅ Update `main-agent.ts` to use `PromptBuilder` and `ToolPromptInjector`
5. ⏳ Simplify `system-prompt.ts` (kept - works well with Handlebars for initial load)
6. ✅ Remove regex replacement from `main-agent.ts` - Now uses PromptBuilder.withToolInstructions()

**Files Created:**
```
prompts/builder/
├── injection-points.ts   # INJECTION_POINTS, InjectionData types
├── prompt-builder.ts     # PromptBuilder class (immutable, memoized)
├── tool-prompt-injector.ts # ToolPromptInjector (deduplicating)
└── index.ts              # Unified exports
```

**Improvements:**
- Type-safe injection points with explicit patterns
- Immutable builder pattern for prompt construction
- Automatic deduplication in ToolPromptInjector
- Build-time memoization for repeated builds
- Deprecated old tool-prompt-loader.ts

**Test:** TypeScript compiles, prompt injection functional

---

### Sprint 3: Execution & Events ✅ COMPLETED

**Goal:** Decompose orchestrator, add typed events

**Completion Date:** 2025-12-11

**Tasks:**
1. ✅ Create `events/event-types.ts` - All typed SSE event definitions
2. ✅ Create `events/event-emitter.ts` - `SSEEventEmitter` class with typed methods
3. ✅ Create `execution/context-coordinator.ts` - Session & context management
4. ✅ Create `execution/stream-processor.ts` - Stream handling & entity extraction
5. ✅ Create `execution/result-processor.ts` - Logic merged into stream-processor (simpler)
6. ✅ Create `execution/orchestrator.ts` (thin) - ~150 lines coordinator
7. ✅ Create `execution/types.ts` - Execution types
8. ✅ Delete `services/agent/` folder - DELETED (was 28KB orchestrator + types)
9. ✅ Update routes to use new orchestrator - Uses same interface via service-container
10. ✅ Update `service-container.ts` - Now imports from `../execution`

**Files Created:**
```
events/
├── event-types.ts   # BaseEvent, StreamEvent, SystemPromptEvent, etc.
├── event-emitter.ts # SSEEventEmitter with typed emitX methods
└── index.ts         # Unified exports

execution/
├── orchestrator.ts         # AgentOrchestrator (~150 lines)
├── context-coordinator.ts  # Session/context lifecycle
├── stream-processor.ts     # Stream handling + entity extraction
├── types.ts                # ExecuteOptions, OrchestratorResult, etc.
└── index.ts                # Unified exports
```

**Files Deleted:**
```
services/agent/             # Entire folder deleted (orchestrator.ts, types.ts, validation-service.ts, index.ts)
```

**Files Modified:**
```
services/service-container.ts # Imports from ../execution
```

**Notes:**
- `result-processor.ts` not created separately - entity extraction integrated into `StreamProcessor`
- `services/agent/` folder fully deleted after verification of no imports
- AI SDK 6 uses `start-step`/`finish-step` (not `step-start`/`step-finish`)
- Stream chunk types from AI SDK 6: text-delta, tool-call, tool-result, start-step, finish-step, finish, error

**Test:** TypeScript compiles successfully ✅

---

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| `main-agent.ts` lines | 265 | ~80 |
| `orchestrator.ts` lines | 881 | ~150 |
| Module-level state vars | 3 | 0 |
| Tool metadata sources | 2 | 1 |
| Testable units | ~3 | ~12 |
| Lines deleted | 0 | 526+ |
| Top-level folders | 12 | 15 |

---

## File Operations Summary

### Create (New Files)
```
memory/working-context/working-context.ts
memory/working-context/entity-extractor.ts
memory/working-context/types.ts
memory/tool-search/tool-search-state.ts
memory/tool-search/tool-search-manager.ts
memory/context-manager/context-manager.ts
memory/context-manager/types.ts
memory/index.ts

tools/_registry/tool-registry.ts
tools/_registry/types.ts

prompts/builder/injection-points.ts
prompts/builder/prompt-builder.ts
prompts/builder/tool-prompt-injector.ts
prompts/builder/index.ts

execution/orchestrator.ts
execution/context-coordinator.ts
execution/stream-processor.ts
execution/result-processor.ts
execution/types.ts
execution/index.ts

events/event-types.ts
events/event-emitter.ts
events/index.ts
```

### Move (Relocate Files)
```
services/working-memory/* → memory/working-context/
services/context-manager/* → memory/context-manager/
services/agent/types.ts → execution/types.ts
services/tool-search/ → services/search/ (rename)
```

### Delete (Remove Files)
```
services/working-memory/ (entire folder - moved)
services/context-manager/ (entire folder - moved)
services/agent/ (entire folder - logic moved to execution/)
services/tool-search/tool-registry.ts (replaced by tools/_registry/)
tools/_utils/step-extraction.ts (logic moved to memory/tool-search/)
```

### Modify (Update Files)
```
agents/main-agent.ts (simplify, use new state management)
agents/system-prompt.ts (simplify to template loading only)
services/search/smart-search.ts (use ToolRegistry)
services/search/tool-search.service.ts (use ToolRegistry)
services/service-container.ts (update imports)
routes/agent.ts (use new ExecutionOrchestrator)
```

---

## Risk Mitigation

1. **Incremental migration** - Each sprint can be deployed independently
2. **Feature flags** - Can toggle between old/new implementations during transition
3. **Comprehensive testing** - Each sprint includes test verification
4. **Rollback plan** - Git branches for each sprint
5. **No breaking API changes** - Routes remain the same, only internals change

---

## Architecture Principles Applied

| Principle | Implementation |
|-----------|----------------|
| **Single Responsibility** | Each class has one clear purpose |
| **Separation of Concerns** | Organized by domain concept, not layer |
| **Dependency Injection** | Services injected via constructor |
| **Immutability** | `ToolSearchState` returns new instances |
| **Type Safety** | TypeScript throughout, typed events |
| **Testability** | Small units, no global state |
| **DRY** | Single source of truth for metadata |
| **Open/Closed** | Extensible via new injection points |

---

## Future Improvements (Post-Refactor Considerations)

Based on research of production AI agent patterns (midday-ai/ai-sdk-tools) and analysis of our current architecture, these are potential improvements to consider **after** the main refactor is complete. These are NOT part of the current plan - they are ideas for future iterations.

### 1. Typed Generic Context Pattern

**Current:** `AgentContext` is a flat interface with all dependencies

**Improvement:** Make context generic with typed scopes

```typescript
// CURRENT
interface AgentContext {
  db: DrizzleDB;
  services: ServiceContainer;
  sessionId: string;
  traceId: string;
  cmsTarget?: { siteId: string; environmentId: string };
  // ... everything flat
}

// FUTURE: Scoped typed context
interface AgentContext<TUserContext = unknown> {
  // Execution scope (per-request)
  execution: {
    traceId: string;
    sessionId: string;
  };

  // Tenant scope (multi-tenant)
  tenant: {
    siteId: string;
    environmentId: string;
  };

  // User-provided context (generic)
  user: TUserContext;

  // Services (injected)
  services: ServiceContainer;
}

// Usage: const agent = new Agent<{ teamId: string; preferences: UserPrefs }>();
```

**Why:** Enables type-safe user context, cleaner separation of concerns, better multi-tenant support.

---

### 2. Tool Caching Decorator Pattern

**Current:** No caching layer for tool results

**Improvement:** Wrap expensive tools with cache decorators

```typescript
// FUTURE: Cache decorator for tools
const cachedGetImage = withCache(getImage, {
  ttl: 300, // 5 minutes
  keyFn: (input) => `image:${input.id}`,
  scope: 'tenant', // Cache per-tenant
});

// With hit/miss metrics
cachedGetImage.getStats(); // { hits: 15, misses: 3, hitRate: 0.83 }
```

**Why:** Reduces redundant DB/API calls, especially for read-heavy tools like `getPage`, `getImage`.

---

### 3. Input/Output Guardrails

**Current:** No validation layer around tool execution

**Improvement:** Add guardrails for safety and compliance

```typescript
// FUTURE: Guardrails in tool definition
const deletePageTool = tool({
  // ... existing config
  inputGuardrails: [
    async (input, ctx) => {
      // Prevent deleting protected pages
      if (PROTECTED_SLUGS.includes(input.slug)) {
        return { pass: false, action: 'block', message: 'Cannot delete protected page' };
      }
      return { pass: true };
    }
  ],
  outputGuardrails: [
    async (output, ctx) => {
      // Redact sensitive fields before returning
      return { pass: true, action: 'modify', modifiedOutput: redact(output) };
    }
  ]
});
```

**Why:** Adds safety layer for destructive operations, compliance for sensitive data.

---

### 4. Observable Tool Execution

**Current:** Events emitted but no structured metrics

**Improvement:** Built-in observability hooks

```typescript
// FUTURE: Tool execution metrics
interface ToolMetrics {
  tool: string;
  duration: number;
  inputTokens: number;
  outputSize: number;
  cacheHit: boolean;
  error?: string;
}

// In events/
class ExecutionObserver {
  private metrics: ToolMetrics[] = [];

  onToolComplete(metric: ToolMetrics): void {
    this.metrics.push(metric);
  }

  getStats(): {
    avgDuration: number;
    errorRate: number;
    mostUsedTools: string[];
  } {
    // Aggregate metrics
  }
}
```

**Why:** Performance tuning, identifying slow tools, cost optimization.

---

### 5. Declarative Entity Extraction (Already Partially Implemented)

**Current:** `EntityExtractor` uses heuristics to find entities in tool results

**Improvement:** Fully leverage the `extraction` schema in tool metadata

```typescript
// CURRENT: Metadata has extraction schema but extractor ignores it
export default defineToolMetadata({
  name: 'getPage',
  extraction: {
    path: 'items',      // Where to find data
    type: 'page',       // Entity type
    nameField: 'name',  // Display name field
    isArray: true,      // Multiple entities
  },
});

// FUTURE: Extractor uses metadata directly
class MetadataAwareExtractor {
  constructor(private registry: ToolRegistry) {}

  async extract(toolName: string, result: unknown): Promise<Entity[]> {
    const metadata = await this.registry.getMetadata(toolName);
    if (!metadata?.extraction) return [];

    // Use extraction schema instead of heuristics
    const { path, type, nameField, idField, isArray } = metadata.extraction;
    const data = this.getPath(result, path);
    // ... extract using schema
  }
}
```

**Why:** We already define extraction schemas but don't fully use them. This would make extraction deterministic.

---

### 6. Memory Scope Distinction

**Current:** `WorkingContext` mixes chat-level and user-level memory

**Improvement:** Explicit memory scopes

```typescript
// FUTURE: Scoped memory
interface MemoryScopes {
  // Chat-level: Cleared on new session
  chat: {
    entities: Entity[];       // Recent entities in this conversation
    discoveredTools: string[]; // Tools found this session
  };

  // User-level: Persists across sessions
  user: {
    preferences: UserPrefs;    // Formatting, language
    frequentTools: string[];   // Tools they use often
    recentProjects: string[];  // Cross-session context
  };

  // Tenant-level: Shared across users
  tenant: {
    siteConfig: SiteConfig;
    customTools: string[];
  };
}
```

**Why:** Better personalization, smarter defaults across sessions.

---

### 7. Provider Fallback for External Tools

**Current:** External tools (searchWeb, importImage) have single provider

**Improvement:** Cascading fallback with metrics

```typescript
// FUTURE: Provider fallback for searchWeb
const searchWebTool = tool({
  // ...
  execute: async (input, ctx) => {
    const providers = [TavilyProvider, ExaProvider, SerperProvider];

    for (const Provider of providers) {
      try {
        const result = await new Provider().search(input.query);
        ctx.metrics.recordSuccess(Provider.name, duration);
        return result;
      } catch (error) {
        ctx.metrics.recordFailure(Provider.name, error);
        continue;
      }
    }
    throw new Error('All search providers failed');
  }
});
```

**Why:** Resilience for external API dependencies, cost optimization (try cheaper first).

---

### 8. Tool Result Streaming (Artifacts Pattern)

**Current:** Tools return complete results after execution

**Improvement:** Stream partial results for long-running tools

```typescript
// FUTURE: Streaming tool results
const generateContentTool = tool({
  execute: async (input, ctx) => {
    // Stream progress updates
    ctx.stream.update({ phase: 'analyzing', progress: 0.2 });
    const analysis = await analyzeContent(input);

    ctx.stream.update({ phase: 'generating', progress: 0.5 });
    const draft = await generateDraft(analysis);

    ctx.stream.update({ phase: 'refining', progress: 0.8 });
    const final = await refineDraft(draft);

    ctx.stream.complete(final);
    return final;
  }
});
```

**Why:** Better UX for slow operations, enables progress indicators.

---

### Summary: What We Could Adopt

| Pattern | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Metadata-aware extraction | Low | Medium | High (we already have schemas) |
| Tool caching decorator | Medium | High | Medium |
| Observable metrics | Medium | Medium | Medium |
| Typed generic context | Medium | Medium | Low |
| Input/output guardrails | Medium | High | Low (after stability) |
| Memory scopes | High | Medium | Low |
| Provider fallback | Medium | Medium | Low |
| Tool result streaming | High | Medium | Low |

**Recommendation:** After completing the main refactor, prioritize:
1. **Metadata-aware extraction** - Low effort, we already have the data
2. **Tool caching decorator** - High impact for performance
3. **Observable metrics** - Enables data-driven optimization

---

## Implementation Quality Improvements

Based on deep analysis of midday-ai/ai-sdk-tools source code and comparing with our current implementation, these are **concrete code/algorithm improvements** we should incorporate into the main refactor (not future work).

### 1. Memory: Hash Map Indexing for O(1) Entity Lookups

**Current (O(n)):** `WorkingContext` uses array filtering for entity deduplication

```typescript
// CURRENT: server/services/working-memory/working-context.ts
add(entity: Entity): void {
  this.entities = this.entities.filter(e => e.id !== entity.id);  // O(n) scan
  this.entities.unshift(entity);
  // ...
}
```

**Improvement (O(1)):** Use Map for indexed access

```typescript
// IMPROVED: memory/working-context/working-context.ts
export class WorkingContext {
  private entitiesById: Map<string, Entity> = new Map();  // O(1) lookup
  private entityOrder: string[] = [];  // Maintains recency order

  add(entity: Entity): void {
    // O(1) check and update
    if (this.entitiesById.has(entity.id)) {
      // Remove from order array (still O(n) but happens less often)
      this.entityOrder = this.entityOrder.filter(id => id !== entity.id);
    }

    this.entitiesById.set(entity.id, entity);
    this.entityOrder.unshift(entity.id);

    // Trim excess
    while (this.entityOrder.length > MAX_ENTITIES) {
      const removed = this.entityOrder.pop()!;
      this.entitiesById.delete(removed);
    }
  }

  getById(id: string): Entity | undefined {
    return this.entitiesById.get(id);  // O(1)
  }

  getAll(): Entity[] {
    return this.entityOrder.map(id => this.entitiesById.get(id)!);
  }
}
```

**Why:** With 10-20 entities it's negligible, but this pattern is correct for any sliding window.

---

### 2. Tool Search State: Immutable with Structural Sharing

**Current:** Module-level mutable variables

```typescript
// CURRENT: server/agents/main-agent.ts
let persistedDiscoveredTools: string[] = [];
let currentBaseSystemPrompt: string = "";
```

**Improvement:** Immutable state with efficient updates (already in plan, but add structural sharing)

```typescript
// IMPROVED: memory/tool-search/tool-search-state.ts
export class ToolSearchState {
  private readonly data: Readonly<ToolSearchStateData>;

  private constructor(data: ToolSearchStateData) {
    // Freeze deeply for true immutability
    this.data = Object.freeze({
      ...data,
      persistedTools: Object.freeze([...data.persistedTools]),
      currentTools: Object.freeze([...data.currentTools]),
    });
  }

  withFoundTools(newTools: string[]): ToolSearchState {
    // Structural sharing: only create new array if tools actually changed
    const existingSet = new Set(this.data.currentTools);
    const actuallyNew = newTools.filter(t => !existingSet.has(t));

    if (actuallyNew.length === 0) {
      return this;  // No change, return same instance (referential equality)
    }

    return new ToolSearchState({
      ...this.data,
      currentTools: [...this.data.currentTools, ...actuallyNew],
    });
  }
}
```

**Why:** Enables cheap equality checks (`state1 === state2`) and prevents unnecessary re-renders/recomputation.

---

### 3. Event Emitter: Batched Updates with Throttling

**Current:** Every SSE event fires immediately

```typescript
// CURRENT: Direct writeSSE calls scattered
writeSSE("tool-call", { ... });
writeSSE("tool-result", { ... });
```

**Improvement:** Batched event emission with configurable throttling

```typescript
// IMPROVED: events/event-emitter.ts
export class SSEEventEmitter {
  private readonly writeSSE: WriteSSEFn;
  private readonly history: EmittedEvent[] = [];
  private pendingEvents: EmittedEvent[] = [];
  private flushScheduled = false;
  private readonly throttleMs: number;

  constructor(writeSSE: WriteSSEFn, traceId: string, options?: { throttleMs?: number }) {
    this.writeSSE = writeSSE;
    this.throttleMs = options?.throttleMs ?? 0;  // 0 = immediate
  }

  emit<T extends EventType>(type: T, payload: EventPayloadWithoutMeta<T>): void {
    const event = this.createEvent(type, payload);
    this.history.push(event);

    if (this.throttleMs === 0) {
      this.writeSSE(type, event.payload);
      return;
    }

    // Batch for throttled emission
    this.pendingEvents.push(event);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;

    this.flushScheduled = true;
    setTimeout(() => {
      this.flush();
      this.flushScheduled = false;
    }, this.throttleMs);
  }

  private flush(): void {
    // Batch multiple events of same type
    const batched = this.batchEvents(this.pendingEvents);
    for (const event of batched) {
      this.writeSSE(event.type, event.payload);
    }
    this.pendingEvents = [];
  }

  // High-frequency events (text-delta) benefit from batching
  private batchEvents(events: EmittedEvent[]): EmittedEvent[] {
    const result: EmittedEvent[] = [];
    let textDeltaBuffer = '';

    for (const event of events) {
      if (event.type === 'text-delta') {
        textDeltaBuffer += (event.payload as TextDeltaEvent).delta;
      } else {
        if (textDeltaBuffer) {
          result.push(this.createEvent('text-delta', { delta: textDeltaBuffer }));
          textDeltaBuffer = '';
        }
        result.push(event);
      }
    }

    if (textDeltaBuffer) {
      result.push(this.createEvent('text-delta', { delta: textDeltaBuffer }));
    }

    return result;
  }
}
```

**Why:** Reduces client-side render thrashing during high-frequency tool execution. The devtools package uses this pattern.

---

### 4. Context Manager: Dependency-Aware Selectors

**Current:** Context formatting recomputes on every call

```typescript
// CURRENT: WorkingContext.toContextString() always rebuilds
toContextString(): string {
  const lines: string[] = [];
  // Always iterates and builds from scratch
}
```

**Improvement:** Memoized selectors with dependency tracking

```typescript
// IMPROVED: memory/working-context/working-context.ts
export class WorkingContext {
  private entitiesById: Map<string, Entity> = new Map();
  private _version = 0;  // Increments on every mutation
  private _cachedContextString: { version: number; value: string } | null = null;

  add(entity: Entity): void {
    // ... mutation logic
    this._version++;  // Invalidate cache
  }

  toContextString(): string {
    // Return cached if still valid
    if (this._cachedContextString?.version === this._version) {
      return this._cachedContextString.value;
    }

    // Recompute
    const value = this.computeContextString();
    this._cachedContextString = { version: this._version, value };
    return value;
  }

  private computeContextString(): string {
    // ... expensive computation
  }
}
```

**Why:** `toContextString()` is called multiple times per request (debug panel, system prompt injection). Caching prevents redundant work.

---

### 5. Tool Registry: Lazy Loading with Preload Hint

**Current:** All tool metadata loaded eagerly or on-demand

**Improvement:** Lazy loading with background preload for frequently used tools

```typescript
// IMPROVED: tools/_registry/tool-registry.ts
export class ToolRegistry {
  private cache: Map<string, ToolMetadata> = new Map();
  private loadingPromises: Map<string, Promise<ToolMetadata | null>> = new Map();
  private static CORE_TOOLS = ['searchTools', 'finalAnswer', 'acknowledgeRequest'];

  async initialize(): Promise<void> {
    // Preload core tools in parallel (always needed)
    await Promise.all(
      ToolRegistry.CORE_TOOLS.map(name => this.getMetadata(name))
    );
  }

  async getMetadata(toolName: string): Promise<ToolMetadata | null> {
    // Return from cache
    if (this.cache.has(toolName)) {
      return this.cache.get(toolName)!;
    }

    // Deduplicate concurrent loads (prevents race condition)
    if (this.loadingPromises.has(toolName)) {
      return this.loadingPromises.get(toolName)!;
    }

    // Load with deduplication
    const loadPromise = this.loadMetadata(toolName);
    this.loadingPromises.set(toolName, loadPromise);

    const result = await loadPromise;
    this.loadingPromises.delete(toolName);

    if (result) {
      this.cache.set(toolName, result);
    }

    return result;
  }

  // Background preload related tools when one is accessed
  preloadRelated(toolName: string): void {
    const metadata = this.cache.get(toolName);
    if (!metadata?.relatedTools) return;

    // Fire and forget - don't await
    for (const related of metadata.relatedTools) {
      if (!this.cache.has(related)) {
        this.getMetadata(related).catch(() => {});  // Swallow errors
      }
    }
  }
}
```

**Why:** Prevents duplicate loading when multiple concurrent requests ask for same tool. Preloading related tools reduces latency for common workflows.

---

### 6. Prompt Builder: Template Caching with Hot Reload

**Current:** Templates loaded from disk on every request

```typescript
// CURRENT: server/agents/system-prompt.ts
export function getAgentSystemPrompt(...) {
  const template = fs.readFileSync(templatePath, 'utf8');  // I/O every time
  return Handlebars.compile(template)({ ... });
}
```

**Improvement:** Compile once, cache compiled template

```typescript
// IMPROVED: prompts/builder/template-loader.ts
export class TemplateLoader {
  private compiledCache: Map<string, HandlebarsTemplateDelegate> = new Map();
  private mtimeCache: Map<string, number> = new Map();
  private readonly isDev: boolean;

  constructor() {
    this.isDev = process.env.NODE_ENV !== 'production';
  }

  load(templateName: string): HandlebarsTemplateDelegate {
    const templatePath = this.resolvePath(templateName);

    // Dev mode: check file modification time for hot reload
    if (this.isDev) {
      const currentMtime = fs.statSync(templatePath).mtimeMs;
      const cachedMtime = this.mtimeCache.get(templatePath);

      if (cachedMtime !== currentMtime) {
        this.compiledCache.delete(templatePath);
        this.mtimeCache.set(templatePath, currentMtime);
      }
    }

    // Return cached compiled template
    if (this.compiledCache.has(templatePath)) {
      return this.compiledCache.get(templatePath)!;
    }

    // Compile and cache
    const source = fs.readFileSync(templatePath, 'utf8');
    const compiled = Handlebars.compile(source);
    this.compiledCache.set(templatePath, compiled);

    return compiled;
  }
}
```

**Why:** Template compilation is expensive. In production, compile once. In dev, only recompile when file changes (hot reload).

---

### 7. Stream Processor: Result Collector with Typed Accumulation

**Current:** Stream processing uses multiple mutable arrays

```typescript
// CURRENT: orchestrator.ts processStream
const toolCalls: ToolCall[] = [];
const toolResults: ToolResult[] = [];
const displayTexts: string[] = [];
// ... mutation throughout
```

**Improvement:** Type-safe result collector with fluent API

```typescript
// IMPROVED: execution/result-collector.ts
export class ResultCollector {
  private readonly toolCalls: Map<string, ToolCall> = new Map();
  private readonly toolResults: Map<string, ToolResult> = new Map();
  private textBuffer: string[] = [];
  private _finishReason: string | null = null;
  private _usage: TokenUsage | null = null;

  addToolCall(call: ToolCall): this {
    this.toolCalls.set(call.toolCallId, call);
    return this;
  }

  addToolResult(result: ToolResult): this {
    this.toolResults.set(result.toolCallId, result);
    return this;
  }

  appendText(delta: string): this {
    this.textBuffer.push(delta);
    return this;
  }

  setFinish(reason: string, usage: TokenUsage): this {
    this._finishReason = reason;
    this._usage = usage;
    return this;
  }

  // Immutable result snapshot
  getResults(): StreamProcessResult {
    return Object.freeze({
      toolCalls: Array.from(this.toolCalls.values()),
      toolResults: Array.from(this.toolResults.values()),
      finalText: this.textBuffer.join(''),
      finishReason: this._finishReason ?? 'unknown',
      usage: this._usage ?? { inputTokens: 0, outputTokens: 0 },
    });
  }

  // Query methods
  getToolResult(callId: string): ToolResult | undefined {
    return this.toolResults.get(callId);
  }

  hasToolCall(name: string): boolean {
    return Array.from(this.toolCalls.values()).some(c => c.toolName === name);
  }
}
```

**Why:** Encapsulates stream result accumulation with type safety. Map-based storage enables O(1) lookups by callId.

---

### 8. Entity Extractor: Schema-Driven with Fallback

**Current:** Heuristic-based extraction ignores metadata schemas

```typescript
// CURRENT: entity-extractor.ts
extract(toolName: string, result: unknown): Entity[] {
  // Uses inferType() heuristics instead of metadata.extraction
}
```

**Improvement:** Use metadata schema first, fall back to heuristics

```typescript
// IMPROVED: memory/working-context/entity-extractor.ts
export class EntityExtractor {
  constructor(private registry: ToolRegistry) {}

  async extract(toolName: string, result: unknown): Promise<Entity[]> {
    // Try schema-based extraction first
    const metadata = await this.registry.getMetadata(toolName);

    if (metadata?.extraction) {
      const entities = this.extractBySchema(result, metadata.extraction);
      if (entities.length > 0) return entities;
    }

    // Fall back to heuristics for tools without schemas
    return this.extractByHeuristics(toolName, result);
  }

  private extractBySchema(result: unknown, schema: ExtractionSchema): Entity[] {
    const entities: Entity[] = [];

    // Navigate to data path
    const data = this.getPath(result, schema.path);
    if (!data) return [];

    // Extract single or array
    const items = schema.isArray ? (Array.isArray(data) ? data : []) : [data];

    for (const item of items.slice(0, 5)) {
      if (!isObject(item)) continue;

      const id = item[schema.idField || 'id'];
      const name = item[schema.nameField];

      if (typeof id === 'string' && typeof name === 'string') {
        entities.push({
          type: schema.type,
          id,
          name,
          timestamp: new Date(),
        });
      }
    }

    return entities;
  }

  private getPath(obj: unknown, path: string): unknown {
    if (path === '$root') return obj;

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (!isObject(current)) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private extractByHeuristics(toolName: string, result: unknown): Entity[] {
    // ... existing heuristic logic as fallback
  }
}
```

**Why:** We already define `extraction` schemas in every tool metadata but ignore them. This makes extraction deterministic and self-documenting.

---

### Summary: Improvements to Incorporate in Main Refactor

| Component | Current | Improved | Complexity |
|-----------|---------|----------|------------|
| WorkingContext entity lookup | O(n) array filter | O(1) Map-based | Low |
| ToolSearchState | Mutable module vars | Immutable with structural sharing | Low |
| SSEEventEmitter | Immediate fire | Optional batching/throttling | Medium |
| WorkingContext.toContextString | Always recompute | Version-based memoization | Low |
| ToolRegistry loading | Simple async | Deduplicated + preload related | Low |
| TemplateLoader | Read from disk every time | Compiled cache + hot reload | Low |
| Stream processing | Mutable arrays | ResultCollector class | Low |
| EntityExtractor | Heuristics only | Schema-first + heuristic fallback | Medium |

**These improvements should be incorporated into Sprint 1-3 of the main refactor**, not deferred to "future work". They're not new features—they're better implementations of the same functionality.

---

## Low-Hanging Fruit: Text Delta Chunking

### Problem: Per-Character Re-renders

Currently, every single text delta from the LLM triggers the full chain:

```
Server: writeSSE("text-delta", { delta: "H" })  // Single character
Server: writeSSE("text-delta", { delta: "e" })
Server: writeSSE("text-delta", { delta: "l" })
Server: writeSSE("text-delta", { delta: "l" })
Server: writeSSE("text-delta", { delta: "o" })
...
```

Each delta causes:
1. **Server**: SSE write over network
2. **Client**: EventSource message parse
3. **Zustand**: `appendToStreamingMessage(delta)` → new state object
4. **React**: Component re-render

For a 500-character response, that's **500 re-renders**.

### Solution: Server-Side Chunking

Buffer text deltas and flush in chunks (by size or time):

```typescript
// IMPROVED: execution/stream-processor.ts
class TextDeltaBuffer {
  private buffer: string = '';
  private lastFlush: number = Date.now();
  private flushTimeout: NodeJS.Timeout | null = null;

  private readonly minChunkSize: number;
  private readonly maxDelayMs: number;
  private readonly onFlush: (chunk: string) => void;

  constructor(options: {
    minChunkSize?: number;  // Minimum chars before flush (default: 20)
    maxDelayMs?: number;    // Max ms to hold buffer (default: 50)
    onFlush: (chunk: string) => void;
  }) {
    this.minChunkSize = options.minChunkSize ?? 20;
    this.maxDelayMs = options.maxDelayMs ?? 50;
    this.onFlush = options.onFlush;
  }

  append(text: string): void {
    this.buffer += text;

    // Flush immediately if buffer is large enough
    if (this.buffer.length >= this.minChunkSize) {
      this.flush();
      return;
    }

    // Schedule delayed flush if not already scheduled
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), this.maxDelayMs);
    }
  }

  flush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    if (this.buffer.length > 0) {
      this.onFlush(this.buffer);
      this.buffer = '';
      this.lastFlush = Date.now();
    }
  }

  // Call when stream ends to flush remaining
  end(): void {
    this.flush();
  }
}
```

### Usage in Stream Processor

```typescript
// execution/stream-processor.ts
async process(streamResult: AgentStreamResult, ...): Promise<StreamProcessResult> {
  const textBuffer = new TextDeltaBuffer({
    minChunkSize: 20,   // ~4-5 words
    maxDelayMs: 50,     // 50ms max latency
    onFlush: (chunk) => {
      this.eventEmitter.emit('text-delta', {
        messageId: currentMessageId,
        delta: chunk,
      });
    }
  });

  for await (const chunk of streamResult.fullStream) {
    switch (chunk.type) {
      case "text-delta":
        textBuffer.append(chunk.text);  // Buffer instead of emit
        finalText += chunk.text;
        break;

      case "tool-call":
        textBuffer.flush();  // Flush before tool execution
        // ... handle tool call
        break;

      // ... other cases
    }
  }

  textBuffer.end();  // Flush remaining
  return collector.getResults();
}
```

### Impact

| Metric | Before | After (20 char chunks) |
|--------|--------|------------------------|
| 500-char response | 500 SSE events | ~25 SSE events |
| React re-renders | 500 | ~25 |
| Network overhead | 500 × ~100 bytes | 25 × ~120 bytes |
| Perceived latency | Same | Same (50ms max buffer) |

### Frontend Optimization (Optional)

The frontend can also batch state updates using `requestAnimationFrame`:

```typescript
// app/assistant/_stores/chat-store.ts
let pendingDelta = '';
let rafId: number | null = null;

appendToStreamingMessage: (delta) => {
  pendingDelta += delta;

  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      set((state) => ({
        streamingMessage: state.streamingMessage
          ? { ...state.streamingMessage, content: state.streamingMessage.content + pendingDelta }
          : { id: crypto.randomUUID(), content: pendingDelta }
      }));
      pendingDelta = '';
      rafId = null;
    });
  }
}
```

This ensures at most **60 re-renders per second** regardless of delta frequency.

### Recommendation

1. **Server-side chunking** (in `stream-processor.ts`) - Primary fix, 20x reduction
2. **Client-side RAF batching** (in `chat-store.ts`) - Secondary, caps at 60fps

Both are low-complexity, high-impact changes that should be included in **Sprint 3** when we build the new `StreamProcessor`.

---

## Frontend Improvements

Based on analysis of the frontend code, here are additional low-hanging optimizations:

### 1. Trace Store: O(n) Entry Lookups → O(1) with Index

**Current:** `updateEntry` and `completeEntry` scan all traces to find an entry

```typescript
// CURRENT: trace-store.ts
updateEntry: (id, updates) => {
  for (const traceId of Object.keys(state.entriesByTrace)) {
    const entries = state.entriesByTrace[traceId];
    const index = entries.findIndex((e) => e.id === id);  // O(n) per trace
    if (index !== -1) { ... }
  }
}
```

**Improvement:** Maintain an index map

```typescript
// IMPROVED: trace-store.ts
interface TraceState {
  entriesByTrace: Record<string, TraceEntry[]>;
  entryIndex: Map<string, { traceId: string; index: number }>;  // NEW
  // ...
}

addEntry: (entry) => {
  // ... existing logic
  // Add to index
  newEntryIndex.set(fullEntry.id, {
    traceId: fullEntry.traceId,
    index: newEntries.length - 1
  });
}

updateEntry: (id, updates) => {
  const location = state.entryIndex.get(id);  // O(1)
  if (!location) return state;

  const entries = state.entriesByTrace[location.traceId];
  const updatedEntries = [...entries];
  updatedEntries[location.index] = { ...updatedEntries[location.index], ...updates };
  // ...
}
```

**Impact:** With 100+ trace entries per conversation, this is significant.

---

### 2. Chat Store: Selector Granularity

**Current:** `useAgent` subscribes to multiple store slices individually

```typescript
// CURRENT: use-agent.ts
const messages = useChatStore((state) => state.messages);
const sessionId = useChatStore((state) => state.sessionId);
const streamingMessage = useChatStore((state) => state.streamingMessage);
const addMessage = useChatStore((state) => state.addMessage);
// ... 8 more selectors
```

Each selector creates a separate subscription. When any slice changes, each selector runs.

**Improvement:** Combine related selectors with shallow equality

```typescript
// IMPROVED: use-agent.ts
import { shallow } from 'zustand/shallow';

// Group related state
const { messages, sessionId, streamingMessage } = useChatStore(
  (state) => ({
    messages: state.messages,
    sessionId: state.sessionId,
    streamingMessage: state.streamingMessage,
  }),
  shallow  // Only re-render if actual values changed
);

// Actions don't need reactivity - get once
const actions = useChatStore.getState();
const { addMessage, setIsStreaming } = actions;
```

**Impact:** Reduces subscription overhead and prevents cascading re-renders.

---

### 3. MessageList: Virtualization for Long Histories

**Current:** All messages rendered

```typescript
// CURRENT: chat-pane.tsx
{messages.map((message) => (
  <Message from={message.role} key={message.id}>
    <MessageContent>
      <Response>{message.content}</Response>
    </MessageContent>
  </Message>
))}
```

**Improvement:** Virtualize when message count exceeds threshold

```typescript
// IMPROVED: chat-pane.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function MessageList({ messages, streamingMessage }) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Only virtualize if many messages
  const shouldVirtualize = messages.length > 50;

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,  // Estimated message height
    enabled: shouldVirtualize,
  });

  if (!shouldVirtualize) {
    // Render normally for short lists
    return <>{messages.map(m => <MessageItem key={m.id} message={m} />)}</>;
  }

  return (
    <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={messages[virtualItem.index].id}
            style={{
              position: 'absolute',
              top: virtualItem.start,
              width: '100%',
            }}
          >
            <MessageItem message={messages[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Impact:** Sessions with 100+ messages become smooth instead of janky.

---

### 4. Trace Timeline: Defer Non-Visible Entries

**Current:** All trace entries rendered and filtered in React

```typescript
// CURRENT: trace-store.ts
const filteredEntries = applyFilters(activeTraceEntries, filters);
// All 200+ entries processed
```

**Improvement:** Paginate/lazy-load entries in the timeline

```typescript
// IMPROVED: Enhanced debug panel
const VISIBLE_ENTRIES = 50;
const [visibleCount, setVisibleCount] = useState(VISIBLE_ENTRIES);

// Only filter visible entries
const visibleEntries = useMemo(() => {
  const filtered = applyFilters(activeTraceEntries, filters);
  return filtered.slice(0, visibleCount);
}, [activeTraceEntries, filters, visibleCount]);

// Load more on scroll
const loadMore = useCallback(() => {
  setVisibleCount(prev => Math.min(prev + 50, filteredEntries.length));
}, [filteredEntries.length]);
```

**Impact:** Debug panel stays responsive even with 500+ trace events.

---

### 5. JSON Viewer: Lazy Expansion

**Current:** `json-viewer.tsx` likely renders full JSON tree

**Improvement:** Only render expanded nodes

```typescript
// IMPROVED: json-viewer.tsx
function JsonNode({ data, path, expandedPaths }) {
  const isExpanded = expandedPaths.has(path);

  if (!isExpanded && typeof data === 'object') {
    // Collapsed: show preview only
    const preview = Array.isArray(data)
      ? `Array(${data.length})`
      : `Object(${Object.keys(data).length})`;
    return <span onClick={() => expand(path)}>{preview}</span>;
  }

  // Expanded: render children
  return (
    <div>
      {Object.entries(data).map(([key, value]) => (
        <JsonNode
          key={key}
          data={value}
          path={`${path}.${key}`}
          expandedPaths={expandedPaths}
        />
      ))}
    </div>
  );
}
```

**Impact:** Large tool results (images, pages) don't freeze the debug panel.

---

### 6. Event Processing: Batch Trace Updates

**Current:** Each SSE event immediately updates trace store

```typescript
// CURRENT: use-agent.ts processSSEEvent
traceRef.current?.toolCall(d.toolName as string, d.args, callId);
// This calls trace store update immediately
```

**Improvement:** Batch trace updates during high-frequency events

```typescript
// IMPROVED: debug-logger or trace-store
class BatchedTraceLogger {
  private pendingEntries: TraceEntry[] = [];
  private flushScheduled = false;

  addEntry(entry: Omit<TraceEntry, 'id'>): void {
    this.pendingEntries.push({ ...entry, id: crypto.randomUUID() });
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;

    // Batch updates in next microtask
    queueMicrotask(() => {
      const entries = this.pendingEntries;
      this.pendingEntries = [];
      this.flushScheduled = false;

      // Single store update for all entries
      useTraceStore.getState().addEntries(entries);
    });
  }
}
```

**Impact:** During tool execution bursts, reduces store updates from N to 1.

---

### 7. Memoize Expensive Computations

**Current:** `getMetrics()` and `getTotalMetrics()` recompute on every call

```typescript
// CURRENT: trace-store.ts
getMetrics: () => {
  const entries = state.entriesByTrace[state.activeTraceId || ""] || [];
  // Iterates all entries every time
  for (const entry of entries) { ... }
}
```

**Improvement:** Cache with version tracking (same pattern as server-side)

```typescript
// IMPROVED: trace-store.ts
interface TraceState {
  // ...
  _metricsVersion: number;
  _cachedMetrics: { version: number; value: TraceMetrics } | null;
}

getMetrics: () => {
  const state = get();
  if (state._cachedMetrics?.version === state._metricsVersion) {
    return state._cachedMetrics.value;
  }

  // Compute
  const metrics = computeMetrics(state);
  set({ _cachedMetrics: { version: state._metricsVersion, value: metrics } });
  return metrics;
}

// Increment version on entry mutations
addEntry: (entry) => {
  // ...
  return { ..., _metricsVersion: state._metricsVersion + 1 };
}
```

---

### Summary: Frontend Improvements

| Component | Current | Improved | Impact |
|-----------|---------|----------|--------|
| Trace entry lookup | O(n) scan | O(1) index map | High (100+ entries) |
| Store selectors | 10+ individual | Grouped with shallow | Medium |
| Message list | Render all | Virtualize >50 | High (long sessions) |
| Trace timeline | Render all | Paginate/lazy | Medium |
| JSON viewer | Full tree | Lazy expansion | Medium |
| Trace updates | Per-event | Batched microtask | Medium |
| Metrics computation | Every call | Version-cached | Low |

### Priority

1. **Server-side text chunking** (already in plan) - Highest impact
2. **Client-side RAF batching** (already in plan) - High impact
3. **Trace entry index** - Medium effort, high impact
4. **Message virtualization** - Medium effort, high impact for long sessions
5. **Batched trace updates** - Low effort, medium impact
