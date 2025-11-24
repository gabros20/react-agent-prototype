# Agentic AI Patterns Library

**Version**: 1.0  
**Last Updated**: 2025-11-07  
**Research Period**: 2024-2025  
**Status**: Production-Ready Patterns

---

## Purpose

This document catalogs proven agentic AI design patterns from academic research and production systems (2024-2025). Each pattern includes problem statement, solution architecture, benefits, trade-offs, and implementation guidance. Designed for reuse across projects.

---

## Table of Contents

### I. Context & Memory Management

1. [Hierarchical Memory (Subgoal-Based)](#1-hierarchical-memory-subgoal-based)
2. [Sliding Window with Importance Scoring](#2-sliding-window-with-importance-scoring)
3. [KV-Cache Optimization](#3-kv-cache-optimization)

### II. Error Recovery & Resilience

4. [Error Classification & Recovery Hierarchy](#4-error-classification--recovery-hierarchy)
5. [Circuit Breaker Pattern](#5-circuit-breaker-pattern)
6. [Tool Result Validation](#6-tool-result-validation)

### III. Planning & Exploration

7. [Alternative Path Generation (Plan-and-Execute)](#7-alternative-path-generation-plan-and-execute)
8. [Preflight Validation](#8-preflight-validation)
9. [Reflection & Self-Critique (Reflexion)](#9-reflection--self-critique-reflexion)

### IV. Human-Agent Interaction

10. [Human-in-the-Loop (HITL) Approval Gates](#10-human-in-the-loop-hitl-approval-gates)
11. [Adaptive Proactivity](#11-adaptive-proactivity)

### V. Loop Control & State Management

12. [Loop State Machine](#12-loop-state-machine)
13. [Convergence Detection](#13-convergence-detection)
14. [State Persistence & Checkpointing](#14-state-persistence--checkpointing)

### VI. Tool & Agent Coordination

15. [Tool Registry with Metadata](#15-tool-registry-with-metadata)
16. [Mode-Based Tool Filtering](#16-mode-based-tool-filtering)
17. [Multi-Agent Orchestration](#17-multi-agent-orchestration)

---

## I. Context & Memory Management

### 1. Hierarchical Memory (Subgoal-Based)

**Category**: Context Management  
**Source**: HiAgent (2024) - _"Hierarchical Working Memory Management for Solving Long-Horizon Agent Tasks with Large Language Model"_  
**Research Finding**: 2x success rate, 3.8 fewer steps on long-horizon tasks

#### Problem

-   ReAct agents accumulate conversation history linearly
-   LLM context windows are finite (e.g., 128k tokens for Gemini 2.5)
-   At 80% capacity, accuracy drops 15-30% ("context rot" - Anthropic 2024)
-   Long tasks (50+ steps) exceed context limits → crashes or degraded performance

#### Solution

Three-layer memory hierarchy that compresses completed work into summaries:

1. **Working Memory** (short-term): Current subgoal context (5-10 messages, ~2k-5k tokens)
2. **Subgoal Memory** (medium-term): Compressed summaries of completed subgoals (~20 subgoals, 50-100 tokens each)
3. **Long-Term Memory** (persistent): Vector DB for cross-session facts

**Compression Trigger**:

-   Context reaches 70% of model limit (e.g., 90k tokens for 128k model)
-   Subgoal completion detected (agent says "✅ Done: [task]")
-   Phase transitions (planning → executing → verifying)

**What Gets Compressed**:

-   Intermediate reasoning steps (non-critical "Let me think...")
-   Redundant tool results (same tool called multiple times)
-   Low-importance messages (scored <0.3 on importance scale)

**What's Always Kept**:

-   System prompt
-   Last 3-5 messages (current context)
-   Subgoal summaries (compressed)
-   Error observations and key decisions

#### Benefits

-   ✅ Handles 100+ step conversations without degradation
-   ✅ 2x success rate on long-horizon tasks
-   ✅ 40% cost reduction (fewer tokens per API call)
-   ✅ Maintains coherence across multiple subgoals

#### Trade-offs

-   ⚠️ Adds 1-2 LLM calls per compression (for summarization)
-   ⚠️ Eventually consistent (compression happens after subgoal, not real-time)
-   ⚠️ Information loss on fine details (by design)

#### When to Use

-   Tasks requiring >20 steps
-   Workflows with multiple distinct phases
-   Applications with limited context windows
-   When cost optimization is important

#### Implementation Complexity

**Time**: 6-8 hours  
**Components**: Memory manager, LLM summarization, importance scoring, integration hooks

#### Key Metrics

-   Context utilization: Monitor tokens used / tokens available
-   Compression ratio: Original tokens / compressed tokens (target: 10:1)
-   Retrieval accuracy: Can agent recall key facts from compressed subgoals?

#### Code Reference

See `PLAN.md` Section 6.7 for full implementation with `HierarchicalMemoryManager` class.

---

### 2. Sliding Window with Importance Scoring

**Category**: Context Management  
**Source**: Industry best practices (Manus.im 2024)  
**Alternative to**: Hierarchical Memory (simpler, faster, less intelligent)

#### Problem

Same as Hierarchical Memory, but for scenarios where:

-   Subgoal detection is unreliable
-   Tasks don't have clear phase boundaries
-   Simpler implementation is preferred

#### Solution

Keep fixed-size context window, prune messages by importance score:

**Importance Factors** (0.0-1.0 scale):

-   Tool calls: +0.3
-   Error observations: +0.5
-   Goal statements: +0.4
-   Tool results: +0.2
-   Pure reasoning (no actions): +0.1
-   Very short messages (<50 chars): -0.2

**Pruning Strategy**:

1. Always keep: System prompt + last 5 messages
2. Score middle messages by importance
3. Keep top 50% important messages
4. Discard bottom 50%

#### Benefits

-   ✅ Simple to implement (no LLM calls for summarization)
-   ✅ Fast (just arithmetic scoring)
-   ✅ Predictable (deterministic pruning)

#### Trade-offs

-   ⚠️ Less intelligent than hierarchical (no semantic compression)
-   ⚠️ Can lose important context if not in top 50%
-   ⚠️ Doesn't preserve subgoal structure

#### When to Use

-   Short to medium tasks (10-30 steps)
-   When speed is critical (no summarization overhead)
-   When subgoals are unclear or don't exist
-   Prototyping phase before implementing hierarchical memory

#### Implementation Complexity

**Time**: 2-3 hours  
**Components**: Scoring function, pruning logic

---

### 3. KV-Cache Optimization

**Category**: Context Management (Performance)  
**Source**: Manus.im 2024 - _"Context Engineering for AI Agents"_  
**Finding**: 3x speed improvement, 60% cost reduction

#### Problem

-   LLMs re-process entire context on each call (expensive)
-   KV-cache can reuse computation for unchanged prefix
-   But: dynamic context breaks cache (cache miss → full recompute)

#### Solution

Structure prompts to maximize stable prefix:

**Stable Prefix** (rarely changes, fully cached):

```
System prompt → Tool definitions → Few-shot examples
```

**Variable Suffix** (changes per turn, not cached):

```
Conversation history → Current task → Observations
```

**Optimization**: Reconstruct messages to maximize prefix reuse even when conversation changes.

#### Benefits

-   ✅ 3x faster inference (cache hits)
-   ✅ 60% cost reduction
-   ✅ Lower latency for users

#### Trade-offs

-   ⚠️ Provider-dependent (OpenAI, Anthropic support this; some don't)
-   ⚠️ Requires careful prompt engineering
-   ⚠️ Benefits diminish if prefix changes frequently

#### When to Use

-   High-throughput applications (many users)
-   Cost-sensitive deployments
-   When using providers with KV-cache support

#### Implementation Complexity

**Time**: 1-2 hours  
**Components**: Prompt restructuring

---

## II. Error Recovery & Resilience

### 4. Error Classification & Recovery Hierarchy

**Category**: Error Recovery  
**Source**: SuperAGI 2024 - _"Self-Healing AI Agents"_, raia.ai patterns  
**Research Finding**: 40% reduction in dead-end failures

#### Problem

-   Agents treat all errors the same (generic retry)
-   Different error types need different recovery strategies
-   Transient errors (network timeout) vs permanent errors (logic bug)
-   Wastes retries on unrecoverable errors

#### Solution

Classify errors by type, apply appropriate recovery strategy:

**Error Types**:

1. **Transient**: Network timeout, DB lock → Retry with exponential backoff
2. **Validation**: Slug conflict, constraint violation → Fix input & retry
3. **Not Found**: Resource missing → Fallback to alternative (e.g., create instead of update)
4. **Permission**: User denied, HITL rejection → Escalate immediately
5. **Permanent**: Logic error, impossible request → Escalate immediately

**Recovery Strategies**:

```typescript
transient: [retry 1s, retry 2s, retry 4s, escalate]
validation: [retry with fix, escalate]
not_found: [fallback to alternative tool, escalate]
permission: [escalate immediately]
permanent: [escalate immediately]
```

#### Benefits

-   ✅ 40% fewer dead-end failures
-   ✅ Faster recovery (no wasted retries on permanent errors)
-   ✅ Better UX (user only interrupted when necessary)
-   ✅ Actionable error messages

#### Trade-offs

-   ⚠️ Requires error classification logic (pattern matching or LLM)
-   ⚠️ Some errors hard to classify (ambiguous)

#### When to Use

-   Production systems (where reliability matters)
-   Multi-step workflows (where one failure blocks progress)
-   User-facing agents (where errors impact experience)

#### Implementation Complexity

**Time**: 3-4 hours  
**Components**: Error classifier, recovery strategy map, execution wrapper

#### Code Reference

See `PLAN.md` Section 6.9 for full implementation with `classifyError()` and recovery strategies.

---

### 5. Circuit Breaker Pattern

**Category**: Error Recovery (Resilience)  
**Source**: Michael T. Nygard - _Release It!_ (adapted for agents)  
**Pattern**: Prevent cascading failures

#### Problem

-   Tool repeatedly fails (e.g., API down, DB connection lost)
-   Agent wastes steps calling same failing tool
-   Exhausts retry budgets without making progress
-   User waits unnecessarily

#### Solution

Temporarily disable tool after threshold failures:

**States**:

-   **Closed**: Tool working normally
-   **Open**: Tool disabled after N failures (e.g., 3 consecutive)
-   **Half-Open**: Testing if tool recovered (after timeout)

**Flow**:

1. Tool fails → increment counter
2. Counter reaches threshold (e.g., 3) → open circuit
3. Circuit open → reject calls immediately with error
4. After timeout (e.g., 10s) → allow one test call
5. Test succeeds → close circuit, reset counter
6. Test fails → reopen circuit

#### Benefits

-   ✅ Fast-fail (no waiting on broken tools)
-   ✅ Preserves retry budget for other tools
-   ✅ Automatic recovery detection
-   ✅ Prevents cascading failures

#### Trade-offs

-   ⚠️ Aggressive thresholds can disable tools too quickly
-   ⚠️ May need manual reset for certain failures
-   ⚠️ Timeout tuning required (too short → premature retry, too long → slow recovery)

#### When to Use

-   External API calls (unreliable dependencies)
-   Database operations (connection issues)
-   Tools with known instability
-   Production systems with high uptime requirements

#### Implementation Complexity

**Time**: 2-3 hours  
**Components**: Circuit breaker class, state tracking, timeout management

#### Configuration

-   **Failure threshold**: 3 (recommended starting point)
-   **Reset timeout**: 10s (lenient) to 60s (aggressive)
-   **Test call**: Single call in half-open state

#### Code Reference

See `PLAN.md` Section 6.9 for `CircuitBreaker` class implementation.

---

### 6. Tool Result Validation

**Category**: Error Recovery (Self-Correction)  
**Source**: ReAct + Reflexion research (2024)  
**Research Finding**: Catches 60% of silent failures

#### Problem

-   Tool executes successfully (returns 200 OK)
-   But: side effect didn't happen (silent failure)
    -   Example: "Page created" but page not in DB
    -   Example: "Slug updated" but slug unchanged
-   Agent assumes success, continues with broken state
-   Downstream failures, user confusion

#### Solution

Verify expected state after mutation:

**Validation Checks**:

1. **CREATE**: Resource exists in DB with correct fields
2. **UPDATE**: Changes applied, no orphaned refs
3. **DELETE**: Resource removed, cascade rules followed
4. **Schema changes**: No breaking changes to existing content

**Flow**:

1. Tool executes mutation
2. Tool queries DB to verify expected state
3. If mismatch: throw error with details (agent observes)
4. Agent retries with corrections (max 2 attempts)
5. If still failing: escalate to user

#### Benefits

-   ✅ Catches 60% of silent failures
-   ✅ Agent self-corrects automatically
-   ✅ Reduces user intervention
-   ✅ More reliable workflows

#### Trade-offs

-   ⚠️ Adds 1 DB query per mutation (performance cost)
-   ⚠️ Increases tool execution time (~50-100ms)
-   ⚠️ Can produce false positives (e.g., eventual consistency)

#### When to Use

-   Critical workflows (payment, data loss risk)
-   Multi-step operations (where failures cascade)
-   External integrations (unreliable APIs)
-   Production systems

#### Implementation Complexity

**Time**: 2-3 hours (per tool category)  
**Components**: Validation functions, error observations, retry logic

#### Example

```typescript
async function createPage(input, context) {
	// 1. Execute mutation
	const page = await db.pages.create(input);

	// 2. Validate
	const exists = await db.pages.findById(page.id);
	if (!exists) {
		throw new Error("Validation failed: Page not in DB");
	}

	return page;
}
```

---

## III. Planning & Exploration

### 7. Alternative Path Generation (Plan-and-Execute)

**Category**: Planning  
**Source**: LangChain 2024 - _"Plan-and-Execute Agents"_  
**Research Finding**: 40% reduction in dead ends

#### Problem

-   Agent picks one approach (linear execution)
-   Approach fails → stuck in dead end
-   No backup plan, escalates to user
-   Example: "Update page" when page doesn't exist

#### Solution

Generate multiple alternative plans upfront, rank by feasibility, execute best, fallback if fails:

**Flow**:

1. **Generate Plans** (3 alternatives):

    - Plan A: Reuse existing resources (fastest)
    - Plan B: Create new resources (flexible)
    - Plan C: Clone from template (balanced)

2. **Rank by Feasibility**:

    - Preflight validation: check if required resources exist
    - Estimate cost (# of tool calls)
    - Identify risks

3. **Execute Best Plan**:

    - Try Plan A (highest feasibility)
    - If fails → try Plan B (second best)
    - If fails → try Plan C (last resort)

4. **Report Result**:
    - Success: which plan worked
    - Failure: all plans exhausted, escalate

#### Benefits

-   ✅ 40% fewer dead ends
-   ✅ Graceful degradation (tries 3 approaches)
-   ✅ Transparent reasoning (user sees which plan tried)
-   ✅ Better success rate on ambiguous tasks

#### Trade-offs

-   ⚠️ Adds planning overhead (2-3 LLM calls)
-   ⚠️ Slower for simple tasks (unnecessary for 1-step operations)
-   ⚠️ Can generate invalid plans (requires validation)

#### When to Use

-   Complex multi-step tasks
-   Ambiguous user requests ("create a contact page")
-   Tasks with multiple valid approaches
-   Architect/planning modes (not every request)

#### Implementation Complexity

**Time**: 4-6 hours  
**Components**: Plan generator, feasibility scorer, fallback executor

#### Code Reference

See `PLAN.md` Section 6.10 for full implementation with `generateAlternativePlans()` and `executeWithFallback()`.

---

### 8. Preflight Validation

**Category**: Planning  
**Source**: Production best practice (Kilo Code learnings)  
**Purpose**: Validate plan before execution

#### Problem

-   Agent creates elaborate plan
-   Starts execution
-   Step 5 fails: required resource doesn't exist
-   Wasted 4 steps, need to re-plan

#### Solution

Validate plan feasibility before execution:

**Checks**:

1. **Resource existence**: Do all referenced IDs exist in DB?
2. **Constraint satisfaction**: Unique slugs, required fields
3. **Schema compatibility**: Content matches elements_structure
4. **Permission rules**: Can user perform operations? (for RBAC)

**Output**:

```typescript
{
  valid: boolean,
  issues: [
    "Section definition 'hero-new' does not exist",
    "Slug 'about' already in use"
  ],
  suggestions: [
    "Create 'hero-new' first via cms.createSectionDef",
    "Use slug 'about-2' instead"
  ]
}
```

#### Benefits

-   ✅ Catches issues early (before wasting tool calls)
-   ✅ Agent adjusts plan proactively
-   ✅ Fewer retries, faster completion
-   ✅ Better UX (user not interrupted mid-execution)

#### Trade-offs

-   ⚠️ Adds upfront cost (validation queries)
-   ⚠️ Only works for deterministic checks (can't predict runtime errors)
-   ⚠️ Can be overly conservative (reject valid plans)

#### When to Use

-   Architect/planning modes
-   Complex multi-step operations
-   When execution is expensive (API costs, user waiting)
-   Before HITL operations (validate before asking user)

#### Implementation Complexity

**Time**: 3-4 hours  
**Components**: Validation rules, DB queries, suggestion generator

#### Example

```typescript
const plan = [{ tool: "cms.addSectionToPage", args: { sectionDefId: "hero-new" } }];

const validation = await validatePlan(plan);
// → { valid: false, issues: ['hero-new does not exist'], ... }

// Agent adjusts plan:
const revisedPlan = [
	{ tool: "cms.createSectionDef", args: { key: "hero-new" } },
	{ tool: "cms.addSectionToPage", args: { sectionDefId: "hero-new" } },
];
```

---

### 9. Reflection & Self-Critique (Reflexion)

**Category**: Planning (Quality Improvement)  
**Source**: Reflexion (Shinn et al. 2023), LangChain 2024  
**Research Finding**: 20% accuracy improvement on knowledge tasks

#### Problem

-   Agent generates response
-   Response is functional but suboptimal
-   Examples:
    -   Forgets to address part of request
    -   Ambiguous wording
    -   Missing error handling
    -   No follow-up suggestions

#### Solution

Self-critique loop: Generate → Critique → Refine → Repeat

**Flow**:

1. **Generate**: Agent produces initial output
2. **Critique**: LLM acts as critic, evaluates quality (0-10 scale)
3. **Decide**: If quality < 8.5, refine; else accept
4. **Refine**: Generate improved version addressing critique
5. **Repeat**: Max 2 iterations

#### Benefits

-   ✅ 20% accuracy improvement (research)
-   ✅ Higher quality outputs
-   ✅ Catches omissions, ambiguities
-   ✅ Proactive follow-up suggestions

#### Trade-offs

-   ⚠️ Adds 2-4 LLM calls per reflection loop
-   ⚠️ 30% latency increase
-   ⚠️ Can over-polish (diminishing returns)
-   ⚠️ Not suitable for low-latency applications

#### When to Use

-   **Adaptive**: Agent decides based on task complexity
    -   Simple tasks (1-2 steps): skip reflection
    -   Complex tasks (multi-step, ambiguous): enable reflection
-   Knowledge-intensive tasks (reports, summaries)
-   Final outputs (user-facing responses)
-   Architect mode (planning quality matters)

#### Implementation Complexity

**Time**: 3-4 hours  
**Components**: Complexity analyzer, critique generator, refinement loop

#### Complexity Factors (for adaptive reflection)

-   Multi-step: >3 sequential operations (+0.3)
-   Data transformation: Complex logic (+0.2)
-   External dependencies: HTTP calls (+0.2)
-   Ambiguous request: Unclear intent (+0.2)
-   High-risk: Destructive operations (+0.1)
-   **Threshold**: Enable reflection if score ≥ 0.5

#### Code Reference

See `PLAN.md` Section 6.11 for full implementation with `analyzeComplexity()` and `reflectAndRefine()`.

---

## IV. Human-Agent Interaction

### 10. Human-in-the-Loop (HITL) Approval Gates

**Category**: Safety & Control  
**Source**: AI SDK v6 native pattern, production best practices  
**Purpose**: User confirms before destructive operations

#### Problem

-   Agent can make irreversible changes
-   Examples: delete page, overwrite schema, bulk operations
-   User has no control, must trust agent blindly
-   Mistakes are costly (data loss, broken workflows)

#### Solution

Pause execution before high-risk operations, ask user to approve:

**HITL Tools** (require approval):

-   DELETE operations: `cms.deletePage`, `cms.deleteEntry`
-   Schema changes: `cms.syncSectionElements` (breaking changes)
-   Bulk operations: Any tool affecting 10+ resources
-   High-risk updates: Changing slugs (breaks URLs)

**Flow**:

1. Agent decides to call HITL tool
2. Stream pauses, emit `approval_required` event
3. Frontend shows modal with:
    - Tool name & description
    - Input parameters (collapsible)
    - Risk explanation
    - Actions: Approve / Reject / Ask for Alternative
4. User decides → POST `/v1/agent/approve` with decision
5. Backend resumes execution or observes rejection

#### Benefits

-   ✅ User control over critical operations
-   ✅ Prevents costly mistakes
-   ✅ Builds user trust
-   ✅ Audit trail (who approved what)

#### Trade-offs

-   ⚠️ Breaks autonomous flow (requires human)
-   ⚠️ Adds latency (wait for user response)
-   ⚠️ Risk of alert fatigue (too many approvals)

#### When to Use

-   Destructive operations (delete, truncate)
-   Schema migrations (breaking changes)
-   Bulk updates (>10 resources)
-   Production deployments
-   Financial transactions

#### Implementation Complexity

**Time**: 4-6 hours  
**Components**: HITL detection, stream pause/resume, approval modal, timeout handling

#### AI SDK v6 Pattern

```typescript
// Backend: Tool without execute → auto-forwards to client
export const deletePageTool = tool({
	description: "Delete page (requires approval)",
	inputSchema: z.object({ id: z.string() }),
	// NO execute function → AI SDK forwards to client
});

// Frontend: Catch tool-call event
onToolCall: async ({ toolCall }) => {
	if (requiresApproval.includes(toolCall.toolName)) {
		const decision = await showApprovalModal(toolCall);
		return { approved: decision === "approve" };
	}
	return { approved: true };
};
```

---

### 11. Adaptive Proactivity

**Category**: User Experience  
**Source**: SuperAGI 2024 - _"Self-Healing AI Agents"_  
**Pattern**: Agent suggests improvements (when appropriate)

#### Problem

-   Agent is purely reactive (waits for user commands)
-   Misses opportunities to help proactively
-   Examples:
    -   Empty page created → suggest adding sections
    -   Broken reference detected → offer to fix
    -   Ambiguous request → ask clarifying questions

#### Solution

Agent monitors state, suggests improvements when asked or when critical:

**Modes**:

1. **Off**: Purely reactive (no suggestions)
2. **On-Request**: Suggests only when user asks "what should I do?"
3. **Proactive**: Always suggests after completing tasks

**When to Suggest**:

-   After task completion: "Now that X is done, would you like me to Y?"
-   Issue detected: "I noticed Z is empty/broken. Should I fix it?"
-   Clarification needed: "Which locale should I use? (default: en)"

#### Benefits

-   ✅ Better UX (helpful, not just obedient)
-   ✅ Catches issues early
-   ✅ Reduces back-and-forth
-   ✅ Educates users on best practices

#### Trade-offs

-   ⚠️ Can be annoying if too frequent
-   ⚠️ User might feel pressured
-   ⚠️ Adds output length (more tokens)

#### When to Use

-   Tutorial/onboarding flows
-   Novice users (need guidance)
-   Complex workflows (many options)
-   **Recommended**: On-request mode (user controls proactivity)

#### Implementation Complexity

**Time**: 2-3 hours  
**Components**: State monitor, suggestion generator, mode configuration

#### Example

```
User: "Create an About page"

Agent: [Creates page]
Agent: "✅ Created 'About' page.

I noticed it has no sections yet. Would you like me to:
- Add a default hero section?
- Add a content section?
- Leave it empty for now?

Preview: http://localhost:4000/pages/about"
```

---

## V. Loop Control & State Management

### 12. Loop State Machine

**Category**: Loop Control  
**Source**: AgentFlow (Stanford 2024)  
**Research Finding**: 14.9% accuracy improvement

#### Problem

-   Agent executes in black box (no visibility into what phase it's in)
-   User doesn't know: planning vs executing vs stuck
-   No progress tracking
-   Debugging is difficult

#### Solution

Explicit state machine tracking agent phase:

**States**:

-   **Planning**: Generating plan, validating feasibility
-   **Executing**: Running tools, making changes
-   **Verifying**: Checking results, validation
-   **Reflecting**: Self-critique (complex tasks only)
-   **Completed**: Goal achieved
-   **Stuck**: No progress after N attempts
-   **Escalated**: Needs human intervention

**Transitions**:

-   Planning → Executing (plan ready)
-   Executing → Verifying (tools done)
-   Verifying → Completed (validation passed)
-   Verifying → Executing (retry needed)
-   Any → Stuck (repeated failures)
-   Any → Escalated (unrecoverable error)

#### Benefits

-   ✅ Transparency (user sees what agent is doing)
-   ✅ Progress visualization (% complete)
-   ✅ Better debugging (see where it got stuck)
-   ✅ 14.9% accuracy improvement (AgentFlow)

#### Trade-offs

-   ⚠️ Requires explicit phase detection logic
-   ⚠️ Can be over-engineered for simple tasks

#### When to Use

-   Long-running tasks (>5 steps)
-   Complex multi-phase workflows
-   Production dashboards (monitoring)
-   User-facing progress indicators

#### Implementation Complexity

**Time**: 3-4 hours  
**Components**: State enum, transition logic, event emission

#### Code Reference

See `PLAN.md` Section 6.12 for `LoopController` class with phase tracking.

---

### 13. Convergence Detection

**Category**: Loop Control  
**Source**: AgentFlow (Stanford 2024), production patterns  
**Purpose**: Detect when task is complete or stuck

#### Problem

-   Agent keeps looping even after goal achieved
-   Or: agent stuck in infinite loop (same action failing)
-   Wastes steps, costs money, poor UX

#### Solution

Detect convergence signals:

**Completion Signals**:

-   Agent says "✅ Done", "Task finished", "Goal achieved"
-   No more pending subgoals
-   Quality threshold met (for reflection mode)

**Stuck Signals**:

-   Same tool called 3x in a row with same error
-   No new information added in last N steps
-   Error rate > 50% in last 5 steps

**Action**:

-   Completion → stop loop, return success
-   Stuck → escalate to user with explanation

#### Benefits

-   ✅ Early exit (saves steps)
-   ✅ Prevents infinite loops
-   ✅ Better UX (agent stops when done)
-   ✅ Cost optimization

#### Trade-offs

-   ⚠️ False positives (premature stop)
-   ⚠️ Pattern matching can be brittle

#### When to Use

-   All agent loops (recommended as default)
-   Especially: unbounded step limits
-   Production systems (prevent runaway costs)

#### Implementation Complexity

**Time**: 2-3 hours  
**Components**: Pattern detection, action history analysis

#### Example

```typescript
// Detect completion
function checkConvergence(steps: Step[]): boolean {
	const lastStep = steps[steps.length - 1];
	const completionPatterns = [/✅.*done/i, /completed successfully/i];

	for (const pattern of completionPatterns) {
		if (lastStep.text?.match(pattern)) {
			return true; // Task complete
		}
	}

	return false;
}

// Detect stuck
function detectStuck(steps: Step[]): boolean {
	const last3 = steps.slice(-3).map((s) => s.toolCalls?.[0]?.toolName);
	return last3.every((t) => t === last3[0]); // Same tool 3x
}
```

---

### 14. State Persistence & Checkpointing

**Category**: State Management (Resilience)  
**Source**: Production best practice, long-running workflow patterns  
**Purpose**: Survive crashes, timeouts, browser close

#### Problem

-   Long tasks (10+ steps) interrupted by:
    -   Server restart
    -   Timeout (120s limit)
    -   User closes browser
-   All progress lost, must start over
-   Poor UX, wasted API calls

#### Solution

Periodically save agent state to DB, resume from checkpoint:

**Checkpoint Contents**:

-   Session ID, trace ID, timestamp
-   Agent phase (planning/executing/completed)
-   Current subgoal, completed subgoals
-   Messages (full conversation history)
-   Working memory, subgoal memory
-   Execution state (step number, pending actions)
-   Metadata (token count, mode, estimated completion %)

**Checkpoint Frequency**:

-   Every 3 steps (automatic)
-   Phase transitions (planning → executing)
-   Before HITL approvals
-   On errors (before retry)

**Resume Flow**:

1. User returns to session
2. Frontend detects checkpoint in DB
3. Shows "Resume previous session?" modal
4. POST `/api/agent/resume` with sessionId
5. Backend restores agent state
6. Continue execution with optional new user input

#### Benefits

-   ✅ Zero progress loss (resilient to crashes)
-   ✅ Resume in <1s
-   ✅ User can leave and return anytime
-   ✅ Debugging: replay from any checkpoint

#### Trade-offs

-   ⚠️ DB storage cost (JSON checkpoint per session)
-   ⚠️ Adds write latency (checkpoint save ~50ms)
-   ⚠️ State reconstruction complexity

#### When to Use

-   Long-running tasks (>5 steps)
-   User-facing applications (browser close risk)
-   Unreliable infrastructure (timeout risk)
-   Production systems (uptime matters)

#### Implementation Complexity

**Time**: 4-6 hours  
**Components**: Checkpoint manager, DB schema, resume endpoint, frontend detection

#### Storage Estimate

-   Checkpoint size: ~10-50 KB (JSON)
-   Frequency: Every 3 steps
-   10-step task: ~3 checkpoints = 30-150 KB total

#### Code Reference

See `PLAN.md` Section 6.8 for `CheckpointManager` class with save/restore/resume methods.

---

## VI. Tool & Agent Coordination

### 15. Tool Registry with Metadata

**Category**: Tool Management  
**Source**: AI SDK v6 patterns, production systems  
**Purpose**: Centralized, extensible tool management

#### Problem

-   Tools scattered across codebase
-   No central discovery mechanism
-   Hard to filter by capability, risk, mode
-   Metadata (requires approval, risk level) is ad-hoc

#### Solution

Central registry with extended metadata:

**Metadata Fields**:

-   `id`: Unique identifier (`cms.createPage`)
-   `category`: `cms`, `memory`, `http`, `planning`
-   `riskLevel`: `safe`, `moderate`, `high`
-   `requiresApproval`: Boolean (HITL flag)
-   `allowedModes`: Array of modes (`['cms-crud', 'architect']`)
-   `tags`: Array of strings (`['write', 'page', 'cms']`)

**Registry Methods**:

-   `register(id, tool)`: Add tool
-   `get(id)`: Get single tool
-   `getToolsForMode(mode)`: Filter by mode
-   `getToolsByRisk(risk)`: Filter by risk level
-   `getApprovalTools()`: Get all HITL tools

#### Benefits

-   ✅ Centralized management
-   ✅ Dynamic discovery (query by metadata)
-   ✅ Mode-based security (prevent unauthorized ops)
-   ✅ Easy to extend (add new tools)
-   ✅ Type-safe (TypeScript interfaces)

#### Trade-offs

-   ⚠️ Upfront design cost (metadata schema)
-   ⚠️ Requires discipline (all tools must register)

#### When to Use

-   Medium to large projects (>10 tools)
-   Multiple agent modes
-   Security requirements (RBAC, approval gates)
-   Team environments (shared tool catalog)

#### Implementation Complexity

**Time**: 3-4 hours  
**Components**: Registry class, metadata interface, factory function

#### Code Reference

See `PLAN.md` Section 6 (Tool Organization Architecture) for full `ToolRegistry` class.

---

### 16. Mode-Based Tool Filtering

**Category**: Tool Management (Security)  
**Source**: Kilo Code learnings, multi-agent patterns  
**Purpose**: Restrict tools by agent mode

#### Problem

-   All tools available to agent all the time
-   Risk: agent uses destructive tool in read-only mode
-   Example: "Ask mode" should not be able to delete pages

#### Solution

Tag tools with allowed modes, filter at runtime:

**Modes**:

-   **Architect**: Planning, validation (read-only + validatePlan)
-   **CMS CRUD**: Full CRUD operations (all CMS tools)
-   **Debug**: Fix errors (read + single corrective write)
-   **Ask**: Inspect state (read-only tools only)

**Tool Metadata**:

```typescript
createPageTool = {
	allowedModes: ["cms-crud"], // Only available in CRUD mode
	// ...
};

validatePlanTool = {
	allowedModes: ["architect"], // Only available in Architect mode
	// ...
};
```

**Runtime Filtering**:

```typescript
const tools = registry.getToolsForMode(currentMode);
// Returns only tools allowed in current mode
```

#### Benefits

-   ✅ Mode-based security (prevent unauthorized ops)
-   ✅ Clearer agent capabilities (mode defines what agent can do)
-   ✅ Reduces tool choice complexity (fewer options)
-   ✅ User control (switch modes to change capabilities)

#### Trade-offs

-   ⚠️ Requires upfront mode design
-   ⚠️ Agent might get stuck if mode too restrictive

#### When to Use

-   Multi-mode agents
-   Security-sensitive operations
-   User-controlled agent capabilities
-   Team environments (different user roles)

#### Implementation Complexity

**Time**: 1-2 hours (given registry exists)  
**Components**: Mode enum, metadata tagging, filter function

---

### 17. Multi-Agent Orchestration

**Category**: Agent Coordination  
**Source**: Kilo Code learnings, production multi-agent systems  
**Pattern**: Orchestrator + specialized sub-agents

#### Problem

-   Single agent tries to do everything
-   Conflicting responsibilities (plan vs execute vs debug)
-   Context pollution (planning context mixed with execution)
-   Hard to optimize (different tasks need different strategies)

#### Solution

Orchestrator delegates to specialized agents:

**Architecture**:

```
Orchestrator (master)
├─ Architect Agent (planning, validation)
├─ CRUD Agent (execution)
├─ Debug Agent (error recovery)
└─ Ask Agent (read-only inspection)
```

**Orchestrator Responsibilities**:

-   Classify user intent → route to appropriate agent
-   Mode switching (escalate from Ask → CRUD if user wants changes)
-   Context passing (transfer relevant info between agents)
-   Final response assembly

**Sub-Agent Specialization**:

-   **Architect**: Plans multi-step workflows, validates feasibility
    -   Tools: read-only + `validatePlan`
    -   Max steps: 6
-   **CRUD**: Executes mutations
    -   Tools: all CMS CRUD
    -   Max steps: 10
-   **Debug**: Fixes failed operations
    -   Tools: read + single corrective write
    -   Max steps: 4
-   **Ask**: Explains CMS state
    -   Tools: read-only
    -   Max steps: 6

#### Benefits

-   ✅ Cleaner contexts (no pollution)
-   ✅ Specialized optimization (different strategies per agent)
-   ✅ Easier debugging (know which agent failed)
-   ✅ Better performance (focused agents)

#### Trade-offs

-   ⚠️ Complex orchestration logic
-   ⚠️ Context transfer overhead
-   ⚠️ Harder to reason about global flow

#### When to Use

-   Complex applications (many responsibilities)
-   Distinct workflows (planning vs execution vs debugging)
-   Performance optimization (specialize models per agent)
-   Team development (different teams own different agents)

#### Implementation Complexity

**Time**: 8-12 hours  
**Components**: Orchestrator, intent classifier, 4 sub-agents, context transfer

#### Example Flow

```
User: "Create a blog page with 3 posts about AI"

Orchestrator: [Classifies as complex creation task]
→ Delegates to Architect Agent

Architect: [Generates plan, validates]
→ Returns plan to Orchestrator

Orchestrator: [Switches to CRUD Agent]
→ Passes plan to CRUD Agent

CRUD: [Executes plan steps]
→ Returns result to Orchestrator

Orchestrator: [Assembles final response]
→ Returns to user
```

---

## Pattern Selection Guide

### By Use Case

**Starting a new project?**

1. Start with: Tool Registry, Mode-Based Filtering, HITL
2. Add as needed: Hierarchical Memory, Error Classification, State Persistence

**Production system?**

1. Must-have: Hierarchical Memory, Error Classification, Circuit Breaker, State Persistence, HITL
2. Nice-to-have: Alternative Plans, Reflection, Loop State Machine

**Prototype/MVP?**

1. Start with: Basic ReAct loop
2. Add incrementally: Tool Registry, Error Classification, HITL

**Long-running workflows?**

1. Critical: State Persistence, Hierarchical Memory, Convergence Detection
2. Important: Loop State Machine, Circuit Breaker

### By Problem

**"Agent gets stuck"**
→ Convergence Detection, Circuit Breaker, Alternative Plans

**"Agent loses context"**
→ Hierarchical Memory, Sliding Window, State Persistence

**"Agent makes mistakes"**
→ Tool Result Validation, Reflection, Preflight Validation, HITL

**"Agent is too expensive"**
→ Hierarchical Memory, KV-Cache Optimization, Convergence Detection

**"Agent can't handle failures"**
→ Error Classification, Circuit Breaker, Alternative Plans

**"Agent lacks transparency"**
→ Loop State Machine, Convergence Detection, Mode-Based Filtering

---

## Implementation Priority Matrix

| Pattern                   | Impact | Complexity | Priority              |
| ------------------------- | ------ | ---------- | --------------------- |
| Tool Registry             | High   | Low        | **P0** (foundational) |
| Mode-Based Filtering      | High   | Low        | **P0** (security)     |
| Error Classification      | High   | Medium     | **P0** (reliability)  |
| HITL Approval Gates       | High   | Medium     | **P0** (safety)       |
| Hierarchical Memory       | High   | High       | **P1** (scalability)  |
| State Persistence         | High   | High       | **P1** (resilience)   |
| Tool Result Validation    | Medium | Medium     | **P1** (quality)      |
| Circuit Breaker           | Medium | Low        | **P1** (resilience)   |
| Convergence Detection     | Medium | Low        | **P2** (optimization) |
| Loop State Machine        | Medium | Medium     | **P2** (UX)           |
| Alternative Plans         | Medium | High       | **P2** (advanced)     |
| Preflight Validation      | Low    | Medium     | **P3** (optimization) |
| Reflection                | Low    | Medium     | **P3** (quality)      |
| KV-Cache Optimization     | Low    | Low        | **P3** (cost)         |
| Adaptive Proactivity      | Low    | Low        | **P3** (UX)           |
| Multi-Agent Orchestration | High   | Very High  | **P4** (when scaling) |

**Priority Key**:

-   **P0**: Implement first (foundational, security, safety)
-   **P1**: Implement for production (scalability, reliability)
-   **P2**: Implement for maturity (optimization, better UX)
-   **P3**: Implement if needed (specific use cases)
-   **P4**: Implement when scaling (complex systems)

---

## Research Sources

### Academic Papers (2024-2025)

1. **HiAgent** - "Hierarchical Working Memory Management for Solving Long-Horizon Agent Tasks" (2024)
2. **AgentFlow** - "In-the-Flow Agentic System Optimization" (Stanford 2024)
3. **Reflexion** - "Reflexion: Language Agents with Verbal Reinforcement Learning" (Shinn et al. 2023)
4. **ReAct** - "ReAct: Synergizing Reasoning and Acting in Language Models" (Yao et al. 2023)

### Industry Resources

1. **Anthropic** - "Effective Context Engineering for AI Agents" (2024)
2. **LangChain** - "Reflection Agents", "Plan-and-Execute Agents" (2024)
3. **SuperAGI** - "Self-Healing AI Agents" (2024)
4. **Manus.im** - "Context Engineering: Lessons from Building Manus" (2024)
5. **raia.ai** - "Exception Handling & Recovery" documentation (2024)
6. **Philschmid** - "Agents 2.0: From Shallow Loops to Deep Agents" (2024)

### Frameworks & Tools

1. **AI SDK v6** (Vercel) - Native HITL, tool calling patterns
2. **LangGraph** - Graph-based agent orchestration
3. **OpenAI Agents SDK** - Structured agent tooling
4. **LanceDB** - Vector memory for agents

---

## Version History

**v1.0** (2025-11-07)

-   Initial compilation from ReAct CMS agent research
-   17 patterns documented
-   Research citations added
-   Implementation guidance included

---

## Contributing

To add new patterns:

1. Follow template: Problem → Solution → Benefits → Trade-offs → When to Use → Complexity
2. Include research source or production reference
3. Add code examples where relevant
4. Update Pattern Selection Guide and Priority Matrix

---

**End of Patterns Library**
