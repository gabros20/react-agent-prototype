# Unified ReAct Agent Refactor Plan

## Problem Analysis

### Current Issues
1. **4 separate modes** (architect, cms-crud, debug, ask) with different prompts → Complexity
2. **Mode-specific behavior** → Agent doesn't autonomously decide what to do
3. **Large prompts** (180-220 lines per mode) → Token waste
4. **No true recursive thinking** → Agent asks questions instead of acting

### Current Architecture
```
User Request → Mode Selection → Mode-Specific Prompt → Tool Loop → Response
                    ↓
              architect.xml (184 lines)
              cms-crud.xml (219 lines)  
              debug.xml (193 lines)
              ask.xml (178 lines)
```

## Target Architecture: Unified ReAct Agent

Based on the v0 pattern and best practices from your resources, we want:

```
User Request → Unified ReAct Prompt → Think-Act-Observe Loop (recursive) → Final Answer
```

### Key Principles from Resources

1. **ReAct Pattern** (Thought → Action → Observation → Repeat)
   - Explicit step-by-step reasoning
   - Tool selection based on thinking
   - Observation integration into next thought
   - Loop until final answer

2. **Chain of Thought WITHOUT Thinking Model**
   - "Explain your reasoning step-by-step"
   - Break down complex tasks
   - Show intermediate steps
   - Self-correction through reflection

3. **Recursive Loop Control**
   - `stopWhen: stepCountIs(maxSteps)` for iteration limit
   - Final Answer detection
   - Token budget limits
   - Reasonable retry limits

4. **Prompt Optimization**
   - Minimal instructions (150-200 tokens vs 30K)
   - Clear format definition
   - 1-2 few-shot examples
   - Tool descriptions with schemas

## Implementation Plan

### Phase 1: Create Unified System Prompt

**File:** `server/prompts/unified-react.xml`

```xml
<agent>
You are an autonomous AI assistant using the ReAct (Reasoning and Acting) pattern.

**CORE LOOP:**
For each user request, follow this loop until you have a final answer:

Thought: Explain your reasoning step-by-step about what to do next
Action: Execute ONE tool from available tools with JSON input
Observation: [Tool result will appear here]
... (repeat Thought/Action/Observation N times)
Thought: I now have enough information
Final Answer: [Your conclusive response]

**CRITICAL RULES:**
1. THINK before acting - explain your reasoning
2. EXECUTE immediately - don't ask for permission unless tool requires approval
3. CHAIN multiple steps - complete tasks in one conversation turn
4. OBSERVE results - integrate tool outputs into next thought
5. RECURSE - continue thinking and acting until task is complete

**Example Session:**

User: "Add a hero section to the about page with dummy content"

Thought: I need to find the about page first, then find the hero section definition, add it, get its schema, and populate with content.
Action: cms.findResource
Action Input: {"query": "about", "resourceType": "page"}
Observation: Found page-abc123 (slug: about-us)

Thought: Now I need to find the hero section definition
Action: cms.findResource  
Action Input: {"query": "hero", "resourceType": "section"}
Observation: Found section-def456 (key: hero)

Thought: Add the section to the page
Action: cms.addSectionToPage
Action Input: {"pageId": "page-abc123", "sectionDefId": "section-def456"}
Observation: Created pageSection-789 successfully

Thought: Get the schema to see what fields are needed
Action: cms.getSectionDef
Action Input: {"id": "section-def456"}
Observation: Schema: {title: string, subtitle: string, ctaText: string, image: string}

Thought: Now populate with dummy content
Action: cms.syncPageContent
Action Input: {"pageSectionId": "pageSection-789", "content": {"title": "Welcome", "subtitle": "Discover our story", "ctaText": "Learn More", "image": "/placeholder.jpg"}}
Observation: Content synced successfully

Thought: Task complete - hero section added and populated
Final Answer: ✅ Successfully added Hero section to About page with dummy content (title: "Welcome", subtitle: "Discover our story", CTA: "Learn More")

**Available Tools:** {{toolCount}} tools
{{toolsFormatted}}

**Session:** {{sessionId}}
**Date:** {{currentDate}}
</agent>
```

### Phase 2: Simplify Orchestrator

**Changes to `server/agent/orchestrator.ts`:**

