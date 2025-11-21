# Universal Documentation Template

**Purpose**: Standard structure for all knowledge base documents
**Last Updated**: 2025-11-20
**Usage**: Copy this template when creating new docs in `/docs/kb/`

---

## Template Structure

````markdown
# [Layer].[Section].[Topic] - [Title]

## TL;DR

[1-3 sentence capturing the essence of the topic but in an understandable, easy to read way - what problem this solves and the key benefit]

**Status**: [✅ Complete | 🚧 In Progress | ⏳ Pending]
**Last Updated**: YYYY-MM-DD
**Versions**: [OPTIONAL - Only include if doc is framework/library-specific with version-dependent behavior. Examples: "AI SDK 6.0+", "Next.js 15 App Router". Skip for conceptual topics.]
**Prerequisites**: [[Link to prerequisite doc 1], [Link to prerequisite doc 2]]
**Grounded In**: [Key research papers/production systems, 2024-2025]

---

## Table of Contents

[This section is OPTIONAL but RECOMMENDED for documents >500 lines]

-   [Overview](#overview)
-   [The Problem](#the-problem-clear-problem-statement)
-   [Core Concept](#core-concept)
-   [Implementation Patterns](#implementation-patterns)
-   [Framework Integration](#framework-integration)
-   [Research & Benchmarks](#research--benchmarks)
-   [When to Use This Pattern](#when-to-use-this-pattern)
-   [Production Best Practices](#production-best-practices)
-   [Observability & Debugging](#observability--debugging) _(if applicable)_
-   [Token Efficiency](#token-efficiency) _(if applicable)_
-   [Trade-offs & Considerations](#trade-offs--considerations)
-   [Integration with Your Codebase](#integration-with-your-codebase) _(if applicable)_
-   [Key Takeaways](#key-takeaways)
-   [References](#references)

**Note**: Update this TOC to match your document's actual sections. Many markdown editors can auto-generate TOCs.

---

## Overview

[2-3 paragraphs that answer:]

-   What is this pattern/concept?
-   Why does it matter?
-   What's the core innovation or key insight?

**Key Research Findings** (2024-2025):

-   **[Metric/Finding]**: [Specific improvement with source]
-   **[Metric/Finding]**: [Specific improvement with source]
-   **[Metric/Finding]**: [Specific improvement with source]

**Date Verified**: [Current date for freshness]

---

## The Problem: [Clear problem statement]

[Describe the problem this pattern solves using:]

### The Classic Challenge

[Concrete scenario showing the problem]

**CODE EXAMPLE RULE**: Only include code if the problem is fundamentally about implementation. For conceptual/architectural issues, describe the problem in plain English instead.

```typescript
// ❌ BAD: [What goes wrong]
// ONLY include this code block if:
// - The problem is subtle/hidden in code
// - Showing code makes the issue instantly clear
// - Text alone would be confusing
[Code example - use only when necessary]
```

**Problems**:

-   ❌ [Specific issue 1 with impact]
-   ❌ [Specific issue 2 with impact]
-   ❌ [Specific issue 3 with impact]

### Why This Matters

[Business/technical impact of the problem - costs, failures, user experience]

---

## Core Concept

[Deep dive into the solution:]

### What is [Pattern Name]?

[Definition in plain English]

### Visual Representation

**CRITICAL: Use ASCII diagrams exclusively for all visualizations.**

**Design Philosophy**: Keep diagrams simple, clean, and scannable. Focus on clarity over detail.

**Common Patterns:**

**Simple Flow (linear process):**

```
Input → Process → Output
```

**Decision Flow (branching):**

```
Input
  ↓
Decision Point
  ├─── Option A → Result A
  └─── Option B → Result B
```

**Loop Flow (iteration):**

```
  ┌──────── LOOP ────────┐
  ↓                      │
Step 1 → Step 2 → Step 3 │
  │                      │
  └── Continue? ─────────┘
       │
       ↓ Stop
     Result
```

**System Architecture (boxes with relationships):**

```
┌─────────────┐      ┌─────────────┐
│  Component  │─────▶│  Component  │
│      A      │      │      B      │
└─────────────┘      └─────────────┘
       │                    │
       ↓                    ↓
┌─────────────┐      ┌─────────────┐
│  Component  │      │  Component  │
│      C      │      │      D      │
└─────────────┘      └─────────────┘
```

**Data Transformation:**

```
"The quick brown fox jumps over the lazy dog."
    ↓
Tokenization
    ↓
[825, 318, 262, 3139, 286, 4881, 30]
    ↓
10 words → ~13 tokens (including punctuation)
```

**Guidelines for ASCII Diagrams:**

-   Keep diagrams under 15 lines for readability
-   Use Unicode box-drawing characters: ┌ ┐ └ ┘ ├ ┤ ─ │ ↓ →
-   Align elements consistently
-   Add brief labels inside boxes or next to arrows
-   Test that your diagram renders correctly in monospace font
-   If diagram gets complex (>20 boxes), break into multiple simpler diagrams

### Key Principles

1. **[Principle 1]**: [Explanation]
2. **[Principle 2]**: [Explanation]
3. **[Principle 3]**: [Explanation]

---

## Implementation Patterns

### Pattern 1: [Basic/Simple Pattern Name]

**Use Case**: [When to use this variant]

**CRITICAL: Only include code examples when they:**

-   Demonstrate non-obvious implementation details
-   Show critical error handling or edge cases
-   Reveal performance-critical patterns
-   Clarify complex abstractions

**DO NOT include code for:**

-   Simple API calls engineers already know
-   Basic CRUD operations
-   Standard framework patterns (Next.js routes, NestJS controllers)
-   Obvious type definitions

```typescript
// Include ONLY if this code teaches something unique
// Focus on the "aha moment" - what's different/critical here?
[Code example - use sparingly, only when adds real value]
```

**Pros**:

-   ✅ [Benefit]
-   ✅ [Benefit]

**Cons**:

-   ❌ [Limitation]
-   ❌ [Limitation]

**When to Use**: [Specific scenarios]

### Pattern 2: [Advanced Pattern Name]

[Repeat structure above]

### Pattern 3: [Production Pattern Name]

[Repeat structure above, focus on production-ready]

---

## Framework Integration

**MANDATORY FOR IMPLEMENTATION PATTERNS**: Show how to implement this pattern in our stack.

**When to INCLUDE this section:**

-   Pattern involves code implementation (agents, tools, RAG, memory systems)
-   Developer needs to know where/how to integrate with our frameworks
-   There are framework-specific APIs or patterns to follow

**When to SKIP this section:**

-   Purely conceptual topics (LLM theory, training vs inference)
-   Pattern has no code implementation
-   Already covered sufficiently in "Implementation Patterns"

**RESEARCH REQUIREMENT**: Before writing framework integration, you MUST:

1. **Search official docs** for current APIs and best practices
2. **Use web search** to find latest patterns and examples
3. **Verify versions** - APIs change, don't rely on outdated knowledge

**Required Documentation Sources:**

-   [Vercel AI SDK 6 Docs](https://ai-sdk.dev/docs/announcing-ai-sdk-6-beta) - Agent patterns, tools, streaming
-   [AI Elements](https://ai-sdk.dev/elements) - UI components for AI features
-   [Next.js Docs](https://nextjs.org/docs) - App Router, Server Actions, streaming
-   [NestJS Docs](https://docs.nestjs.com/) - Backend architecture, modules, services

### Our Tech Stack

**Frontend**: Next.js 15 (App Router) + AI SDK 6 + AI Elements
**Backend**: NestJS + AI SDK 6
**Agents**: Vercel AI SDK 6 `ToolLoopAgent` abstraction

---

### AI SDK 6 Agent Implementation

**When to include**: Any pattern involving agents, tools, or autonomous behavior.

```typescript
// Example: ToolLoopAgent with our patterns
import { ToolLoopAgent } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";

const agent = new ToolLoopAgent({
	model: openrouter.languageModel("google/gemini-2.5-flash"),
	instructions: "[Your system prompt]",
	tools: {
		// Your tools here
	},
});
```

**Key AI SDK 6 Concepts** (research before using):

-   `ToolLoopAgent` - Default agent implementation
-   `callOptionsSchema` - Runtime configuration with Zod
-   `prepareCall` - Dynamic prompt/tool injection
-   Tool approval with `needsApproval`
-   Structured output with `Output.object()`

**Research**: [AI SDK 6 Agent Docs](https://ai-sdk.dev/docs/announcing-ai-sdk-6-beta#agent-abstraction)

---

### Next.js Frontend Integration

**When to include**: Patterns that need UI, streaming, or client-side interaction.

**App Router Structure**:

```
app/
  [feature]/
    page.tsx              # Client component with useChat/useAgent
    _components/          # Feature-specific components
    _actions/             # Server Actions
  api/
    [feature]/route.ts    # API route for streaming
```

**Example: Streaming Agent Response**

```typescript
// app/api/agent/route.ts (Server)
import { createAgentUIStreamResponse } from "ai";
import { myAgent } from "@/server/agents/my-agent";

export async function POST(request: Request) {
	const { messages } = await request.json();

	return createAgentUIStreamResponse({
		agent: myAgent,
		messages,
	});
}
```

```typescript
// app/chat/page.tsx (Client)
"use client";
import { useChat } from "@ai-sdk/react";

export default function ChatPage() {
	const { messages, input, handleSubmit, handleInputChange } = useChat({
		api: "/api/agent",
	});

	return (
		<form onSubmit={handleSubmit}>
			{messages.map((m) => (
				<div key={m.id}>{m.content}</div>
			))}
			<input value={input} onChange={handleInputChange} />
		</form>
	);
}
```

**Key Next.js Patterns** (research before using):

-   Server Actions vs API Routes for AI streaming
-   `useChat` / `useAgent` / `useCompletion` hooks
-   Server/Client component boundaries
-   Streaming with Suspense

**Research**: [Next.js App Router Docs](https://nextjs.org/docs)

---

### AI Elements (UI Components)

**When to include**: Patterns that need specialized AI UI (streaming text, artifacts, suggestions).

AI Elements provides pre-built components for common AI UX patterns. Research available components before building custom UI.

**Available Components** (verify latest):

-   `<Message>` - Chat message display
-   `<Artifact>` - Generated content preview
-   `<StreamingText>` - Animated text reveal
-   `<Suggestion>` - Quick action buttons
-   `<ToolInvocation>` - Tool call visualization

**Research**: [AI Elements Docs](https://ai-sdk.dev/elements)

---

### NestJS Backend Integration

**When to include**: Backend services, API orchestration, business logic.

**Module Structure**:

```
src/
  [feature]/
    [feature].module.ts      # Feature module
    [feature].service.ts     # Business logic
    [feature].controller.ts  # API endpoints
  agents/
    [agent-name].agent.ts    # Agent definitions
```

**Example: Agent Service**

```typescript
// src/agents/support.agent.ts
import { ToolLoopAgent } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";

export const supportAgent = new ToolLoopAgent({
	model: openrouter.languageModel("google/gemini-2.5-flash"),
	instructions: "You are a support agent.",
	tools: {
		// Define tools
	},
});
```

```typescript
// src/support/support.service.ts
import { Injectable } from "@nestjs/common";
import { supportAgent } from "@/agents/support.agent";

@Injectable()
export class SupportService {
	async handleQuery(messages: any[]) {
		const result = await supportAgent.generate({
			messages,
		});
		return result;
	}
}
```

**Key NestJS Patterns** (research before using):

-   Dependency injection for agents
-   Guards for authentication
-   Interceptors for logging/telemetry
-   Exception filters for error handling

**Research**: [NestJS Docs](https://docs.nestjs.com/)

---

### Integration Tips

**Agent + Next.js**:

-   Use API routes for streaming (`createAgentUIStreamResponse`)
-   Use Server Actions for simple, non-streaming agent calls
-   Always handle loading/error states in UI

**Agent + NestJS**:

-   Define agents in dedicated `/agents` directory
-   Inject agent configuration via `ConfigService`
-   Use services to wrap agent execution with business logic

**Memory Patterns**:

-   **Short-term**: Pass conversation history to agent
-   **Long-term**: Use vector stores (see RAG patterns)
-   **Working memory**: Session-based state in backend service

**Codebase Example**:

-   **File**: `[path/to/file.ts]`
-   **Description**: [How this codebase implements the pattern]

---

## Research & Benchmarks

### Academic Research (2024-2025)

#### [Research Paper/Framework 1]

**Paper**: "[Title]"

-   **Authors**: [Names]
-   **Source**: [ArXiv/Conference]
-   **Key Innovation**: [What they discovered]
-   **Results**: [Metrics/improvements]

[2-3 more research sections]

### Production Benchmarks

**Test Case**: [Realistic scenario]

| Metric         | Baseline | With Pattern | Improvement |
| -------------- | -------- | ------------ | ----------- |
| **[Metric 1]** | [Value]  | [Value]      | **[%]**     |
| **[Metric 2]** | [Value]  | [Value]      | **[%]**     |
| **[Metric 3]** | [Value]  | [Value]      | **[%]**     |

---

## When to Use This Pattern

### ✅ Use When:

1. **[Scenario 1]**

    - [Specific condition]
    - [Example use case]

2. **[Scenario 2]**
    - [Specific condition]
    - [Example use case]

### ❌ Don't Use When:

1. **[Scenario 1]**

    - [Why it's not suitable]
    - [Better alternative]

2. **[Scenario 2]**
    - [Why it's not suitable]
    - [Better alternative]

### Decision Matrix

| Your Situation | Recommended Approach |
| -------------- | -------------------- |
| [Condition 1]  | [Pattern variant]    |
| [Condition 2]  | [Pattern variant]    |
| [Condition 3]  | [Alternative]        |

---

## Production Best Practices

### 1. [Best Practice Category]

**CODE GUIDANCE**: Most best practices can be explained with prose + ASCII diagrams. Reserve code for:

-   Performance-critical implementations
-   Non-obvious error handling
-   Subtle bugs that bite in production

```typescript
// ONLY show code if the best practice is fundamentally about implementation
// Focus on the critical 2-3 lines that matter, not boilerplate
[Minimal code example - use sparingly]
```

**Why**: [Rationale]
**Impact**: [Metric/benefit]

### 2. [Best Practice Category]

[Repeat above]

### 3. Common Pitfalls

**PRINCIPLE**: Show pitfalls through impact/consequences, not just code comparison.

#### ❌ Pitfall 1: [What not to do]

Describe the problem and its consequences. Code optional unless the issue is hidden in implementation.

```typescript
// BAD - only include if code makes the issue obvious
[Anti-pattern code - use only when necessary]
```

**Problem**: [Why this fails, with real-world impact]

#### ✅ Solution: [Correct approach]

Explain the solution conceptually first. Code optional unless showing a non-obvious fix.

```typescript
// GOOD - only include if solution has subtle implementation details
[Correct code - use only when adds value]
```

**Benefit**: [Why this works, with measurable improvement]

---

## Observability & Debugging

[This section is OPTIONAL - include for agent/autonomous patterns, ReAct loops, tool orchestration, multi-agent systems]

### Logging Strategy

**Key Principle**: Log agent decisions, not just data flow. Capture reasoning traces.

**What to Log**:

-   Agent step type (think/act/observe)
-   Tool calls with parameters
-   Token usage per step
-   Execution time per step
-   Error context (what agent was trying to do)

**CODE NOTE**: Skip showing logger implementation - engineers know how to log. Focus on WHAT to log (the strategy), not HOW (the syntax).

```typescript
// ONLY include code if showing non-obvious logging pattern
// Example: "Log token usage incrementally to detect runaway costs"
[Minimal example showing the unique logging strategy - optional]
```

**Why**: Agent failures are non-deterministic. Comprehensive logging enables debugging production issues.

**Impact**: Reduces mean time to resolution (MTTR) by 60-80% for agent-related incidents.

### Testing Approach

**Key Principle**: Test agent behavior patterns, not exact outputs. LLM responses are non-deterministic.

**What to Test**:

-   Tool selection (did agent call the right tool?)
-   Error recovery (does agent handle failures gracefully?)
-   Loop prevention (does agent stop after max steps?)
-   Output structure (is format correct, even if content varies?)

**CODE NOTE**: Testing agents is fundamentally different. Include code ONLY to show testing strategy, not syntax.

```typescript
// ONLY include if showing unique testing pattern for LLMs
// Example: "Assert tool was called, not exact output text"
[Minimal test example showing the pattern - optional]
```

**Why**: Traditional unit tests fail with LLMs. Test for behavior patterns, not exact outputs.

### Common Failure Modes

1. **Infinite Loops**: Agent repeatedly calls same tool without progress

    - **Detection**: Track step count, detect repeated tool calls
    - **Mitigation**: Implement `maxSteps` limit, detect stuck patterns

2. **Hallucinated Tool Calls**: Agent invokes non-existent tools

    - **Detection**: Validate tool names before execution
    - **Mitigation**: Use structured tool schemas (Zod), provide tool registry

3. **Tool Misuse**: Agent passes invalid parameters
    - **Detection**: Validate parameters against schema
    - **Mitigation**: Use Zod validation, provide clear tool descriptions

### Monitoring Metrics

**Key Metrics to Track**:

| Metric                    | Target | Alert Threshold |
| ------------------------- | ------ | --------------- |
| **Success Rate**          | >90%   | <85%            |
| **Avg Steps per Task**    | 3-5    | >10             |
| **Token Usage per Task**  | <2000  | >5000           |
| **Latency (p95)**         | <5s    | >10s            |
| **Cost per Conversation** | <$0.10 | >$0.50          |

**Implementation Strategy**:

Track these metrics at the orchestration layer. Key insight: Monitor step count and token usage incrementally to detect runaway agents before they burn budget.

**CODE NOTE**: Engineers know how to call `metrics.increment()`. Skip implementation unless showing unique monitoring pattern (e.g., "Track token usage per step, not just total").

---

## Token Efficiency

[This section is OPTIONAL - include for prompt/context-heavy patterns, RAG, long-context management, prompt engineering]

### Context Size Impact

**Example**: RAG pattern with document retrieval

```
Without optimization:
- System prompt: 500 tokens
- User query: 50 tokens
- Retrieved docs: 8000 tokens
- Total: 8550 tokens per request

With compression:
- System prompt: 500 tokens
- User query: 50 tokens
- Compressed docs: 2000 tokens (75% reduction)
- Total: 2550 tokens per request
```

**Impact**: 70% token reduction = 70% cost reduction at scale.

### Optimization Strategies

#### 1. Context Compression

**Strategy**: Compress retrieved documents before sending to LLM. Most RAG results contain redundant information.

**Approach**:

```
Retrieved: 8,000 tokens → Compress → 2,000 tokens (75% reduction)
```

**Implementation**: Use summarization to condense documents while preserving key facts. Set target token budget based on context window.

**CODE NOTE**: Skip showing compression implementation. Focus on the strategy (when/why to compress) and savings (50-70% reduction).

**Savings**: 50-70% token reduction with <5% accuracy loss.

#### 2. Lazy Context Loading

**Strategy**: Don't load full context upfront. Give agents tools to fetch data on-demand.

**Pattern**:

```
Traditional: Load all 10,000 docs → Send to agent (expensive)
Lazy:        Agent requests specific docs via tool (cheap)
```

**Key Insight**: Most tasks only need 10-20% of available context. Let agent decide what to load.

**CODE NOTE**: Engineers understand tool calling. Skip code unless showing unique lazy-loading pattern.

**Savings**: 40-60% token reduction for multi-step tasks.

#### 3. Prompt Template Optimization

**Strategy**: Remove filler words from prompts. Every word costs money at scale.

**Example**:

```
❌ Verbose (72 tokens):
"You are a highly capable and helpful AI assistant designed to provide accurate information. Your primary objective is to answer user questions thoroughly..."

✅ Concise (8 tokens):
"Answer accurately with citations: ${query}"
```

**Why**: Every token costs money. Remove unnecessary words. Engineers can figure out the syntax - focus on the principle.

**Savings**: 20-30% token reduction per request.

### Cost at Scale

**Scenario**: Customer support chatbot handling user queries

**Baseline** (no optimization):

-   1M queries/month
-   Avg 2000 tokens/query
-   Cost: $5/1M tokens (GPT-4o)
-   **Monthly cost**: $10,000

**With Optimizations**:

-   Context compression: -50% tokens
-   Lazy loading: -30% tokens
-   Prompt optimization: -20% tokens
-   **Effective reduction**: ~70% tokens
-   **Monthly cost**: $3,000
-   **Savings**: $7,000/month ($84K/year)

**Break-even**: Optimization implementation takes 2 weeks. ROI positive after 1 month.

---

## Trade-offs & Considerations

### Advantages

1. **[Advantage 1]**: [Description with metric if available]
2. **[Advantage 2]**: [Description with metric if available]
3. **[Advantage 3]**: [Description with metric if available]

### Disadvantages

1. **[Disadvantage 1]**: [Description with mitigation strategy]
2. **[Disadvantage 2]**: [Description with mitigation strategy]

### Cost Analysis

**Example**: [Realistic scenario]

**Traditional Approach**:

```
- [Cost factor 1]: [Amount]
- [Cost factor 2]: [Amount]
- Total: [Amount]
```

**With This Pattern**:

```
- [Cost factor 1]: [Amount]
- [Cost factor 2]: [Amount]
- Total: [Amount]
- Savings: [Amount] ([%])
```

---

## Integration with Your Codebase

[This section is OPTIONAL - only include if you have direct examples]

### Current Implementation

**File**: `[path/to/file.ts]`

[Brief description of how your codebase uses this pattern]

### Enhancement Opportunities

1. **[Enhancement 1]**: [What could be improved]
    - **Current**: [Current approach]
    - **Recommended**: [Better approach]
    - **Benefit**: [Why it's better]

[Optional: Code examples showing before/after]

---

## Key Takeaways

1. **[Core Insight 1]** - [One sentence]
2. **[Core Insight 2]** - [One sentence]
3. **[Core Insight 3]** - [One sentence]
4. **[Core Insight 4]** - [One sentence]

**Quick Implementation Checklist**:

-   [ ] [First step]
-   [ ] [Second step]
-   [ ] [Third step]
-   [ ] [Fourth step]

---

## References

1. **[Paper/Framework 1]**: [Authors], "[Title]", [Venue/Date], [URL]
2. **[Paper/Framework 2]**: [Authors], "[Title]", [Venue/Date], [URL]
3. **[Paper/Framework 3]**: [Authors], "[Title]", [Venue/Date], [URL]

[Continue numbered list]

---

**Related Topics**:

-   [Link to previous topic in sequence]
-   [Link to next topic in sequence]
-   [Link to related topic in different layer]

**Layer Index**: [Layer N: Layer Name](docs/AI_KNOWLEDGE_BASE_TOC.md#layer-n)

---
````

## Usage Guidelines

### Section Flexibility

**✅ Required Sections** (always include):

-   Header with TL;DR
-   Overview
-   The Problem
-   Core Concept
-   Implementation Patterns (at least 1)
-   When to Use
-   Key Takeaways
-   References

**⚡ Optional Sections** (include when relevant):

-   **Table of Contents** (recommended for documents >500 lines, helps navigation)
-   **Framework Integration** (ONLY if framework has special requirements - skip if pattern is framework-agnostic)
-   Research & Benchmarks (if heavily research-based topics)
-   Production Best Practices (for implementation-focused topics)
-   Integration with Your Codebase (when you have direct examples)
-   **Observability & Debugging** (for agent/autonomous patterns, ReAct loops, tool orchestration, multi-agent systems)
-   **Token Efficiency** (for prompt/context-heavy patterns, RAG, long-context management, prompt engineering)

**CODE USAGE PHILOSOPHY**:

-   Assume your reader is a senior engineer who knows basic patterns
-   Code examples should teach something unique, not demonstrate syntax
-   When tempted to add code, ask: "Does this show something they couldn't figure out in 30 seconds?"
-   Prefer ASCII diagrams + prose over code for architectural concepts
-   Use code to show gotchas, edge cases, and performance-critical details

**🔄 Flexible Sections** (adapt to content):

-   "The Problem" can be shorter for well-understood issues
-   "Implementation Patterns" can have 1-5 patterns depending on complexity
-   "Research" can be merged into "Overview" for simpler topics

### Length Guidelines

-   **Theoretical topics** (Layer 0-2): 400-700 lines
-   **Implementation topics** (Layer 3-9): 700-1200 lines
-   **Advanced topics** (Layer 10-12): 500-900 lines

### Content Types

**For Theoretical Content:**

-   Focus on "Core Concept" and "Research & Benchmarks"
-   Lighter on "Implementation Patterns"
-   More diagrams and conceptual explanations

**For Code-Heavy Content:**

-   Focus on "Implementation Patterns" and "Framework Integration"
-   Multiple code examples across frameworks
-   Lighter on theoretical background

**For Production Patterns:**

-   Focus on "Production Best Practices" and "Trade-offs"
-   Real metrics and cost analysis
-   Integration with existing codebase

**For Agent/Autonomous Patterns:**

-   Include "Observability & Debugging" section (logging, testing, monitoring)
-   Focus on failure modes and recovery strategies
-   Emphasize non-deterministic behavior handling
-   Examples: ReAct loops, tool orchestration, multi-agent systems

**For Prompt/Context-Heavy Patterns:**

-   Include "Token Efficiency" section (optimization strategies, cost analysis)
-   Focus on context management and compression techniques
-   Provide real cost calculations at scale
-   Examples: RAG, long-context management, prompt engineering

### Visual Elements

Use these liberally:

**Emoji Indicators:**

-   ✅ Good practice / Use when
-   ❌ Bad practice / Don't use when
-   🚧 In progress
-   ⏳ Pending
-   ⚡ Optional
-   🔄 Flexible

**Code Formatting:**

**PRINCIPLE: Code is expensive to read. Use sparingly.**

```typescript
// Only include code that:
// 1. Shows non-obvious implementation
// 2. Demonstrates critical error handling
// 3. Reveals performance patterns
//
// Skip code for:
// - Basic API calls
// - Standard CRUD
// - Obvious patterns
//
// When you do include code:
// - Keep it under 20 lines
// - Focus on the critical 2-3 lines
// - Mark with comments: BAD vs GOOD
```

**Visual Diagrams:**

**CRITICAL: Use ASCII diagrams ONLY. Never use Mermaid.**

**ASCII Diagram Library** (copy these patterns):

**Linear Flow:**

```
Input → Process → Output
```

**Branching:**

```
     Input
       ↓
   Decision
   ├─ Path A → Result A
   └─ Path B → Result B
```

**Loop:**

```
  ┌───── LOOP ─────┐
  ↓                │
Start → Step → End │
  │                │
  └─ Continue? ────┘
     ↓ Stop
   Result
```

**Hierarchy:**

```
      Root
       ├── Child A
       │    ├── Grandchild 1
       │    └── Grandchild 2
       └── Child B
```

**System/Components:**

```
┌──────────┐      ┌──────────┐
│ Module A │─────▶│ Module B │
└──────────┘      └──────────┘
     │                  │
     ↓                  ↓
┌──────────┐      ┌──────────┐
│ Module C │      │ Module D │
└──────────┘      └──────────┘
```

**Data Transformation:**

```
"raw text" → [tokens] → [embeddings] → output
```

**Decision Rule:**

-   Keep diagrams under 15 lines
-   Use boxes for components, arrows for flow
-   Break complex diagrams into multiple simple ones
-   Test in monospace font before finalizing

**Tables:**
Use for comparisons, benchmarks, decision matrices

### Citation Format

Use numbered footnotes at bottom:

```markdown
Text with citation[^1].

More text with another citation[^2].

---

## References

1. **Author et al.** (2025). "Title". _Source_. https://url.com
2. **Author et al.** (2024). "Title". _Conference_. https://url.com
```

### Writing Style

1. **Start broad, go deep**: TL;DR → Overview → Problem → Solution → Details
2. **Be concrete**: Use real examples, metrics, and ASCII diagrams
3. **Minimize code**: Only show code for non-obvious implementations, gotchas, or performance-critical patterns
4. **Cite heavily**: Ground in 2024-2025 research
5. **Stay practical**: Focus on production-ready patterns
6. **Keep it scannable**: Use headers, bullets, and visual elements
7. **Enable navigation**: Include Table of Contents for documents >500 lines (many editors can auto-generate)
8. **Respect engineer time**: Assume senior engineers - don't explain basic syntax, show unique insights only

### Quality Checklist

Before marking a doc as "Complete", ensure:

-   [ ] TL;DR is one sentence and captures the essence
-   [ ] Problem is clearly stated with concrete example
-   [ ] At least one implementation pattern (code optional - only if adds unique value)
-   [ ] "When to Use" section with ✅ and ❌ scenarios
-   [ ] Minimum 3 research citations from 2024-2025
-   [ ] Key Takeaways summarize in 3-5 bullets
-   [ ] Related topics linked at bottom
-   [ ] **ASCII diagrams used exclusively (no Mermaid)**
-   [ ] **Code included only when teaching non-obvious patterns** (not for syntax examples)
-   [ ] Code examples use TypeScript (when included)
-   [ ] Metrics included where applicable (%, time, cost)
-   [ ] Proofread for consistency and clarity
-   [ ] Versions pinned in header
-   [ ] Table of Contents included (if document >500 lines)
-   [ ] **Document respects engineer time - no unnecessary boilerplate code**

---
