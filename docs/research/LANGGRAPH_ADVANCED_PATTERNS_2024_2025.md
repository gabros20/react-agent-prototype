# LangGraph Advanced Patterns 2024-2025

**Research Date:** January 5, 2026
**Focus:** Advanced graph-based orchestration patterns beyond basic LangGraph usage

## Table of Contents

1. [Advanced StateGraph Patterns](#1-advanced-stategraph-patterns)
2. [Dynamic Routing with Command API](#2-dynamic-routing-with-command-api)
3. [Send API: Map-Reduce & Parallel Execution](#3-send-api-map-reduce--parallel-execution)
4. [Subgraph Composition](#4-subgraph-composition)
5. [Human-in-the-Loop Patterns](#5-human-in-the-loop-patterns)
6. [State Persistence & Checkpointing](#6-state-persistence--checkpointing)
7. [Streaming Modes](#7-streaming-modes)
8. [Dynamic Graph Construction](#8-dynamic-graph-construction)
9. [Comparison with Alternatives](#9-comparison-with-alternatives)
10. [Production Deployment Patterns](#10-production-deployment-patterns)

---

## 1. Advanced StateGraph Patterns

### 1.1 Core Concepts

StateGraph is LangGraph's main graph class, parameterized by a user-defined State object. Unlike traditional DAGs (Directed Acyclic Graphs), LangGraph supports **cyclic graphs** for agent workflows where the flow isn't known in advance.

```ascii
Traditional DAG:          LangGraph Cyclic Graph:
A → B → C → D            A → B → C → D
                          ↑       ↓
                          F ← E ←┘
```

### 1.2 Python: Advanced State Management

```python
from typing import TypedDict, Annotated, Sequence
from operator import add
from langgraph.graph import StateGraph, START, END

# Advanced state with multiple reducers
class ResearchState(TypedDict):
    # Simple overwrite (default)
    query: str

    # Append-only list (accumulate results)
    sources: Annotated[list[str], add]

    # Custom reducer for conflict resolution
    metadata: Annotated[dict, lambda x, y: {**x, **y}]

    # Counter with increment
    iterations: Annotated[int, lambda x, y: x + y]

def researcher_node(state: ResearchState) -> ResearchState:
    """Each node returns partial state updates."""
    return {
        "sources": [f"source_{state['iterations']}"],
        "iterations": 1,  # Increment counter
        "metadata": {"last_node": "researcher"}
    }

def validator_node(state: ResearchState) -> ResearchState:
    return {
        "metadata": {"validated": True}
    }

# Build graph
builder = StateGraph(ResearchState)
builder.add_node("researcher", researcher_node)
builder.add_node("validator", validator_node)
builder.add_edge(START, "researcher")
builder.add_edge("researcher", "validator")
builder.add_edge("validator", END)

graph = builder.compile()
```

### 1.3 TypeScript: Channels and Reducers

```typescript
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";

// Define state with custom reducers
const ResearchState = Annotation.Root({
  query: Annotation<string>(),

  // Accumulate sources (like Python's add)
  sources: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),

  // Merge metadata
  metadata: Annotation<Record<string, any>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({})
  }),

  // Increment counter
  iterations: Annotation<number>({
    reducer: (current, update) => current + update,
    default: () => 0
  })
});

const researcherNode = async (state: typeof ResearchState.State) => {
  return {
    sources: [`source_${state.iterations}`],
    iterations: 1,
    metadata: { last_node: "researcher" }
  };
};

const validatorNode = async (state: typeof ResearchState.State) => {
  return {
    metadata: { validated: true }
  };
};

// Build graph
const workflow = new StateGraph(ResearchState)
  .addNode("researcher", researcherNode)
  .addNode("validator", validatorNode)
  .addEdge(START, "researcher")
  .addEdge("researcher", "validator")
  .addEdge("validator", END);

const graph = workflow.compile();
```

### 1.4 Pattern: Conditional Edges

Conditional edges determine which node to execute next based on current state.

```python
from langgraph.graph import StateGraph, START, END

class AgentState(TypedDict):
    messages: Annotated[list, add]
    next_action: str
    retry_count: int

def should_continue(state: AgentState) -> str:
    """Router function that returns next node name."""
    if state["retry_count"] >= 3:
        return "error_handler"

    if state["next_action"] == "search":
        return "search_node"
    elif state["next_action"] == "synthesize":
        return "synthesizer_node"
    else:
        return END

builder = StateGraph(AgentState)
builder.add_node("agent", agent_node)
builder.add_node("search_node", search_node)
builder.add_node("synthesizer_node", synthesizer_node)
builder.add_node("error_handler", error_handler)

# Add conditional edge from agent
builder.add_conditional_edges(
    "agent",
    should_continue,  # Router function
    {
        "search_node": "search_node",
        "synthesizer_node": "synthesizer_node",
        "error_handler": "error_handler",
        END: END
    }
)

builder.add_edge(START, "agent")
graph = builder.compile()
```

**TypeScript equivalent:**

```typescript
const shouldContinue = (state: typeof AgentState.State): string => {
  if (state.retry_count >= 3) return "error_handler";
  if (state.next_action === "search") return "search_node";
  if (state.next_action === "synthesize") return "synthesizer_node";
  return END;
};

workflow.addConditionalEdges(
  "agent",
  shouldContinue,
  {
    "search_node": "search_node",
    "synthesizer_node": "synthesizer_node",
    "error_handler": "error_handler",
    [END]: END
  }
);
```

**When to use:** Complex routing logic, multi-agent handoffs, error recovery paths.

---

## 2. Dynamic Routing with Command API

### 2.1 Overview

**Released:** Late 2024
**Purpose:** Eliminate boilerplate conditional edges by combining state updates + routing in a single return value

Traditional approach requires separate conditional edges:
```ascii
Node A → Conditional Edge → [Node B | Node C | Node D]
         (separate function)
```

Command API approach:
```ascii
Node A (returns Command) → Node B | Node C | Node D
       (routing embedded)
```

### 2.2 Python: Command API

```python
from langgraph.types import Command
from langgraph.graph import StateGraph, START, END

class AgentState(TypedDict):
    messages: list[str]
    task_type: str
    result: str

def orchestrator_node(state: AgentState) -> Command:
    """Node returns Command object with state updates + routing."""
    task = analyze_task(state["messages"])

    # Determine next node and return Command
    if task == "research":
        return Command(
            update={"task_type": "research"},
            goto="research_agent"  # Dynamic routing
        )
    elif task == "code":
        return Command(
            update={"task_type": "coding"},
            goto="code_agent"
        )
    else:
        return Command(
            update={"result": "Task completed"},
            goto=END
        )

def research_agent(state: AgentState) -> Command:
    result = perform_research(state["messages"])
    # Agent can decide to route back or continue
    return Command(
        update={"result": result, "messages": [result]},
        goto="orchestrator_node"  # Route back to orchestrator
    )

def code_agent(state: AgentState) -> Command:
    code = generate_code(state["messages"])
    return Command(
        update={"result": code},
        goto=END
    )

# Build EDGELESS graph
builder = StateGraph(AgentState)
builder.add_node("orchestrator_node", orchestrator_node)
builder.add_node("research_agent", research_agent)
builder.add_node("code_agent", code_agent)

# Only need START edge - no conditional edges!
builder.add_edge(START, "orchestrator_node")

graph = builder.compile()
```

### 2.3 TypeScript: Command Pattern

```typescript
import { Command } from "@langchain/langgraph";

const orchestratorNode = async (state: typeof AgentState.State): Promise<Command> => {
  const task = analyzeTask(state.messages);

  if (task === "research") {
    return new Command({
      update: { task_type: "research" },
      goto: "research_agent"
    });
  } else if (task === "code") {
    return new Command({
      update: { task_type: "coding" },
      goto: "code_agent"
    });
  }

  return new Command({
    update: { result: "Task completed" },
    goto: END
  });
};

const researchAgent = async (state: typeof AgentState.State): Promise<Command> => {
  const result = await performResearch(state.messages);

  return new Command({
    update: {
      result,
      messages: [...state.messages, result]
    },
    goto: "orchestrator_node"  // Dynamic handoff
  });
};

// Build graph - no conditional edges needed
const workflow = new StateGraph(AgentState)
  .addNode("orchestrator_node", orchestratorNode)
  .addNode("research_agent", researchAgent)
  .addNode("code_agent", codeAgent)
  .addEdge(START, "orchestrator_node");
```

### 2.4 Multi-Agent Handoffs with Command

```python
def supervisor_agent(state: AgentState) -> Command:
    """Supervisor routes to specialist agents."""
    task = classify_task(state["task"])

    # Direct handoff to specialist
    specialist_map = {
        "database": "db_specialist",
        "frontend": "ui_specialist",
        "backend": "api_specialist"
    }

    return Command(
        update={
            "assigned_to": specialist_map[task],
            "metadata": {"supervisor_decision": task}
        },
        goto=specialist_map[task]
    )

def db_specialist(state: AgentState) -> Command:
    result = handle_database_task(state)

    # Check if needs review
    if result["needs_review"]:
        return Command(
            update={"result": result, "status": "needs_review"},
            goto="supervisor_agent"  # Hand back to supervisor
        )

    return Command(
        update={"result": result, "status": "complete"},
        goto=END
    )
```

**Benefits:**
- **Reduced boilerplate:** No separate routing functions
- **Clearer intent:** Routing logic lives with business logic
- **Easier debugging:** Single function to inspect
- **Multi-agent handoffs:** Agents explicitly transfer control

**When to use:** Multi-agent systems, complex routing, supervisor-worker patterns, dynamic workflows.

---

## 3. Send API: Map-Reduce & Parallel Execution

### 3.1 Overview

The **Send API** enables dynamic parallelization where the number of parallel tasks is determined at runtime based on state.

```ascii
Traditional Fanout (static):     Send API (dynamic):
     A                                A
    /|\                               |
   B C D                          [Router]
    \|/                           /   |   \
     E                          B1   B2   B3...Bn
                                 \   |   /
                                    [E]
```

### 3.2 Python: Map-Reduce Pattern

```python
from langgraph.types import Send
from langgraph.graph import StateGraph, START, END

class MapReduceState(TypedDict):
    documents: list[str]
    chunks: list[str]
    summaries: Annotated[list[str], add]  # Accumulate results
    final_summary: str

def split_documents(state: MapReduceState) -> Command[Literal["process_chunk"]]:
    """Map phase: Split work into parallel tasks."""
    chunks = []
    for doc in state["documents"]:
        # Split document into chunks
        doc_chunks = chunk_document(doc, chunk_size=1000)
        chunks.extend(doc_chunks)

    # Return Send objects for parallel execution
    # Each Send creates a separate parallel invocation
    return [
        Send("process_chunk", {"chunks": [chunk]})
        for chunk in chunks
    ]

def process_chunk(state: MapReduceState) -> MapReduceState:
    """Process individual chunk (runs in parallel)."""
    chunk = state["chunks"][0]
    summary = summarize_chunk(chunk)

    return {
        "summaries": [summary]  # Accumulated via reducer
    }

def aggregate_summaries(state: MapReduceState) -> MapReduceState:
    """Reduce phase: Combine parallel results."""
    all_summaries = "\n".join(state["summaries"])
    final = create_final_summary(all_summaries)

    return {
        "final_summary": final
    }

# Build map-reduce graph
builder = StateGraph(MapReduceState)
builder.add_node("split_documents", split_documents)
builder.add_node("process_chunk", process_chunk)
builder.add_node("aggregate_summaries", aggregate_summaries)

builder.add_edge(START, "split_documents")
# split_documents returns Send objects - automatic fanout
builder.add_edge("process_chunk", "aggregate_summaries")
builder.add_edge("aggregate_summaries", END)

graph = builder.compile()

# Execute
result = graph.invoke({
    "documents": ["doc1.txt", "doc2.txt", "doc3.txt"]
})
# process_chunk runs N times in parallel (one per chunk)
```

### 3.3 TypeScript: Dynamic Parallel Execution

```typescript
import { Send } from "@langchain/langgraph";

const splitDocuments = async (
  state: typeof MapReduceState.State
): Promise<Send[]> => {
  const chunks: string[] = [];

  for (const doc of state.documents) {
    const docChunks = chunkDocument(doc, 1000);
    chunks.push(...docChunks);
  }

  // Return array of Send objects for parallel execution
  return chunks.map(chunk =>
    new Send("process_chunk", { chunks: [chunk] })
  );
};

const processChunk = async (state: typeof MapReduceState.State) => {
  const chunk = state.chunks[0];
  const summary = await summarizeChunk(chunk);

  return {
    summaries: [summary]
  };
};

const aggregateSummaries = async (state: typeof MapReduceState.State) => {
  const allSummaries = state.summaries.join("\n");
  const final = await createFinalSummary(allSummaries);

  return {
    final_summary: final
  };
};

const workflow = new StateGraph(MapReduceState)
  .addNode("split_documents", splitDocuments)
  .addNode("process_chunk", processChunk)
  .addNode("aggregate_summaries", aggregateSummaries)
  .addEdge(START, "split_documents")
  .addEdge("process_chunk", "aggregate_summaries")
  .addEdge("aggregate_summaries", END);
```

### 3.4 Advanced: Conditional Distribution

```python
def smart_router(state: AgentState) -> list[Send]:
    """Conditionally distribute tasks based on state."""
    tasks = state["tasks"]

    sends = []
    for task in tasks:
        if task["type"] == "urgent":
            # Send urgent tasks to priority handler
            sends.append(Send("priority_handler", {"task": task}))
        elif task["complexity"] > 0.8:
            # Complex tasks go to specialist
            sends.append(Send("specialist_handler", {"task": task}))
        else:
            # Standard tasks to general handler
            sends.append(Send("general_handler", {"task": task}))

    return sends
```

### 3.5 Pattern: Parallel API Calls

```python
def fetch_all_sources(state: ResearchState) -> list[Send]:
    """Fetch multiple sources in parallel."""
    sources = state["source_urls"]

    return [
        Send("fetch_source", {"url": url, "timeout": 5})
        for url in sources
    ]

def fetch_source(state: ResearchState) -> ResearchState:
    """Fetch single source (runs in parallel)."""
    url = state["url"]
    content = fetch_url(url, timeout=state["timeout"])

    return {
        "fetched_content": [{"url": url, "content": content}]
    }
```

**Benefits:**
- **Dynamic parallelism:** Number of parallel tasks determined at runtime
- **Map-reduce patterns:** Natural fit for distributed processing
- **Resource efficiency:** Automatic concurrency management
- **Flexible routing:** Different tasks to different node types

**When to use:** Processing lists/collections, parallel API calls, document processing, multi-source research.

---

## 4. Subgraph Composition

### 4.1 Overview

Subgraphs are compiled graphs used as nodes in parent graphs, enabling modular, reusable workflows.

```ascii
Parent Graph:
┌─────────────────────────────────────┐
│  Start → Agent → [Subgraph] → End  │
│                      │              │
│                      ↓              │
│         ┌────────────────────┐     │
│         │ Node A → Node B    │     │
│         │   ↓         ↓      │     │
│         │ Node C → Node D    │     │
│         └────────────────────┘     │
└─────────────────────────────────────┘
```

### 4.2 Python: Nested Subgraphs

```python
from langgraph.graph import StateGraph, START, END

# Subgraph 1: Research Pipeline
class ResearchState(TypedDict):
    query: str
    sources: Annotated[list[str], add]
    analysis: str

def query_expansion(state: ResearchState) -> ResearchState:
    expanded = expand_query(state["query"])
    return {"query": expanded}

def source_retrieval(state: ResearchState) -> ResearchState:
    sources = retrieve_sources(state["query"])
    return {"sources": sources}

def source_analysis(state: ResearchState) -> ResearchState:
    analysis = analyze_sources(state["sources"])
    return {"analysis": analysis}

# Build research subgraph
research_builder = StateGraph(ResearchState)
research_builder.add_node("expand", query_expansion)
research_builder.add_node("retrieve", source_retrieval)
research_builder.add_node("analyze", source_analysis)
research_builder.add_edge(START, "expand")
research_builder.add_edge("expand", "retrieve")
research_builder.add_edge("retrieve", "analyze")
research_builder.add_edge("analyze", END)

research_subgraph = research_builder.compile()

# Subgraph 2: Synthesis Pipeline
class SynthesisState(TypedDict):
    analysis: str
    outline: str
    draft: str

def create_outline(state: SynthesisState) -> SynthesisState:
    outline = generate_outline(state["analysis"])
    return {"outline": outline}

def write_draft(state: SynthesisState) -> SynthesisState:
    draft = generate_draft(state["outline"])
    return {"draft": draft}

synthesis_builder = StateGraph(SynthesisState)
synthesis_builder.add_node("outline", create_outline)
synthesis_builder.add_node("draft", write_draft)
synthesis_builder.add_edge(START, "outline")
synthesis_builder.add_edge("outline", "draft")
synthesis_builder.add_edge("draft", END)

synthesis_subgraph = synthesis_builder.compile()

# Parent Graph: Compose subgraphs
class MainState(TypedDict):
    query: str
    sources: list[str]
    analysis: str
    outline: str
    draft: str

def main_router(state: MainState) -> str:
    if not state.get("analysis"):
        return "research"
    return "synthesis"

main_builder = StateGraph(MainState)

# Add compiled subgraphs as nodes
main_builder.add_node("research", research_subgraph)
main_builder.add_node("synthesis", synthesis_subgraph)

main_builder.add_conditional_edges(
    START,
    main_router,
    {"research": "research", "synthesis": "synthesis"}
)

main_builder.add_edge("research", "synthesis")
main_builder.add_edge("synthesis", END)

main_graph = main_builder.compile()
```

### 4.3 TypeScript: Multi-Agent Subgraphs

```typescript
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

// Subgraph: Code Review Agent
const CodeReviewState = Annotation.Root({
  code: Annotation<string>(),
  issues: Annotation<string[]>({
    reducer: (curr, update) => [...curr, ...update],
    default: () => []
  }),
  approved: Annotation<boolean>()
});

const lintCheck = async (state: typeof CodeReviewState.State) => {
  const issues = await runLinter(state.code);
  return { issues };
};

const securityCheck = async (state: typeof CodeReviewState.State) => {
  const secIssues = await runSecurityScan(state.code);
  return { issues: secIssues };
};

const approvalDecision = async (state: typeof CodeReviewState.State) => {
  return { approved: state.issues.length === 0 };
};

const reviewWorkflow = new StateGraph(CodeReviewState)
  .addNode("lint", lintCheck)
  .addNode("security", securityCheck)
  .addNode("decision", approvalDecision)
  .addEdge(START, "lint")
  .addEdge("lint", "security")
  .addEdge("security", "decision")
  .addEdge("decision", END);

const reviewSubgraph = reviewWorkflow.compile();

// Parent: CI/CD Pipeline
const CIPipelineState = Annotation.Root({
  code: Annotation<string>(),
  issues: Annotation<string[]>({
    reducer: (curr, update) => [...curr, ...update],
    default: () => []
  }),
  approved: Annotation<boolean>(),
  deployed: Annotation<boolean>()
});

const buildStep = async (state: typeof CIPipelineState.State) => {
  await runBuild(state.code);
  return {};
};

const deployStep = async (state: typeof CIPipelineState.State) => {
  if (state.approved) {
    await deploy(state.code);
    return { deployed: true };
  }
  return { deployed: false };
};

const pipelineWorkflow = new StateGraph(CIPipelineState)
  .addNode("build", buildStep)
  .addNode("review", reviewSubgraph)  // Subgraph as node
  .addNode("deploy", deployStep)
  .addEdge(START, "build")
  .addEdge("build", "review")
  .addEdge("review", "deploy")
  .addEdge("deploy", END);

const pipeline = pipelineWorkflow.compile();
```

### 4.4 State Transformation Between Graphs

When parent and subgraph have different schemas:

```python
class ParentState(TypedDict):
    user_input: str
    processed_output: str

class SubgraphState(TypedDict):
    input_text: str
    result: str

def transform_to_subgraph(state: ParentState) -> SubgraphState:
    """Transform parent state to subgraph state."""
    return {"input_text": state["user_input"]}

def transform_from_subgraph(subgraph_state: SubgraphState) -> ParentState:
    """Transform subgraph result back to parent."""
    return {"processed_output": subgraph_state["result"]}

# Use transformations
subgraph_node = research_subgraph.transform(
    input=transform_to_subgraph,
    output=transform_from_subgraph
)

parent_builder.add_node("subgraph", subgraph_node)
```

### 4.5 Streaming from Subgraphs

```python
# Stream subgraph events to parent
for event in graph.stream(
    {"query": "research topic"},
    stream_mode="updates",
    subgraphs=True  # Enable subgraph streaming
):
    # event contains subgraph node updates
    print(event)
```

**Benefits:**
- **Modularity:** Reusable workflow components
- **Team collaboration:** Different teams own different subgraphs
- **Testing:** Test subgraphs independently
- **Composition:** Build complex systems from simple parts

**When to use:** Multi-agent systems, complex pipelines, reusable workflows, team-based development.

---

## 5. Human-in-the-Loop Patterns

### 5.1 Overview

LangGraph's HITL is a **first-class feature** with native interrupt patterns introduced in v0.2.31+.

**Four HITL Design Patterns:**
1. **Approve/Reject:** Pause before critical operations
2. **Edit & Continue:** Modify state before resuming
3. **Time Travel:** Rewind to previous checkpoint
4. **Branching:** Fork workflow from interrupt point

### 5.2 Python: Basic Interrupt Pattern

```python
from langgraph.types import interrupt
from langgraph.checkpoint.memory import MemorySaver

class AgentState(TypedDict):
    messages: Annotated[list, add]
    action: str
    approved: bool

def agent_node(state: AgentState) -> AgentState:
    # Agent determines action
    action = decide_action(state["messages"])

    # Interrupt for approval
    human_feedback = interrupt({
        "action": action,
        "prompt": f"Agent wants to {action}. Approve?",
        "options": ["approve", "reject", "modify"]
    })

    # Wait for human response...
    # Execution pauses here and saves state

    return {
        "action": action,
        "approved": human_feedback == "approve"
    }

def execute_action(state: AgentState) -> AgentState:
    if state["approved"]:
        result = perform_action(state["action"])
        return {"messages": [result]}
    else:
        return {"messages": ["Action rejected by human"]}

# MUST use checkpointer for interrupts
checkpointer = MemorySaver()

builder = StateGraph(AgentState)
builder.add_node("agent", agent_node)
builder.add_node("execute", execute_action)
builder.add_edge(START, "agent")
builder.add_edge("agent", "execute")
builder.add_edge("execute", END)

graph = builder.compile(checkpointer=checkpointer)

# Execute with thread_id for state persistence
config = {"configurable": {"thread_id": "conversation-1"}}

# First invocation - runs until interrupt
for event in graph.stream({"messages": ["Start task"]}, config):
    print(event)
    # Pauses at interrupt() call

# Resume with human input
graph.update_state(
    config,
    {"approved": True},  # Human approval
    as_node="agent"
)

# Continue execution
for event in graph.stream(None, config):
    print(event)
```

### 5.3 TypeScript: Approval Flow

```typescript
import { interrupt } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";

const agentNode = async (state: typeof AgentState.State) => {
  const action = decideAction(state.messages);

  // Interrupt and wait for human approval
  const humanFeedback = interrupt({
    action,
    prompt: `Agent wants to ${action}. Approve?`,
    options: ["approve", "reject", "modify"]
  });

  return {
    action,
    approved: humanFeedback === "approve"
  };
};

const executeAction = async (state: typeof AgentState.State) => {
  if (state.approved) {
    const result = await performAction(state.action);
    return { messages: [result] };
  }
  return { messages: ["Action rejected by human"] };
};

const checkpointer = new MemorySaver();

const workflow = new StateGraph(AgentState)
  .addNode("agent", agentNode)
  .addNode("execute", executeAction)
  .addEdge(START, "agent")
  .addEdge("agent", "execute")
  .addEdge("execute", END);

const graph = workflow.compile({ checkpointer });

// Execute with streaming
const config = { configurable: { thread_id: "conv-1" } };

for await (const event of graph.stream(
  { messages: ["Start task"] },
  config
)) {
  console.log(event);
  // Pauses at interrupt
}

// Resume after human input
await graph.updateState(
  config,
  { approved: true },
  { asNode: "agent" }
);

// Continue
for await (const event of graph.stream(null, config)) {
  console.log(event);
}
```

### 5.4 Advanced: Edit Before Continue

```python
def risky_operation_node(state: AgentState) -> AgentState:
    # Prepare database query
    query = generate_sql_query(state["user_request"])

    # Show query to human for editing
    edited_query = interrupt({
        "type": "sql_review",
        "query": query,
        "message": "Review and edit SQL query before execution"
    })

    return {
        "sql_query": edited_query,
        "status": "awaiting_execution"
    }

# Human reviews and modifies state
graph.update_state(
    config,
    {"sql_query": "SELECT * FROM users WHERE safe_condition = true"},
    as_node="risky_operation_node"
)
```

### 5.5 Pattern: Multi-Step Approval Workflow

```python
class ApprovalState(TypedDict):
    action: str
    approvals: Annotated[list[dict], add]
    approved_by: Annotated[list[str], add]

def require_manager_approval(state: ApprovalState) -> Command:
    """First approval checkpoint."""
    manager_decision = interrupt({
        "type": "manager_approval",
        "action": state["action"],
        "required_role": "manager"
    })

    if manager_decision["approved"]:
        return Command(
            update={
                "approvals": [manager_decision],
                "approved_by": [manager_decision["user"]]
            },
            goto="require_director_approval"  # Route to next approval
        )

    return Command(
        update={"status": "rejected_by_manager"},
        goto=END
    )

def require_director_approval(state: ApprovalState) -> Command:
    """Second approval checkpoint."""
    director_decision = interrupt({
        "type": "director_approval",
        "action": state["action"],
        "manager_approval": state["approvals"][-1],
        "required_role": "director"
    })

    if director_decision["approved"]:
        return Command(
            update={
                "approvals": [director_decision],
                "approved_by": [director_decision["user"]]
            },
            goto="execute_action"
        )

    return Command(
        update={"status": "rejected_by_director"},
        goto=END
    )
```

### 5.6 Streaming with Interrupts

```python
# Use stream() for real-time updates during HITL
for chunk in graph.stream(
    {"messages": ["Execute sensitive operation"]},
    config,
    stream_mode=["values", "updates"]
):
    print(chunk)
    # Stream shows progress until interrupt
    # Client can show waiting state

# Check if interrupted
state_snapshot = graph.get_state(config)
if state_snapshot.next:  # Has pending nodes
    # Currently interrupted - waiting for human
    print(f"Waiting for input at: {state_snapshot.next}")
```

**Benefits:**
- **No polling:** Built into framework, not bolted on
- **Persistent state:** Survives server restarts (with proper checkpointer)
- **Multiple interrupts:** Support for sequential approval flows
- **Streaming compatible:** Works with real-time UX

**When to use:** Sensitive operations, compliance workflows, quality control, user confirmation.

---

## 6. State Persistence & Checkpointing

### 6.1 Overview

Checkpointers save graph state snapshots at every "super-step" (node execution), enabling:
- **Memory:** Resume conversations
- **Time travel:** Replay from any point
- **Fault tolerance:** Recover from failures
- **HITL:** Pause and resume workflows

```ascii
Execution Timeline with Checkpoints:
┌────┐    ┌────┐    ┌────┐    ┌────┐
│ C1 │ → │ C2 │ → │ C3 │ → │ C4 │
└────┘    └────┘    └────┘    └────┘
  ↓         ↓         ↓         ↓
[Node1]  [Node2]  [Node3]  [Node4]

Can resume from any checkpoint!
```

### 6.2 Python: Production PostgreSQL Checkpointer

```python
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg import Connection

# Production setup with connection pool
from psycopg_pool import ConnectionPool

pool = ConnectionPool(
    conninfo="postgresql://user:pass@localhost/dbname",
    min_size=1,
    max_size=10
)

# Use pool for automatic connection management
checkpointer = PostgresSaver(pool)

# Initialize tables (run once)
with pool.connection() as conn:
    checkpointer.setup(conn)

# Compile graph with checkpointer
graph = builder.compile(checkpointer=checkpointer)

# Execute with thread_id
config = {
    "configurable": {
        "thread_id": "user-123-conversation-5",
        "checkpoint_ns": "production"  # Optional namespace
    }
}

result = graph.invoke({"messages": ["Hello"]}, config)

# Later: Resume from same thread
result = graph.invoke({"messages": ["Continue"]}, config)
# State is automatically restored
```

### 6.3 TypeScript: PostgreSQL with Connection Pool

```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";

// Connection pool for production
const pool = new Pool({
  host: "localhost",
  database: "langgraph",
  user: "postgres",
  password: "password",
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const checkpointer = PostgresSaver.fromPool(pool);

// Setup tables
await checkpointer.setup();

// Compile graph
const graph = workflow.compile({ checkpointer });

// Execute with persistent thread
const config = {
  configurable: {
    thread_id: "user-123-conversation-5",
    checkpoint_ns: "production"
  }
};

const result = await graph.invoke(
  { messages: ["Hello"] },
  config
);

// Resume later
const resumed = await graph.invoke(
  { messages: ["Continue"] },
  config
);
```

### 6.4 Advanced: Checkpoint Management

```python
# Get checkpoint history
history = graph.get_state_history(config)

for checkpoint in history:
    print(f"Checkpoint ID: {checkpoint.config['configurable']['checkpoint_id']}")
    print(f"State: {checkpoint.values}")
    print(f"Next nodes: {checkpoint.next}")

# Time travel: Resume from specific checkpoint
specific_checkpoint_config = {
    "configurable": {
        "thread_id": "user-123",
        "checkpoint_id": "specific-checkpoint-uuid"
    }
}

# This creates a NEW fork from that checkpoint
forked_result = graph.invoke(
    {"messages": ["Try different path"]},
    specific_checkpoint_config
)

# Replay without re-executing
# LangGraph skips nodes that were already executed before checkpoint
replay_config = {
    "configurable": {
        "thread_id": "user-123",
        "checkpoint_id": "some-checkpoint"
    }
}

# Only executes nodes AFTER the checkpoint
result = graph.invoke(None, replay_config)
```

### 6.5 Pattern: Long-Running Workflows

```python
class WorkflowState(TypedDict):
    step: int
    data: dict
    retries: int

def long_running_node(state: WorkflowState) -> WorkflowState:
    try:
        result = expensive_operation(state["data"])
        return {
            "step": state["step"] + 1,
            "data": result,
            "retries": 0
        }
    except Exception as e:
        # Checkpoint saves state before crash
        raise

# Graph with checkpointer
graph = builder.compile(checkpointer=PostgresSaver(pool))

# Execute
try:
    result = graph.invoke({"step": 0, "data": {}}, config)
except Exception:
    # Server crashes or times out
    pass

# Resume from last checkpoint (even after restart)
result = graph.invoke(None, config)
# Automatically continues from last successful step
```

### 6.6 Storage Limits

| Backend | Max Field Size | Notes |
|---------|----------------|-------|
| PostgreSQL | 1 GB | Recommended for production |
| MongoDB | 16 MB | Document size limit |
| Redis | 512 MB | String value limit |
| SQLite | 1 GB | Good for development |

### 6.7 Cleanup Strategy

```python
# Implement TTL cleanup for old checkpoints
def cleanup_old_checkpoints(days: int = 30):
    with pool.connection() as conn:
        conn.execute("""
            DELETE FROM checkpoints
            WHERE created_at < NOW() - INTERVAL '%s days'
        """, [days])
```

**Benefits:**
- **Durable execution:** Workflows survive failures
- **Cost efficiency:** Don't re-execute expensive LLM calls
- **Debugging:** Inspect state at any point
- **Branching:** Fork workflows from any checkpoint

**When to use:** Always in production, long-running workflows, HITL, expensive operations.

---

## 7. Streaming Modes

### 7.1 Overview

LangGraph supports **5 streaming modes** for real-time updates:

| Mode | Returns | Use Case |
|------|---------|----------|
| `values` | Full state after each node | See complete state evolution |
| `updates` | State deltas (changes only) | Efficient incremental updates |
| `messages` | LLM tokens + metadata | Stream chat responses |
| `custom` | User-defined events | Application-specific events |
| `debug` | Detailed execution trace | Debugging and observability |

### 7.2 Python: Multiple Streaming Modes

```python
# Stream with multiple modes simultaneously
for chunk in graph.stream(
    {"messages": ["Research quantum computing"]},
    config,
    stream_mode=["values", "updates", "messages"]
):
    # chunk structure:
    # (stream_mode, data)

    mode, data = chunk

    if mode == "values":
        # Full state snapshot
        print(f"State: {data}")

    elif mode == "updates":
        # State delta for this node
        print(f"Update from node: {data}")

    elif mode == "messages":
        # LLM token stream
        # data = (message_chunk, metadata)
        message_chunk, metadata = data
        print(f"Token: {message_chunk.content}")
        print(f"Node: {metadata['langgraph_node']}")
```

### 7.3 TypeScript: Streaming with Metadata

```typescript
// Stream multiple modes
for await (const chunk of graph.stream(
  { messages: ["Research quantum computing"] },
  {
    ...config,
    streamMode: ["values", "updates", "messages"]
  }
)) {
  const [mode, data] = chunk;

  if (mode === "values") {
    console.log("Full state:", data);
  } else if (mode === "updates") {
    console.log("Node update:", data);
  } else if (mode === "messages") {
    const [messageChunk, metadata] = data;
    console.log("Token:", messageChunk.content);
    console.log("From node:", metadata.langgraph_node);
  }
}
```

### 7.4 Custom Streaming Events

```python
from langgraph.types import StreamWriter

def researcher_node(
    state: ResearchState,
    writer: StreamWriter
) -> ResearchState:
    """Node can emit custom events during execution."""

    # Emit progress updates
    writer("search_started", {"query": state["query"]})

    sources = search_sources(state["query"])
    writer("sources_found", {"count": len(sources)})

    for i, source in enumerate(sources):
        content = fetch_source(source)
        writer("source_fetched", {
            "progress": i + 1,
            "total": len(sources),
            "source": source
        })

    writer("search_completed", {"sources": len(sources)})

    return {"sources": sources}

# Stream custom events
for chunk in graph.stream(
    {"query": "AI trends"},
    config,
    stream_mode="custom"
):
    event_type, event_data = chunk
    print(f"{event_type}: {event_data}")
    # Output:
    # search_started: {'query': 'AI trends'}
    # sources_found: {'count': 5}
    # source_fetched: {'progress': 1, 'total': 5, ...}
    # ...
```

### 7.5 Debug Mode for Observability

```python
# Debug mode for production monitoring
for chunk in graph.stream(
    {"messages": ["Complex task"]},
    config,
    stream_mode="debug"
):
    debug_info = chunk

    # Rich debugging information:
    # - Node name
    # - Input state
    # - Output state
    # - Execution time
    # - Errors/exceptions
    # - Metadata

    log_to_observability_platform(debug_info)
```

### 7.6 Streaming from Subgraphs

```python
# Stream events from nested subgraphs
for chunk in graph.stream(
    {"query": "research topic"},
    config,
    stream_mode="updates",
    subgraphs=True  # Include subgraph events
):
    # chunk contains events from both parent and subgraphs
    # Metadata indicates source subgraph
    pass
```

### 7.7 Filter Streaming by Node

```python
# Only stream from specific nodes
for chunk in graph.stream(
    {"messages": ["task"]},
    config,
    stream_mode=["messages"]
):
    message_chunk, metadata = chunk

    # Filter to specific node
    if metadata["langgraph_node"] == "llm_agent":
        print(message_chunk.content)
        # Only show LLM agent's output
```

**Benefits:**
- **Real-time UX:** Show progress as it happens
- **Debugging:** Inspect execution in detail
- **Observability:** Monitor production workflows
- **Efficient:** Only stream what you need

**When to use:** Chat interfaces, progress indicators, debugging, monitoring.

---

## 8. Dynamic Graph Construction

### 8.1 Overview

While LangGraph graphs are compiled at startup, you can implement **runtime graph selection** and **configuration-driven graphs** for dynamic behavior.

### 8.2 Pattern: Graph Factory

```python
from typing import Literal

def create_agent_graph(
    agent_type: Literal["research", "coding", "customer_service"],
    capabilities: list[str]
) -> CompiledStateGraph:
    """Factory pattern for dynamic graph creation."""

    builder = StateGraph(AgentState)

    # Add base nodes
    builder.add_node("router", router_node)
    builder.add_edge(START, "router")

    # Dynamically add capability nodes
    if "web_search" in capabilities:
        builder.add_node("web_search", web_search_node)

    if "code_execution" in capabilities:
        builder.add_node("code_exec", code_execution_node)

    if "database_query" in capabilities:
        builder.add_node("db_query", database_query_node)

    # Agent-type-specific configuration
    if agent_type == "research":
        builder.add_node("synthesize", research_synthesize_node)
    elif agent_type == "coding":
        builder.add_node("test", run_tests_node)
        builder.add_node("lint", lint_code_node)

    # Dynamic routing based on capabilities
    def dynamic_router(state: AgentState) -> str:
        action = state["next_action"]
        if action in capabilities:
            return action
        return END

    builder.add_conditional_edges(
        "router",
        dynamic_router,
        {cap: cap for cap in capabilities}
    )

    return builder.compile(checkpointer=checkpointer)

# Create specialized agents at runtime
research_agent = create_agent_graph(
    "research",
    ["web_search", "synthesize"]
)

coding_agent = create_agent_graph(
    "coding",
    ["code_execution", "test", "lint"]
)

# Use based on request
def handle_request(request):
    if request["type"] == "research":
        return research_agent.invoke(request)
    else:
        return coding_agent.invoke(request)
```

### 8.3 Configuration-Driven Graphs

```python
import yaml
from typing import Dict, Callable

# graph_config.yaml
"""
name: customer_service_agent
nodes:
  - name: classifier
    function: classify_request
  - name: faq_handler
    function: handle_faq
  - name: ticket_creator
    function: create_ticket
  - name: escalation
    function: escalate_to_human

edges:
  - from: START
    to: classifier
  - from: classifier
    to: END
    condition: route_request

routing:
  classifier:
    faq: faq_handler
    complex: ticket_creator
    urgent: escalation
"""

class GraphBuilder:
    def __init__(self, node_registry: Dict[str, Callable]):
        self.node_registry = node_registry

    def build_from_config(self, config_path: str) -> CompiledStateGraph:
        with open(config_path) as f:
            config = yaml.safe_load(f)

        builder = StateGraph(AgentState)

        # Add nodes from config
        for node_config in config["nodes"]:
            node_fn = self.node_registry[node_config["function"]]
            builder.add_node(node_config["name"], node_fn)

        # Add edges from config
        for edge in config["edges"]:
            if "condition" in edge:
                # Conditional edge
                routing = config["routing"][edge["from"]]
                condition_fn = self.node_registry[edge["condition"]]
                builder.add_conditional_edges(
                    edge["from"],
                    condition_fn,
                    routing
                )
            else:
                # Static edge
                builder.add_edge(edge["from"], edge["to"])

        return builder.compile()

# Use
node_registry = {
    "classify_request": classifier_node,
    "handle_faq": faq_node,
    "create_ticket": ticket_node,
    "escalate_to_human": escalation_node,
    "route_request": route_function
}

builder = GraphBuilder(node_registry)
graph = builder.build_from_config("graph_config.yaml")
```

### 8.4 TypeScript: Plugin System

```typescript
interface GraphPlugin {
  name: string;
  nodes: Map<string, NodeFunction>;
  edges: Array<[string, string]>;
}

class DynamicGraphBuilder {
  private plugins: Map<string, GraphPlugin> = new Map();

  registerPlugin(plugin: GraphPlugin) {
    this.plugins.set(plugin.name, plugin);
  }

  buildGraph(pluginNames: string[]): CompiledStateGraph {
    const workflow = new StateGraph(AgentState);

    // Load and merge plugins
    for (const pluginName of pluginNames) {
      const plugin = this.plugins.get(pluginName);
      if (!plugin) continue;

      // Add plugin nodes
      for (const [nodeName, nodeFn] of plugin.nodes) {
        workflow.addNode(nodeName, nodeFn);
      }

      // Add plugin edges
      for (const [from, to] of plugin.edges) {
        workflow.addEdge(from, to);
      }
    }

    return workflow.compile();
  }
}

// Usage
const builder = new DynamicGraphBuilder();

// Register plugins
builder.registerPlugin({
  name: "web_search",
  nodes: new Map([
    ["search", searchNode],
    ["parse", parseNode]
  ]),
  edges: [["search", "parse"]]
});

builder.registerPlugin({
  name: "code_analysis",
  nodes: new Map([
    ["analyze", analyzeNode],
    ["suggest", suggestNode]
  ]),
  edges: [["analyze", "suggest"]]
});

// Build graph with selected plugins
const graph = builder.buildGraph(["web_search", "code_analysis"]);
```

### 8.5 Runtime Node Selection

```python
def create_dynamic_processor(
    state: ProcessingState
) -> Command:
    """Select processing node based on runtime data."""

    data_type = detect_data_type(state["data"])

    # Map data types to processing nodes
    processor_map = {
        "image": "image_processor",
        "text": "text_processor",
        "audio": "audio_processor",
        "video": "video_processor"
    }

    processor = processor_map.get(data_type, "generic_processor")

    return Command(
        update={"processor_type": data_type},
        goto=processor
    )

# Graph has all possible processors as nodes
# Router selects at runtime based on input
```

**Benefits:**
- **Flexibility:** Adapt to different use cases
- **Reusability:** Share node implementations
- **Configuration:** Non-developers can modify workflows
- **Multi-tenancy:** Different graphs per customer

**When to use:** Multi-tenant systems, plugin architectures, A/B testing, dynamic capabilities.

---

## 9. Comparison with Alternatives

### 9.1 LangGraph vs Temporal

| Aspect | LangGraph | Temporal |
|--------|-----------|----------|
| **Purpose** | AI agent workflows | General-purpose durable execution |
| **Persistence** | Checkpointing (manual triggers) | Automatic event sourcing |
| **Retry Logic** | Manual implementation | Declarative retry policies |
| **Language** | Python, TypeScript (limited) | Go, Java, PHP, TypeScript, Python |
| **Complexity** | Simple for prototypes | Production-grade from start |
| **LLM Focus** | Native LLM integration | Generic workflows |
| **Graph Visualization** | Built-in | Via Temporal UI |
| **Learning Curve** | Moderate | Steep |

**Temporal Migration Case Study (Grid Dynamics):**

*Before (LangGraph):*
```python
# Manual state management
state = redis_client.get(f"agent_state:{id}")
agent_state = json.loads(state)

# Manual retry logic everywhere
for attempt in range(3):
    try:
        result = call_llm(prompt)
        break
    except Exception as e:
        if attempt == 2:
            raise
        time.sleep(2 ** attempt)

# Manual persistence
redis_client.set(f"agent_state:{id}", json.dumps(agent_state))
```

*After (Temporal):*
```python
@workflow.defn
class ResearchWorkflow:
    @workflow.run
    async def run(self, query: str) -> str:
        # State passed automatically
        # No manual persistence
        result = await workflow.execute_activity(
            search_activity,
            query,
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                backoff_coefficient=2.0
            )  # Declarative retries
        )
        return result
```

**Result:** "Deleted thousands of lines of custom retry and error handling code."

### 9.2 LangGraph vs Inngest

| Aspect | LangGraph | Inngest |
|--------|-----------|---------|
| **Durable Execution** | Checkpoint-based | Built-in from ground up |
| **Retries** | Manual | Automatic per-step |
| **Caching** | Manual | Embedded (saves LLM costs) |
| **Observability** | Debug mode | Production-grade dashboard |
| **Concurrency Control** | Manual | Built-in throttling |
| **Streaming** | Native | `useAgent` hook for frontend |
| **Production Ready** | Requires work | Out of the box |

**Inngest Advantages for Production AI:**
```typescript
// Inngest: Automatic retries + caching
export const researchAgent = inngest.createFunction(
  { id: "research-agent" },
  { event: "research.request" },
  async ({ event, step }) => {
    // Each step is automatically:
    // - Retriable (no code needed)
    // - Cached (saves $$$ on retries)
    // - Observable (in dashboard)

    const sources = await step.run("fetch-sources", async () => {
      return await fetchSources(event.data.query);
    });

    const analysis = await step.run("analyze", async () => {
      return await llm.analyze(sources);  // Cached if retried
    });

    return analysis;
  }
);

// Frontend: Real-time streaming
const { output, isComplete } = useAgent({
  functionId: "research-agent",
  input: { query: "AI trends" }
});
```

### 9.3 LangGraph vs AI SDK v6

| Aspect | LangGraph | AI SDK v6 |
|--------|-----------|-----------|
| **Graph Model** | Explicit StateGraph | Implicit (via Agent class) |
| **Multi-Agent** | Subgraphs + Command | Agent composition |
| **TypeScript Support** | Limited | First-class |
| **React Integration** | Manual | `useAgent` hook |
| **Streaming** | 5 modes | Built-in |
| **Vercel Integration** | None | Native |
| **State Management** | Annotated state | Managed by Agent class |

**AI SDK v6 Agent Example:**

```typescript
import { Agent } from "ai";

// AI SDK: Simpler for TypeScript/React
const researchAgent = new Agent({
  model: openai("gpt-4"),
  instructions: "You are a research agent",
  tools: {
    search: searchTool,
    analyze: analyzeTool
  },
  maxSteps: 10
});

// Automatic orchestration
const result = await researchAgent.run({
  prompt: "Research quantum computing"
});

// React integration
function ResearchUI() {
  const { messages, isRunning } = useAgent({
    agent: researchAgent,
    onFinish: (result) => console.log(result)
  });

  return <ChatInterface messages={messages} />;
}
```

### 9.4 When to Choose What

**Choose LangGraph when:**
- Python-first team
- Need explicit control over graph structure
- Complex branching logic
- Deep LangChain integration
- Rapid prototyping of agent workflows

**Choose Temporal when:**
- Mission-critical workflows
- Need bulletproof durability
- Long-running processes (days/weeks)
- Multi-language team
- Complex distributed systems
- Budget for operational complexity

**Choose Inngest when:**
- TypeScript/React stack
- Production AI from day 1
- Need automatic retries + caching
- Want simple observability
- Serverless deployment
- Limited devops resources

**Choose AI SDK v6 when:**
- Vercel/Next.js stack
- TypeScript-first
- React integration critical
- Simpler agent workflows
- Prefer framework conventions

---

## 10. Production Deployment Patterns

### 10.1 Architecture: Scalable LangGraph

```ascii
Production LangGraph Architecture:

┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼───┐
│ API  │  │ API  │  (Horizontally scaled)
│Server│  │Server│
└───┬──┘  └──┬───┘
    │        │
    └────┬───┘
         │
┌────────▼───────────┐
│  Task Queue        │
│  (Redis/BullMQ)    │
└────────┬───────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼───┐
│Worker│  │Worker│  (Background execution)
└───┬──┘  └──┬───┘
    │        │
    └────┬───┘
         │
┌────────▼───────────┐
│  PostgreSQL        │
│  (Checkpoints)     │
└────────────────────┘
```

### 10.2 Kubernetes Deployment

```yaml
# langgraph-api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: langgraph-api
spec:
  replicas: 3  # Horizontal scaling
  selector:
    matchLabels:
      app: langgraph-api
  template:
    metadata:
      labels:
        app: langgraph-api
    spec:
      containers:
      - name: api
        image: myorg/langgraph-api:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: langgraph-secrets
              key: database-url
        - name: REDIS_URL
          value: redis://redis-service:6379
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10

---
# langgraph-worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: langgraph-worker
spec:
  replicas: 5  # Scale workers independently
  selector:
    matchLabels:
      app: langgraph-worker
  template:
    metadata:
      labels:
        app: langgraph-worker
    spec:
      containers:
      - name: worker
        image: myorg/langgraph-worker:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: langgraph-secrets
              key: database-url
        - name: REDIS_URL
          value: redis://redis-service:6379
        - name: WORKER_CONCURRENCY
          value: "10"
        resources:
          requests:
            memory: "1Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "4000m"
```

### 10.3 Connection Pool Management

```python
# production_checkpointer.py
from psycopg_pool import ConnectionPool
from langgraph.checkpoint.postgres import PostgresSaver
import os

# Production connection pool
pool = ConnectionPool(
    conninfo=os.getenv("DATABASE_URL"),
    min_size=2,
    max_size=20,  # Adjust based on concurrent workflows
    timeout=30,
    max_idle=300,  # Close idle connections after 5 minutes
    max_lifetime=3600,  # Recycle connections every hour
)

checkpointer = PostgresSaver(pool)

# Graceful shutdown
import atexit

def cleanup():
    pool.close()

atexit.register(cleanup)
```

### 10.4 Monitoring & Observability

```python
# observability.py
import time
from typing import Any
from langgraph.graph import StateGraph
from prometheus_client import Counter, Histogram

# Metrics
graph_invocations = Counter(
    "langgraph_invocations_total",
    "Total graph invocations",
    ["graph_name", "status"]
)

node_duration = Histogram(
    "langgraph_node_duration_seconds",
    "Node execution duration",
    ["graph_name", "node_name"]
)

def create_monitored_graph(builder: StateGraph) -> CompiledStateGraph:
    """Wrap graph with monitoring."""

    # Wrap each node with timing
    for node_name in builder._nodes:
        original_node = builder._nodes[node_name]

        def monitored_node(state: Any, _original=original_node):
            start = time.time()
            try:
                result = _original(state)
                duration = time.time() - start
                node_duration.labels(
                    graph_name=builder.name,
                    node_name=node_name
                ).observe(duration)
                return result
            except Exception as e:
                graph_invocations.labels(
                    graph_name=builder.name,
                    status="error"
                ).inc()
                raise

        builder._nodes[node_name] = monitored_node

    return builder.compile()

# Integration with OpenTelemetry
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

# Setup tracing
trace.set_tracer_provider(TracerProvider())
trace.get_tracer_provider().add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter())
)

tracer = trace.get_tracer(__name__)

def traced_node(state: AgentState) -> AgentState:
    with tracer.start_as_current_span("node_execution") as span:
        span.set_attribute("node.name", "researcher")
        span.set_attribute("state.query", state["query"])

        result = perform_work(state)

        span.set_attribute("result.sources", len(result["sources"]))
        return result
```

### 10.5 Error Handling & Circuit Breakers

```python
from typing import Callable
from datetime import datetime, timedelta

class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failures = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half-open

    def call(self, func: Callable, *args, **kwargs):
        if self.state == "open":
            if self._should_attempt_reset():
                self.state = "half-open"
            else:
                raise Exception("Circuit breaker is OPEN")

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        self.failures = 0
        self.state = "closed"

    def _on_failure(self):
        self.failures += 1
        self.last_failure_time = datetime.now()

        if self.failures >= self.failure_threshold:
            self.state = "open"

    def _should_attempt_reset(self) -> bool:
        return (
            datetime.now() - self.last_failure_time
        ).seconds >= self.recovery_timeout

# Use with external services
llm_circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60)

def llm_node_with_circuit_breaker(state: AgentState) -> AgentState:
    def call_llm():
        return llm.invoke(state["messages"])

    try:
        result = llm_circuit_breaker.call(call_llm)
        return {"messages": [result]}
    except Exception as e:
        # Fallback behavior
        return {"messages": ["Service temporarily unavailable"]}
```

### 10.6 Rate Limiting

```python
from redis import Redis
from datetime import datetime

class RateLimiter:
    def __init__(self, redis_client: Redis, max_requests: int, window_seconds: int):
        self.redis = redis_client
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    def is_allowed(self, key: str) -> bool:
        now = datetime.now().timestamp()
        window_key = f"rate_limit:{key}:{int(now / self.window_seconds)}"

        count = self.redis.incr(window_key)
        if count == 1:
            self.redis.expire(window_key, self.window_seconds)

        return count <= self.max_requests

# Use in graph
rate_limiter = RateLimiter(redis_client, max_requests=100, window_seconds=60)

def rate_limited_node(state: AgentState) -> AgentState:
    user_id = state["user_id"]

    if not rate_limiter.is_allowed(user_id):
        raise Exception(f"Rate limit exceeded for user {user_id}")

    return perform_work(state)
```

### 10.7 Checkpoint Cleanup

```python
# cleanup_job.py
from langgraph.checkpoint.postgres import PostgresSaver
from datetime import datetime, timedelta

def cleanup_old_checkpoints(
    checkpointer: PostgresSaver,
    days_to_keep: int = 30
):
    """Run as scheduled job (cron/k8s CronJob)."""

    cutoff_date = datetime.now() - timedelta(days=days_to_keep)

    with checkpointer.conn.cursor() as cur:
        cur.execute("""
            DELETE FROM checkpoints
            WHERE created_at < %s
        """, [cutoff_date])

        deleted_count = cur.rowcount
        print(f"Deleted {deleted_count} old checkpoints")

# Kubernetes CronJob
"""
apiVersion: batch/v1
kind: CronJob
metadata:
  name: checkpoint-cleanup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cleanup
            image: myorg/langgraph-cleanup:latest
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: langgraph-secrets
                  key: database-url
            - name: DAYS_TO_KEEP
              value: "30"
          restartPolicy: OnFailure
"""
```

### 10.8 Multi-Tenant Isolation

```python
# multi_tenant.py
class TenantAwareState(TypedDict):
    tenant_id: str
    data: dict

def create_tenant_graph(tenant_id: str) -> CompiledStateGraph:
    """Create isolated graph per tenant."""

    def tenant_router(state: TenantAwareState) -> str:
        # Route based on tenant configuration
        tenant_config = get_tenant_config(state["tenant_id"])

        if tenant_config["features"]["advanced_search"]:
            return "advanced_search"
        return "basic_search"

    builder = StateGraph(TenantAwareState)
    # ... build graph with tenant-specific nodes

    # Use tenant-specific checkpointer
    checkpointer = PostgresSaver(
        pool,
        schema_name=f"tenant_{tenant_id}"  # Separate schema per tenant
    )

    return builder.compile(checkpointer=checkpointer)

# Request handler
def handle_request(tenant_id: str, request: dict):
    graph = graph_cache.get(tenant_id) or create_tenant_graph(tenant_id)

    config = {
        "configurable": {
            "thread_id": f"{tenant_id}-{request['user_id']}-{request['session_id']}"
        }
    }

    return graph.invoke(
        {"tenant_id": tenant_id, "data": request},
        config
    )
```

**Production Checklist:**
- ✅ PostgreSQL connection pooling
- ✅ Horizontal scaling (API + workers)
- ✅ Circuit breakers for external services
- ✅ Rate limiting per user/tenant
- ✅ Prometheus metrics + OpenTelemetry tracing
- ✅ Checkpoint cleanup jobs
- ✅ Multi-tenant isolation
- ✅ Health checks and liveness probes
- ✅ Graceful shutdown handling
- ✅ Secrets management (K8s secrets)

---

## Summary: Pattern Selection Guide

| Use Case | Recommended Pattern | Complexity |
|----------|-------------------|------------|
| Simple linear agent | Basic StateGraph | ⭐ |
| Multi-agent handoffs | Command API | ⭐⭐ |
| Parallel processing | Send API + Map-Reduce | ⭐⭐⭐ |
| Modular workflows | Subgraph composition | ⭐⭐⭐ |
| Human approvals | Interrupt + Checkpointing | ⭐⭐ |
| Long-running workflows | PostgreSQL checkpointer | ⭐⭐⭐ |
| Real-time UX | Multi-mode streaming | ⭐⭐ |
| Dynamic capabilities | Graph factory + runtime selection | ⭐⭐⭐⭐ |
| Mission-critical | Consider Temporal instead | ⭐⭐⭐⭐⭐ |
| Production AI at scale | Inngest or custom infrastructure | ⭐⭐⭐⭐ |

## Key Takeaways

1. **LangGraph excels at prototyping** AI agent workflows with explicit graph control
2. **Command API eliminates boilerplate** for multi-agent systems (2024 feature)
3. **Send API enables dynamic parallelism** for map-reduce patterns
4. **Checkpointing is mandatory** for production (use PostgreSQL)
5. **HITL is first-class** with interrupt() - not bolted on
6. **Streaming modes provide flexibility** for different UX needs
7. **For production durability**, strongly consider Temporal or Inngest
8. **AI SDK v6 may be better** for TypeScript-first teams
9. **Subgraphs enable modularity** but add complexity
10. **Monitor everything** - use OpenTelemetry + Prometheus

---

## Sources

### LangGraph Core
- [Graph API overview - Docs by LangChain](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [Advanced LangGraph: Implementing Conditional Edges and Tool-Calling Agents](https://dev.to/jamesli/advanced-langgraph-implementing-conditional-edges-and-tool-calling-agents-3pdn)
- [From Basics to Advanced: Exploring LangGraph](https://towardsdatascience.com/from-basics-to-advanced-exploring-langgraph-e8c1cf4db787/)
- [LangGraph Glossary](https://langchain-ai.github.io/langgraphjs/concepts/low_level/)

### Command API
- [Command: A new tool for building multi-agent architectures in LangGraph](https://blog.langchain.com/command-a-new-tool-for-multi-agent-architectures-in-langgraph/)
- [A Beginner's Guide to Dynamic Routing in LangGraph with Command()](https://dev.to/aiengineering/a-beginners-guide-to-dynamic-routing-in-langgraph-with-command-2c5l)
- [How to combine control flow and state updates with Command](https://langchain-ai.github.io/langgraphjs/how-tos/command/)
- [The Command Object in Langgraph](https://medium.com/@vivekvjnk/the-command-object-in-langgraph-bc29bf57d18f)

### Send API & Parallelization
- [Implementing Map-Reduce with LangGraph](https://medium.com/@astropomeai/implementing-map-reduce-with-langgraph-creating-flexible-branches-for-parallel-execution-b6dc44327c0e)
- [Leveraging LangGraph's Send API for Dynamic and Parallel Workflow Execution](https://dev.to/sreeni5018/leveraging-langgraphs-send-api-for-dynamic-and-parallel-workflow-execution-4pgd)
- [How to create map-reduce branches for parallel execution](https://langchain-ai.github.io/langgraphjs/how-tos/map-reduce/)
- [Scaling LangGraph Agents: Parallelization, Subgraphs, and Map-Reduce Trade-Offs](https://aipractitioner.substack.com/p/scaling-langgraph-agents-parallelization)

### Subgraphs
- [Subgraphs - Docs by LangChain](https://docs.langchain.com/oss/python/langgraph/use-subgraphs)
- [LangGraph Subgraphs: A Guide to Modular AI Agents Development](https://dev.to/sreeni5018/langgraph-subgraphs-a-guide-to-modular-ai-agents-development-31ob)
- [Building Complex AI Workflows with LangGraph: A Detailed Explanation of Subgraph Architecture](https://dev.to/jamesli/building-complex-ai-workflows-with-langgraph-a-detailed-explanation-of-subgraph-architecture-1dj5)
- [How to add and use subgraphs](https://langchain-ai.github.io/langgraphjs/how-tos/subgraph/)

### Human-in-the-Loop
- [Making it easier to build human-in-the-loop agents with interrupt](https://blog.langchain.com/making-it-easier-to-build-human-in-the-loop-agents-with-interrupt/)
- [Human-in-the-loop](https://langchain-ai.github.io/langgraphjs/concepts/human_in_the_loop/)
- [Interrupts and Commands in LangGraph: Building Human-in-the-Loop Workflows](https://dev.to/jamesbmour/interrupts-and-commands-in-langgraph-building-human-in-the-loop-workflows-4ngl)
- [How to wait for user input using interrupt](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/wait-user-input/)

### State Persistence
- [Persistence - Docs by LangChain](https://docs.langchain.com/oss/python/langgraph/persistence)
- [Mastering Persistence in LangGraph: Checkpoints, Threads, and Beyond](https://medium.com/@vinodkrane/mastering-persistence-in-langgraph-checkpoints-threads-and-beyond-21e412aaed60)
- [LangGraph v0.2: Increased customization with new checkpointer libraries](https://blog.langchain.com/langgraph-v0-2/)
- [Mastering LangGraph Checkpointing: Best Practices for 2025](https://sparkco.ai/blog/mastering-langgraph-checkpointing-best-practices-for-2025)
- [LangGraph & Redis: Build smarter AI agents with memory & persistence](https://redis.io/blog/langgraph-redis-build-smarter-ai-agents-with-memory-persistence/)

### Dynamic Graphs
- [Dynamic Graph Creation at Runtime - LangGraph](https://forum.langchain.com/t/dynamic-graph-creation-at-runtime/1387)
- [Building Dynamic Workflows with LangGraph: Beyond DAGs](https://fetch.ai/blog/building-dynamic-workflows-with-langgraph-beyond-dags)
- [Building LangGraph: Designing an Agent Runtime from first principles](https://blog.langchain.com/building-langgraph/)

### Streaming
- [Streaming - Docs by LangChain](https://docs.langchain.com/oss/javascript/langgraph/streaming)
- [LangGraph Streaming 101: 5 Modes to Build Responsive AI Applications](https://dev.to/sreeni5018/langgraph-streaming-101-5-modes-to-build-responsive-ai-applications-4p3f)
- [How to configure multiple streaming modes at the same time](https://langchain-ai.github.io/langgraphjs/how-tos/stream-multiple/)

### Comparisons
- [Orchestrating Multi-Step Agents: Temporal/Dagster/LangGraph Patterns](https://kinde.com/learn/ai-for-software-engineering/ai-devops/orchestrating-multi-step-agents-temporal-dagster-langgraph-patterns-for-long-running-work/)
- [From prototype to production-ready agentic AI solution: Grid Dynamics](https://temporal.io/blog/prototype-to-prod-ready-agentic-ai-grid-dynamics)
- [Agent Workflows That Don't Break: Why I Picked Inngest](https://medium.com/@prajvaladhav14/agent-workflows-that-dont-break-why-i-picked-inngest-9fe512390e33)
- [The fallacy of the graph: Why your next agentic workflow should be code, not a diagram](https://temporal.io/blog/the-fallacy-of-the-graph-why-your-next-workflow-should-be-code-not-a-diagram)
- [The Principles of Production AI - Inngest Blog](https://www.inngest.com/blog/principles-of-production-ai)

### AI SDK v6
- [AI SDK 6 - Vercel](https://vercel.com/blog/ai-sdk-6)
- [Agents: Workflow Patterns](https://ai-sdk.dev/docs/agents/workflows)
- [Agents: Overview](https://ai-sdk.dev/docs/agents/overview)

---

**Research compiled:** January 5, 2026
**Total patterns documented:** 40+
**Code examples:** Python + TypeScript
**Production-ready:** Deployment, monitoring, scaling patterns included