1. **Remove MODE_CONFIG** - Single configuration for all requests
2. **Remove mode-based tool filtering** - All tools available always
3. **Unified model selection** - One capable model (GPT-4o-mini)
4. **Single prompt composition** - No mode branching

```typescript
// BEFORE (Multiple Modes)
const MODE_CONFIG: Record<AgentMode, { maxSteps: number; modelId: string }> = {
  architect: { maxSteps: 6, modelId: "openai/gpt-4o-mini" },
  "cms-crud": { maxSteps: 10, modelId: "openai/gpt-4o-mini" },
  debug: { maxSteps: 4, modelId: "openai/gpt-4o-mini" },
  ask: { maxSteps: 6, modelId: "openai/gpt-4o-mini" },
};

// AFTER (Unified)
const AGENT_CONFIG = {
  maxSteps: 15,  // Higher limit for complex multi-step tasks
  modelId: "openai/gpt-4o-mini",
  maxOutputTokens: 4096
};
```

### Phase 3: Remove Mode from Types

**Changes to `server/tools/types.ts`:**

```typescript
// REMOVE:
export type AgentMode = 'architect' | 'cms-crud' | 'debug' | 'ask'

// UPDATE AgentContext:
export interface AgentContext {
  db: Database
  vectorIndex: VectorIndex
  logger: Logger
  stream?: StreamWriter
  traceId: string
  sessionId: string
  // REMOVE: currentMode: AgentMode
  services: ServiceContainer
  sessionService: SessionService
  cmsTarget: {
    siteId: string
    environmentId: string
  }
}
```

### Phase 4: Simplify Routes

**Changes to `server/routes/agent.ts`:**

```typescript
// REMOVE mode from request schema
const agentRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  prompt: z.string().min(1),
  // REMOVE: mode: z.enum(['architect', 'cms-crud', 'debug', 'ask']),
  toolsEnabled: z.array(z.string()).optional(),
  cmsTarget: z.object({
    siteId: z.string().optional(),
    environmentId: z.string().optional()
  }).optional()
})

// Simplified agent creation
const agent = createAgent(context)  // No mode parameter
```

### Phase 5: Tool Availability

**Keep ALL tools available at all times:**

```typescript
// In server/tools/all-tools.ts
export const ALL_TOOLS = {
  // Pages (5 tools)
  'cms.getPage': cmsGetPage,
  'cms.createPage': cmsCreatePage,
  'cms.updatePage': cmsUpdatePage,
  'cms.deletePage': cmsDeletePage,
  'cms.listPages': cmsListPages,
  
  // Sections (4 tools)
  'cms.listSectionDefs': cmsListSectionDefs,
  'cms.getSectionDef': cmsGetSectionDef,
  'cms.addSectionToPage': cmsAddSectionToPage,
  'cms.syncPageContent': cmsSyncPageContent,
  
  // Search (2 tools)
  'search.vector': searchVector,
  'cms.findResource': cmsFindResource,
  
  // HTTP (2 tools)
  'http.get': httpGet,
  'http.post': httpPost,
  
  // Planning (1 tool)
  'plan.analyzeTask': planAnalyzeTask
}

// REMOVE: getToolsForMode() - No longer needed
```

### Phase 6: Update Frontend

**Changes to `app/assistant/page.tsx`:**

```typescript
// REMOVE mode selector
// BEFORE:
const [mode, setMode] = useState<AgentMode>('cms-crud')

// AFTER:
// No mode state needed
```

**Changes to `app/assistant/_hooks/use-agent.ts`:**

```typescript
// REMOVE mode parameter
// BEFORE:
export function useAgent(mode: AgentMode = 'cms-crud') {
  // ...
}

// AFTER:
export function useAgent() {
  // ...
}
```

## Benefits of Unified Architecture

### 1. Simplicity
- **Before:** 4 modes × 180-220 lines = 800+ lines of prompts
- **After:** 1 prompt × ~150 lines = 150 lines
- **Reduction:** 81% less prompt code

### 2. Token Efficiency
- **Before:** ~30,000 tokens per request (massive prompts)
- **After:** ~1,000 tokens per request (minimal ReAct prompt)
- **Savings:** 97% token reduction

### 3. Autonomy
- **Before:** Mode determines behavior → Agent constrained
- **After:** Agent thinks and decides → True autonomy

### 4. Flexibility
- **Before:** "I need mode X for task Y" → Mental overhead
- **After:** "Just tell me what to do" → Natural interaction

### 5. Maintenance
- **Before:** Update 4 prompts when adding tool
- **After:** Update 1 prompt (or none if using dynamic tool list)

## Migration Strategy

### Step 1: Create New Files (No Breaking Changes)
- `server/prompts/unified-react.xml` (new prompt)
- `server/agent/orchestrator-unified.ts` (new orchestrator)
- `server/routes/agent-unified.ts` (new route)

### Step 2: Test in Parallel
- Keep old routes active at `/v1/agent/stream`
- New route at `/v1/agent/unified/stream`
- Compare behavior and performance

### Step 3: Switch Over
- Update frontend to use new endpoint
- Monitor for issues
- Keep old code as backup

### Step 4: Clean Up
- Delete old mode files
- Remove mode types
- Update documentation

## Testing Plan

### Test Cases

1. **Simple Task** (1-2 steps)
   - "What pages exist?"
   - Expected: List pages tool call → Result

2. **Medium Task** (3-5 steps)
   - "Add hero section to about page"
   - Expected: Find page → Find section → Add → Success

3. **Complex Task** (6-10 steps)
   - "Create a new 'Services' page with hero and features sections, populate with dummy content"
   - Expected: Create page → Find hero → Add hero → Get schema → Sync content → Find features → Add features → Get schema → Sync content → Success

4. **Recursive Thinking** (Multiple iterations)
   - "Analyze the home page structure and suggest improvements"
   - Expected: Get page → Analyze sections → Think → Suggest → Final Answer

5. **Error Recovery**
   - "Add 'nonexistent' section to home page"
   - Expected: Search → Not found → Think → Ask for clarification or suggest alternatives

### Success Criteria

- ✅ Agent completes tasks without asking unnecessary questions
- ✅ Agent chains multiple tool calls in one turn
- ✅ Agent shows reasoning in "Thought" steps
- ✅ Agent integrates observations into next thoughts
- ✅ Token usage < 5,000 per request (vs 30K before)
- ✅ Execution time < 10 seconds for simple tasks
- ✅ No TypeScript errors
- ✅ Approval flow still works for flagged tools

## Implementation Checklist

- [ ] Create `server/prompts/unified-react.xml`
- [ ] Create `server/agent/orchestrator-unified.ts`
- [ ] Create `server/routes/agent-unified.ts`
- [ ] Remove `AgentMode` type from `server/tools/types.ts`
- [ ] Update `ALL_TOOLS` to always export everything
- [ ] Remove `getToolsForMode()` function
- [ ] Update `server/index.ts` to mount new route
- [ ] Update frontend to remove mode selector
- [ ] Update `use-agent.ts` hook
- [ ] Test all 5 test cases
- [ ] Compare token usage (old vs new)
- [ ] Verify approval flow still works
- [ ] Delete old mode files
- [ ] Delete old orchestrator/routes
- [ ] Update documentation

## Expected Code Reduction

### Files to Delete
- `server/prompts/modes/architect.xml` (184 lines)
- `server/prompts/modes/cms-crud.xml` (219 lines)
- `server/prompts/modes/debug.xml` (193 lines)
- `server/prompts/modes/ask.xml` (178 lines)
- Total: **774 lines deleted**

### Files to Simplify
- `server/agent/orchestrator.ts` (420 → 250 lines, ~40% reduction)
- `server/routes/agent.ts` (280 → 200 lines, ~30% reduction)
- `server/tools/all-tools.ts` (Remove mode filtering, ~50 lines deleted)

### Net Result
- **~1,100 lines of code removed**
- **1 unified prompt (~150 lines) added**
- **Net reduction: ~950 lines (45% of agent codebase)**

## Next Steps

1. Review this plan - Does it align with your vision?
2. Start implementation - Create unified prompt first
3. Test incrementally - One phase at a time
4. Measure improvement - Token usage, speed, quality
5. Deploy unified agent - Replace mode-based system

## References

- [ReAct Pattern](https://www.promptingguide.ai/techniques/react)
- [Chain of Thought Prompting](https://learnprompting.org/docs/intermediate/chain_of_thought)
- [Vercel AI SDK Agents](https://ai-sdk.dev/docs/agents/workflows)
- [V0 Recursive Agent Pattern](https://v0.app/chat/recursive-ai-agent-lYgXY9TvvV3)
