# LangGraph Human-in-the-Loop Patterns Research

**Research Date:** January 2026
**Focus:** LangGraph HITL patterns for interrupt(), graph node design, state persistence, tool/node-level interrupts, resumption patterns, multi-step approvals, and streaming integration.

---

## Table of Contents

1. [Overview](#overview)
2. [The interrupt() Function](#the-interrupt-function)
3. [State Persistence and Checkpointers](#state-persistence-and-checkpointers)
4. [Graph Node Design for Human Checkpoints](#graph-node-design-for-human-checkpoints)
5. [Tool-Level vs Node-Level Interrupts](#tool-level-vs-node-level-interrupts)
6. [Resumption Patterns with Command](#resumption-patterns-with-command)
7. [Multi-Step Approval Workflows](#multi-step-approval-workflows)
8. [Streaming Integration](#streaming-integration)
9. [Complete Code Examples](#complete-code-examples)
10. [Best Practices and Gotchas](#best-practices-and-gotchas)

---

## Overview

Human-in-the-loop (HITL) workflows integrate human input into automated processes, allowing for decisions, validation, or corrections at key stages. This is especially useful in LLM-based applications where the model may generate occasional inaccuracies.

**Key Features:**
- **interrupt()** function introduced in LangGraph 0.2.31+ (recommended over static breakpoints)
- Persistent execution state using checkpointers
- Production-ready: interrupted threads can be resumed months later on different machines
- No resource consumption beyond storage space when paused
- LangGraph v1.0 release scheduled for October 2025

---

## The interrupt() Function

### Core Mechanics

The `interrupt()` function pauses graph execution and returns a value to the caller. When called within a node, LangGraph:
1. Saves the current graph state to the persistence layer
2. Marks the thread as interrupted
3. Returns the interrupt payload to the caller
4. Waits indefinitely until resumed with `Command(resume=...)`

### Requirements

To use `interrupt()`, you need:
1. **A checkpointer** to persist graph state (use durable checkpointer in production)
2. **A thread ID** in your config so the runtime knows which state to resume
3. **JSON-serializable payload** passed to `interrupt()`

### Basic Usage

```python
from langgraph.types import interrupt, Command

def human_feedback(state):
    print("---human_feedback---")
    # Pause execution and request user input
    feedback = interrupt("Please provide feedback:")
    # When resumed, 'feedback' will contain the value from Command(resume=...)
    return {"user_feedback": feedback}
```

### Key Differences: Dynamic vs Static Interrupts

| Feature | Dynamic Interrupts (`interrupt()`) | Static Breakpoints |
|---------|-----------------------------------|-------------------|
| **Definition** | Called anywhere in node code | Set at compile time |
| **Flexibility** | Conditional based on runtime logic | Fixed before/after nodes |
| **Recommendation** | Recommended (LangGraph 0.2.31+) | Legacy pattern |
| **Example** | `interrupt("Approve?")` | `interrupt_before=["node_name"]` |

```python
# Dynamic interrupt (RECOMMENDED)
def approval_node(state):
    if state["requires_approval"]:
        decision = interrupt({"action": state["action"], "question": "Approve?"})
        return {"approved": decision}
    return {"approved": True}

# Static interrupt (LEGACY)
graph = builder.compile(
    checkpointer=memory,
    interrupt_before=["approval_node"]  # Always pauses before this node
)
```

---

## State Persistence and Checkpointers

### How Checkpointing Works

LangGraph's persistence layer saves graph state at each execution step, enabling:
- **Pause/Resume**: Stop execution and continue later, even on different machines
- **Crash Recovery**: Restart failed executions from last successful state
- **Time Travel**: Inspect or branch from any historical state
- **Multi-Turn Conversations**: Maintain context across user sessions

### Checkpoint Storage

Checkpointers save snapshots at each super-step and organize them into "threads" with unique `thread_id` values.

**Available Checkpointers:**

```python
# Development: In-memory (data lost on restart)
from langgraph.checkpoint.memory import InMemorySaver
checkpointer = InMemorySaver()

# Production: PostgreSQL
from langgraph.checkpoint.postgres import PostgresSaver
checkpointer = PostgresSaver(connection_string="postgresql://...")

# Production: SQLite
from langgraph.checkpoint.sqlite import SqliteSaver
checkpointer = SqliteSaver("checkpoints.db")

# Cloud: AWS Bedrock AgentCore
from aws_bedrock_agentcore import AgentCoreMemorySaver
checkpointer = AgentCoreMemorySaver(...)
```

### Thread Configuration

```python
# Execute with specific thread
config = {"configurable": {"thread_id": "user-123-session-456"}}
result = graph.invoke(state, config=config)

# Resume same thread later (even on different machine)
result = graph.invoke(Command(resume=user_input), config=config)
```

### Persistence Benefits for HITL

- **Indefinite pause**: No timeout - can wait days/months for human input
- **Zero resource usage**: Only storage space consumed while paused
- **Production-ready**: Full execution context preserved across restarts
- **Distributed**: Can resume on different server/process

---

## Graph Node Design for Human Checkpoints

### StateGraph Architecture

```python
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END

# 1. Define State Schema
class WorkflowState(TypedDict):
    task: str
    user_decision: str  # 'approve' or 'reject'
    user_feedback: str
    status: str
    approved: bool

# 2. Build Graph
builder = StateGraph(WorkflowState)
builder.add_node("generate_plan", generate_plan_node)
builder.add_node("human_review", human_review_node)
builder.add_node("execute_plan", execute_plan_node)
builder.add_node("handle_rejection", handle_rejection_node)

# 3. Add Edges
builder.add_edge(START, "generate_plan")
builder.add_edge("generate_plan", "human_review")

# 4. Conditional Routing Based on Human Input
def route_after_review(state) -> str:
    if state["user_decision"] == "approve":
        return "execute_plan"
    else:
        return "handle_rejection"

builder.add_conditional_edges(
    "human_review",
    route_after_review,
    {
        "execute_plan": "execute_plan",
        "handle_rejection": "handle_rejection"
    }
)

builder.add_edge("execute_plan", END)
builder.add_edge("handle_rejection", END)

# 5. Compile with Checkpointer
graph = builder.compile(checkpointer=PostgresSaver(...))
```

### Human Review Node Pattern

```python
from langgraph.types import interrupt, Command
from typing import Literal

def human_review_node(state) -> Command[Literal["execute_plan", "handle_rejection"]]:
    """Allow human to review and approve/reject the plan."""

    # Extract data to review
    plan = state["task"]

    # Pause for human input
    human_response = interrupt({
        "question": "Review this plan. Approve or reject?",
        "plan": plan,
        "options": ["approve", "reject"]
    })

    # Update state based on human decision
    decision = human_response["action"]
    feedback = human_response.get("feedback", "")

    if decision == "approve":
        return Command(
            update={"user_decision": "approve", "approved": True},
            goto="execute_plan"
        )
    else:
        return Command(
            update={"user_decision": "reject", "approved": False, "user_feedback": feedback},
            goto="handle_rejection"
        )
```

### Using Command for Combined State + Routing

The `Command` class allows nodes to return both state updates AND routing decisions:

```python
from langgraph.types import Command

# OLD WAY: Separate state update and conditional edge
def old_node(state):
    return {"approved": True}  # State update only
    # Routing handled by separate conditional_edges

# NEW WAY: Combined state + routing with Command
def new_node(state):
    return Command(
        update={"approved": True},  # State update
        goto="next_node"            # Routing decision
    )
```

---

## Tool-Level vs Node-Level Interrupts

### Node-Level Interrupts

**Best for:** Reviewing entire node outputs, multi-step decisions within a node

```python
def complex_analysis_node(state):
    # Step 1: Analyze
    analysis = perform_analysis(state)

    # Checkpoint 1: Review analysis
    review1 = interrupt({
        "question": "Is this analysis correct?",
        "analysis": analysis
    })

    if review1["action"] == "reject":
        return {"status": "rejected", "reason": review1["feedback"]}

    # Step 2: Generate recommendations
    recommendations = generate_recommendations(analysis)

    # Checkpoint 2: Review recommendations
    review2 = interrupt({
        "question": "Approve these recommendations?",
        "recommendations": recommendations
    })

    return {
        "analysis": analysis,
        "recommendations": recommendations,
        "approved": review2["action"] == "approve"
    }
```

### Tool-Level Interrupts

**Best for:** Reviewing individual LLM tool calls before execution

```python
from langgraph.prebuilt import create_react_agent
from langgraph.types import interrupt
from langchain_core.messages import AIMessage

# Define risky tools requiring approval
RISKY_TOOLS = ["delete_database", "send_email", "charge_credit_card"]

def review_tool_calls_node(state):
    """Review and approve tool calls before execution."""
    last_message = state["messages"][-1]

    if isinstance(last_message, AIMessage) and last_message.tool_calls:
        approved_calls = []

        for tool_call in last_message.tool_calls:
            if tool_call["name"] in RISKY_TOOLS:
                # Interrupt for approval
                decision = interrupt({
                    "tool": tool_call["name"],
                    "args": tool_call["args"],
                    "question": f"Approve {tool_call['name']}?"
                })

                if decision["action"] == "approve":
                    # Allow modification of args
                    approved_calls.append({
                        **tool_call,
                        "args": decision.get("modified_args", tool_call["args"])
                    })
            else:
                # Auto-approve safe tools
                approved_calls.append(tool_call)

        # Update message with approved tool calls
        last_message.tool_calls = approved_calls

    return state
```

### Challenge: Tool-Level Interrupts in Agent Nodes

**Problem:** When using `interrupt()` inside a tool within an agent node that calls multiple tools sequentially, resuming causes the entire node to re-execute, triggering the first tool again.

**Workaround:** Use a dedicated review node between LLM call and tool execution:

```python
# GRAPH STRUCTURE:
# call_llm → review_tool_calls → execute_tools

def review_tool_calls_node(state):
    """Dedicated node for reviewing tool calls."""
    last_msg = state["messages"][-1]
    tool_call = last_msg.tool_calls[-1]

    if tool_call["name"] in RISKY_TOOLS:
        approval = interrupt({
            "question": "Approve this tool call?",
            "tool_call": tool_call
        })

        if approval["action"] == "continue":
            return Command(goto="execute_tools")
        elif approval["action"] == "modify":
            # Update tool call args
            tool_call["args"] = approval["data"]
            return Command(goto="execute_tools")
        else:
            return Command(goto="call_llm")  # Reject and retry

    return Command(goto="execute_tools")
```

---

## Resumption Patterns with Command

### Basic Resume Pattern

```python
# 1. Initial invocation - pauses at interrupt
config = {"configurable": {"thread_id": "thread-123"}}
result = graph.invoke({"task": "Deploy to production"}, config=config)

# 2. Check if interrupted
if "__interrupt__" in result:
    interrupt_data = result["__interrupt__"][0].value
    print(f"Waiting for: {interrupt_data['question']}")

    # 3. Get user input (could be days later, different machine)
    user_input = input("Your decision: ")

    # 4. Resume with Command
    result = graph.invoke(
        Command(resume={"action": user_input, "feedback": "Looks good"}),
        config=config  # Same thread_id
    )
```

### Critical Resumption Behavior

**IMPORTANT:** When execution resumes after an interrupt, the node **restarts from the beginning**—it does NOT resume from the exact line where `interrupt()` was called.

```python
def node_with_interrupt(state):
    print("Step 1: This will run TWICE")  # ← Runs on initial call AND resume

    result = expensive_computation()  # ← Also runs twice!

    user_input = interrupt("Review result?")  # ← Pauses here

    print("Step 2: After interrupt")  # ← Only runs after resume
    return {"result": result, "approved": user_input}

# Execution flow:
# Initial call:  Step 1 → expensive_computation() → interrupt() → PAUSE
# Resume call:   Step 1 → expensive_computation() → interrupt() → Step 2 → return
```

**Solution:** Cache expensive operations or check if resuming:

```python
def node_with_interrupt(state):
    # Check if we're resuming (state already has intermediate results)
    if "cached_result" not in state:
        print("Computing expensive result...")
        state["cached_result"] = expensive_computation()

    user_input = interrupt("Review result?")

    return {"final_result": state["cached_result"], "approved": user_input}
```

### Index-Based Interrupt Matching

Multiple interrupts in the same node are matched **strictly by index**:

```python
def multi_checkpoint_node(state):
    # First interrupt
    review1 = interrupt("Review step 1?")  # Index 0

    # Second interrupt
    review2 = interrupt("Review step 2?")  # Index 1

    return {"review1": review1, "review2": review2}

# Resume MUST provide values in same order:
graph.invoke(
    Command(resume=["approved", "modified"]),  # Index 0, then index 1
    config=config
)
```

### Multiple Concurrent Interrupts (LangGraph 3.14.0+)

**Challenge:** In parallel subgraphs, multiple interrupts can occur simultaneously, but LangGraph 3.14.0 requires resuming them sequentially.

```python
# Current limitation (as of v3.14.0):
# - Both interrupts hit on first pass
# - Resume only restarts first interrupt
# - Must call graph again to resume second interrupt

# Proposed future pattern (not yet available):
result = graph.invoke(state, config=config)
if "__interrupt__" in result:
    interrupts = result["__interrupt__"]  # Multiple interrupts

    # User responds to each individually
    responses = {
        interrupts[0].id: {"action": "approve"},
        interrupts[1].id: {"action": "reject"}
    }

    # Resume all at once (FUTURE FEATURE)
    graph.invoke(Command(resume=responses), config=config)
```

### Streaming with Resume

You can use `stream()` instead of `invoke()` for real-time updates during resumption:

```python
# Initial streaming execution
for event in graph.stream(state, config=config, stream_mode=["updates", "messages"]):
    mode, data = event
    if mode == "messages":
        print(data)  # Stream LLM tokens
    elif mode == "updates":
        if "__interrupt__" in data:
            break  # Paused for human input

# Resume with streaming
for event in graph.stream(
    Command(resume=user_input),
    config=config,
    stream_mode=["updates", "messages"]
):
    mode, data = event
    print(f"{mode}: {data}")
```

---

## Multi-Step Approval Workflows

### Sequential Approval Pattern

```python
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt

class ContentWorkflowState(TypedDict):
    content: str
    draft_approved: bool
    seo_approved: bool
    legal_approved: bool
    final_status: str

def draft_review_node(state):
    """Checkpoint 1: Review initial draft."""
    draft = state["content"]

    review = interrupt({
        "checkpoint": "draft_review",
        "question": "Approve draft?",
        "content": draft
    })

    if review["action"] == "approve":
        return {"draft_approved": True}
    else:
        # Modify draft based on feedback
        updated_draft = apply_feedback(draft, review["feedback"])
        return {"content": updated_draft, "draft_approved": False}

def seo_review_node(state):
    """Checkpoint 2: Review SEO optimization."""
    seo_analysis = analyze_seo(state["content"])

    review = interrupt({
        "checkpoint": "seo_review",
        "question": "SEO optimizations look good?",
        "analysis": seo_analysis
    })

    return {"seo_approved": review["action"] == "approve"}

def legal_review_node(state):
    """Checkpoint 3: Legal compliance check."""
    legal_issues = check_legal_compliance(state["content"])

    review = interrupt({
        "checkpoint": "legal_review",
        "question": "Legal compliance approved?",
        "issues": legal_issues
    })

    return {"legal_approved": review["action"] == "approve"}

def publish_node(state):
    """Final publication step."""
    publish_content(state["content"])
    return {"final_status": "published"}

# Build sequential approval workflow
builder = StateGraph(ContentWorkflowState)
builder.add_node("draft_review", draft_review_node)
builder.add_node("seo_review", seo_review_node)
builder.add_node("legal_review", legal_review_node)
builder.add_node("publish", publish_node)

# Sequential flow
builder.add_edge(START, "draft_review")

# Conditional: retry draft if not approved
def after_draft_review(state):
    return "seo_review" if state["draft_approved"] else "draft_review"

builder.add_conditional_edges("draft_review", after_draft_review)
builder.add_edge("seo_review", "legal_review")
builder.add_edge("legal_review", "publish")
builder.add_edge("publish", END)

graph = builder.compile(checkpointer=PostgresSaver(...))
```

### Parallel Review Pattern

```python
from langgraph.types import Send

def fan_out_reviews(state) -> list[Send]:
    """Send content to multiple reviewers in parallel."""
    content = state["content"]

    return [
        Send("technical_review", {"content": content, "reviewer": "tech"}),
        Send("legal_review", {"content": content, "reviewer": "legal"}),
        Send("marketing_review", {"content": content, "reviewer": "marketing"})
    ]

def technical_review_node(state):
    review = interrupt({
        "reviewer": "technical",
        "question": "Technical accuracy approved?"
    })
    return {"technical_approved": review["action"] == "approve"}

def legal_review_node(state):
    review = interrupt({
        "reviewer": "legal",
        "question": "Legal compliance approved?"
    })
    return {"legal_approved": review["action"] == "approve"}

def marketing_review_node(state):
    review = interrupt({
        "reviewer": "marketing",
        "question": "Marketing messaging approved?"
    })
    return {"marketing_approved": review["action"] == "approve"}

def aggregate_reviews(state):
    """Wait for all reviews and aggregate."""
    all_approved = (
        state["technical_approved"] and
        state["legal_approved"] and
        state["marketing_approved"]
    )
    return {"all_reviews_approved": all_approved}

# Build parallel review workflow
builder.add_conditional_edges(START, fan_out_reviews)
builder.add_edge("technical_review", "aggregate_reviews")
builder.add_edge("legal_review", "aggregate_reviews")
builder.add_edge("marketing_review", "aggregate_reviews")
builder.add_edge("aggregate_reviews", END)
```

### Hierarchical Approval Pattern

```python
def manager_approval(state):
    """Low-value items: manager approves."""
    amount = state["amount"]

    approval = interrupt({
        "level": "manager",
        "question": f"Approve ${amount}?",
        "amount": amount
    })

    return {"manager_approved": approval["action"] == "approve"}

def director_approval(state):
    """Medium-value items: director approves."""
    approval = interrupt({
        "level": "director",
        "question": f"Approve ${state['amount']}?",
    })

    return {"director_approved": approval["action"] == "approve"}

def ceo_approval(state):
    """High-value items: CEO approves."""
    approval = interrupt({
        "level": "ceo",
        "question": f"Approve ${state['amount']}?",
    })

    return {"ceo_approved": approval["action"] == "approve"}

def route_by_amount(state):
    """Route to appropriate approval level."""
    amount = state["amount"]

    if amount < 1000:
        return "manager_approval"
    elif amount < 10000:
        return "director_approval"
    else:
        return "ceo_approval"

builder.add_conditional_edges(START, route_by_amount, {
    "manager_approval": "manager_approval",
    "director_approval": "director_approval",
    "ceo_approval": "ceo_approval"
})
```

---

## Streaming Integration

### Available Stream Modes

LangGraph supports 5 streaming modes:

| Mode | Output | Use Case |
|------|--------|----------|
| `values` | Full state snapshot | Monitoring complete state |
| `updates` | State deltas (node-by-node) | Tracking individual node changes |
| `messages` | LLM tokens + metadata | Real-time chat interfaces |
| `custom` | User-defined events | Custom progress indicators |
| `debug` | Detailed execution traces | Debugging and monitoring |

### Combining Modes

```python
# Stream both state updates AND LLM tokens
for event in graph.stream(
    state,
    config=config,
    stream_mode=["updates", "messages"]
):
    mode, data = event

    if mode == "updates":
        print(f"Node update: {data}")
    elif mode == "messages":
        print(f"LLM token: {data}")
```

### Streaming with Interrupts

```python
import asyncio

async def run_with_streaming_interrupts():
    config = {"configurable": {"thread_id": "stream-123"}}

    # Initial execution with streaming
    print("Starting workflow...")
    async for event in graph.astream(
        {"task": "Generate report"},
        config=config,
        stream_mode=["updates", "messages"]
    ):
        mode, data = event

        if mode == "updates":
            # Check for interrupt
            if "__interrupt__" in data:
                interrupt_data = data["__interrupt__"][0].value
                print(f"\n🛑 Paused: {interrupt_data['question']}")

                # Get user input (could be via WebSocket, HTTP, etc.)
                user_input = await get_user_input_async(interrupt_data)

                # Resume with streaming
                print("\n✅ Resuming...")
                async for resume_event in graph.astream(
                    Command(resume=user_input),
                    config=config,
                    stream_mode=["updates", "messages"]
                ):
                    resume_mode, resume_data = resume_event
                    if resume_mode == "messages":
                        print(resume_data, end="", flush=True)

                break

        elif mode == "messages":
            # Stream LLM tokens
            print(data, end="", flush=True)
```

### Real-Time Frontend Integration

**Architecture:**
1. **Backend:** LangGraph with SSE (Server-Sent Events)
2. **Frontend:** WebSocket or SSE client
3. **State Sync:** Redis/PostgreSQL for multi-server deployments

**Backend (FastAPI):**

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json

app = FastAPI()

@app.post("/agent/stream")
async def stream_agent(request: AgentRequest):
    config = {"configurable": {"thread_id": request.thread_id}}

    async def event_generator():
        async for event in graph.astream(
            {"input": request.input},
            config=config,
            stream_mode=["updates", "messages"]
        ):
            mode, data = event

            # Send SSE event
            yield f"event: {mode}\n"
            yield f"data: {json.dumps(data)}\n\n"

            # Check for interrupt
            if mode == "updates" and "__interrupt__" in data:
                yield "event: interrupt\n"
                yield f"data: {json.dumps(data['__interrupt__'][0].value)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/agent/resume")
async def resume_agent(request: ResumeRequest):
    config = {"configurable": {"thread_id": request.thread_id}}

    async def event_generator():
        async for event in graph.astream(
            Command(resume=request.resume_value),
            config=config,
            stream_mode=["updates", "messages"]
        ):
            mode, data = event
            yield f"event: {mode}\n"
            yield f"data: {json.dumps(data)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

**Frontend (React):**

```typescript
import { useEffect, useState } from 'react';

function useAgentStream(threadId: string) {
  const [messages, setMessages] = useState<string[]>([]);
  const [interrupt, setInterrupt] = useState<any | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = async (input: string) => {
    setIsStreaming(true);

    const response = await fetch('/agent/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread_id: threadId, input })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('event: messages')) {
          // Next line has the data
        } else if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));

          if (line.includes('interrupt')) {
            setInterrupt(data);
            setIsStreaming(false);
          } else {
            setMessages(prev => [...prev, data]);
          }
        }
      }
    }
  };

  const resume = async (value: any) => {
    setIsStreaming(true);
    setInterrupt(null);

    const response = await fetch('/agent/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread_id: threadId, resume_value: value })
    });

    // Similar streaming logic...
  };

  return { messages, interrupt, isStreaming, startStream, resume };
}
```

### Custom Events for Progress Tracking

```python
from langgraph.types import StreamWriter

def long_running_node(state, *, stream: StreamWriter):
    """Node that emits custom progress events."""

    # Emit custom event
    stream.custom({
        "type": "progress",
        "step": "analyzing",
        "percent": 10
    })

    analysis = perform_analysis(state)

    stream.custom({
        "type": "progress",
        "step": "processing",
        "percent": 50
    })

    result = process(analysis)

    stream.custom({
        "type": "progress",
        "step": "finalizing",
        "percent": 90
    })

    return {"result": result}

# Stream custom events
for event in graph.stream(state, stream_mode=["custom", "updates"]):
    mode, data = event

    if mode == "custom":
        print(f"Progress: {data['step']} - {data['percent']}%")
```

---

## Complete Code Examples

### Example 1: Basic Approval Workflow

```python
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command, interrupt
from langgraph.checkpoint.memory import InMemorySaver

# State definition
class ApprovalState(TypedDict):
    task: str
    user_decision: str
    status: str

# Nodes
def present_task(state):
    print(f"Task: {state['task']}")
    return state

def request_approval(state):
    decision = interrupt({
        "question": "Do you approve this task?",
        "task": state["task"],
        "options": ["approve", "reject"]
    })

    return {
        "user_decision": decision["action"],
        "status": "approved" if decision["action"] == "approve" else "rejected"
    }

def execute_task(state):
    print(f"Executing: {state['task']}")
    return {"status": "completed"}

def cancel_task(state):
    print(f"Cancelled: {state['task']}")
    return {"status": "cancelled"}

# Build graph
builder = StateGraph(ApprovalState)
builder.add_node("present_task", present_task)
builder.add_node("request_approval", request_approval)
builder.add_node("execute_task", execute_task)
builder.add_node("cancel_task", cancel_task)

builder.add_edge(START, "present_task")
builder.add_edge("present_task", "request_approval")

def route_decision(state):
    return "execute_task" if state["user_decision"] == "approve" else "cancel_task"

builder.add_conditional_edges("request_approval", route_decision, {
    "execute_task": "execute_task",
    "cancel_task": "cancel_task"
})

builder.add_edge("execute_task", END)
builder.add_edge("cancel_task", END)

# Compile
memory = InMemorySaver()
graph = builder.compile(checkpointer=memory)

# Execute
config = {"configurable": {"thread_id": "approval-001"}}
result = graph.invoke({"task": "Deploy to production"}, config=config)

# Check for interrupt
if "__interrupt__" in result:
    print(f"Waiting for approval: {result['__interrupt__'][0].value}")

    # Simulate user input
    user_response = {"action": "approve"}

    # Resume
    final_result = graph.invoke(Command(resume=user_response), config=config)
    print(f"Final status: {final_result['status']}")
```

### Example 2: Multi-Checkpoint Research Workflow

```python
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt
from langgraph.checkpoint.postgres import PostgresSaver

class ResearchState(TypedDict):
    topic: str
    queries: list[str]
    sources: list[dict]
    analysis: str
    approved_queries: bool
    approved_analysis: bool

def generate_queries(state):
    """AI generates search queries."""
    queries = [
        f"{state['topic']} overview",
        f"{state['topic']} latest research 2025",
        f"{state['topic']} best practices"
    ]
    return {"queries": queries}

def review_queries(state):
    """Checkpoint 1: Human reviews search queries."""
    review = interrupt({
        "checkpoint": "query_review",
        "question": "Review and approve these search queries?",
        "queries": state["queries"],
        "options": ["approve", "modify"]
    })

    if review["action"] == "modify":
        # User provides modified queries
        return {
            "queries": review["modified_queries"],
            "approved_queries": True
        }

    return {"approved_queries": True}

def search_sources(state):
    """Execute searches with approved queries."""
    sources = []
    for query in state["queries"]:
        # Simulate search
        sources.append({"query": query, "results": f"Results for {query}"})
    return {"sources": sources}

def generate_analysis(state):
    """AI analyzes search results."""
    analysis = f"Analysis of {state['topic']} based on {len(state['sources'])} sources"
    return {"analysis": analysis}

def review_analysis(state):
    """Checkpoint 2: Human reviews analysis."""
    review = interrupt({
        "checkpoint": "analysis_review",
        "question": "Is this analysis accurate?",
        "analysis": state["analysis"],
        "options": ["approve", "request_changes"]
    })

    if review["action"] == "request_changes":
        # AI incorporates feedback
        updated_analysis = f"{state['analysis']}\n\nUpdated with: {review['feedback']}"
        return {
            "analysis": updated_analysis,
            "approved_analysis": True
        }

    return {"approved_analysis": True}

def finalize_report(state):
    """Create final report."""
    print(f"Final Report on {state['topic']}:")
    print(f"Queries: {state['queries']}")
    print(f"Analysis: {state['analysis']}")
    return state

# Build graph
builder = StateGraph(ResearchState)
builder.add_node("generate_queries", generate_queries)
builder.add_node("review_queries", review_queries)
builder.add_node("search_sources", search_sources)
builder.add_node("generate_analysis", generate_analysis)
builder.add_node("review_analysis", review_analysis)
builder.add_node("finalize_report", finalize_report)

# Sequential checkpoints
builder.add_edge(START, "generate_queries")
builder.add_edge("generate_queries", "review_queries")
builder.add_edge("review_queries", "search_sources")
builder.add_edge("search_sources", "generate_analysis")
builder.add_edge("generate_analysis", "review_analysis")
builder.add_edge("review_analysis", "finalize_report")
builder.add_edge("finalize_report", END)

# Compile with production checkpointer
checkpointer = PostgresSaver(connection_string="postgresql://...")
graph = builder.compile(checkpointer=checkpointer)

# Execute with streaming
config = {"configurable": {"thread_id": "research-001"}}

for event in graph.stream(
    {"topic": "LangGraph HITL patterns"},
    config=config,
    stream_mode=["updates"]
):
    mode, data = event

    if "__interrupt__" in data:
        checkpoint = data["__interrupt__"][0].value
        print(f"\n🛑 Checkpoint: {checkpoint['checkpoint']}")
        print(f"Question: {checkpoint['question']}")

        # Simulate human input
        if checkpoint["checkpoint"] == "query_review":
            user_input = {"action": "approve"}
        else:
            user_input = {"action": "approve"}

        # Resume
        for resume_event in graph.stream(
            Command(resume=user_input),
            config=config,
            stream_mode=["updates"]
        ):
            print(f"Resumed: {resume_event}")
```

### Example 3: Tool-Level Approval (ReAct Agent)

```python
from langgraph.prebuilt import create_react_agent
from langchain_core.tools import tool
from langgraph.types import interrupt
from langchain_openai import ChatOpenAI

# Define tools
@tool
def get_user_info(user_id: str):
    """Get sensitive user information."""
    return {"user_id": user_id, "email": "user@example.com", "ssn": "***-**-1234"}

@tool
def send_email(to: str, subject: str, body: str):
    """Send an email."""
    return f"Email sent to {to}"

@tool
def safe_search(query: str):
    """Search the web - safe operation."""
    return f"Results for: {query}"

# Risky tools requiring approval
RISKY_TOOLS = ["get_user_info", "send_email"]

def create_approval_hook():
    """Post-model hook for approving risky tool calls."""

    def hook(state):
        last_msg = state["messages"][-1]

        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            for tool_call in last_msg.tool_calls:
                if tool_call["name"] in RISKY_TOOLS:
                    # Interrupt for approval
                    decision = interrupt({
                        "tool": tool_call["name"],
                        "args": tool_call["args"],
                        "question": f"Approve calling {tool_call['name']}?"
                    })

                    if decision["action"] != "approve":
                        # Remove tool call if not approved
                        last_msg.tool_calls = [
                            tc for tc in last_msg.tool_calls
                            if tc["id"] != tool_call["id"]
                        ]

        return state

    return hook

# Create agent with approval hook
tools = [get_user_info, send_email, safe_search]
model = ChatOpenAI(model="gpt-4")

agent = create_react_agent(
    model,
    tools,
    state_modifier=create_approval_hook()  # Add approval layer
)

# Execute
config = {"configurable": {"thread_id": "agent-001"}}
result = agent.invoke(
    {"messages": [("user", "Send an email to user 123")]},
    config=config
)

# Check for interrupt
if "__interrupt__" in result:
    print("Waiting for tool approval...")
    approval = {"action": "approve"}

    result = agent.invoke(Command(resume=approval), config=config)
```

---

## Best Practices and Gotchas

### ✅ Best Practices

1. **Use Durable Checkpointers in Production**
   ```python
   # ❌ DON'T use in production
   checkpointer = InMemorySaver()

   # ✅ DO use persistent storage
   checkpointer = PostgresSaver(connection_string="...")
   ```

2. **Always Provide thread_id**
   ```python
   # ✅ Consistent thread tracking
   config = {"configurable": {"thread_id": f"user-{user_id}-session-{session_id}"}}
   ```

3. **Make Interrupt Payloads Descriptive**
   ```python
   # ❌ BAD: Unclear context
   interrupt("Approve?")

   # ✅ GOOD: Clear context
   interrupt({
       "checkpoint": "tool_approval",
       "question": "Approve this database deletion?",
       "tool": "delete_database",
       "args": {"table": "users"},
       "risk_level": "high",
       "alternatives": ["soft_delete", "archive"]
   })
   ```

4. **Cache Expensive Operations Before Interrupts**
   ```python
   def node_with_expensive_op(state):
       # ✅ Cache before interrupt
       if "cached_result" not in state:
           state["cached_result"] = expensive_operation()

       approval = interrupt("Proceed?")

       # Won't recompute on resume
       return {"result": state["cached_result"]}
   ```

5. **Use Command for Combined State + Routing**
   ```python
   # ✅ Modern pattern
   def review_node(state):
       decision = interrupt("Approve?")

       return Command(
           update={"approved": decision["action"] == "approve"},
           goto="execute" if decision["action"] == "approve" else "reject"
       )
   ```

6. **Combine Stream Modes for Rich UX**
   ```python
   # ✅ Stream both LLM tokens AND state changes
   stream_mode=["messages", "updates", "custom"]
   ```

### ⚠️ Common Gotchas

1. **Node Restarts on Resume**
   ```python
   # ⚠️ GOTCHA: This runs TWICE
   def bad_node(state):
       expensive_operation()  # Runs on initial call AND resume
       decision = interrupt("Approve?")
       return {"result": decision}

   # ✅ FIX: Check if resuming
   def good_node(state):
       if "intermediate" not in state:
           state["intermediate"] = expensive_operation()
       decision = interrupt("Approve?")
       return {"result": decision}
   ```

2. **Don't Wrap interrupt() in try/except**
   ```python
   # ❌ BAD: Catches interrupt exception
   try:
       decision = interrupt("Approve?")
   except Exception:
       decision = "auto_approve"  # Interrupt never surfaces!

   # ✅ GOOD: Let interrupt propagate
   decision = interrupt("Approve?")
   ```

3. **Index-Based Interrupt Matching**
   ```python
   # ⚠️ GOTCHA: Order matters
   def node(state):
       review1 = interrupt("Review 1?")  # Index 0
       review2 = interrupt("Review 2?")  # Index 1
       return {"r1": review1, "r2": review2}

   # ✅ Resume must match order
   graph.invoke(Command(resume=["response1", "response2"]), config)
   ```

4. **Concurrent Interrupts Not Fully Supported (v3.14.0)**
   ```python
   # ⚠️ LIMITATION: Parallel interrupts resume sequentially
   # Use workaround: sequential approval nodes instead of parallel
   ```

5. **Static vs Dynamic Interrupts**
   ```python
   # ❌ LEGACY: Static breakpoints
   graph.compile(interrupt_before=["node_name"])

   # ✅ RECOMMENDED: Dynamic interrupts
   def node(state):
       if condition:
           decision = interrupt("Approve?")
   ```

6. **Thread ID Reuse**
   ```python
   # ⚠️ GOTCHA: Reusing thread_id continues old execution
   config = {"configurable": {"thread_id": "same-id"}}
   graph.invoke(state1, config)  # First execution
   graph.invoke(state2, config)  # Continues first execution!

   # ✅ FIX: Use unique thread IDs
   config = {"configurable": {"thread_id": f"session-{uuid.uuid4()}"}}
   ```

7. **Streaming Mode Compatibility**
   ```python
   # ⚠️ Some modes require LLM support
   stream_mode="messages"  # Requires streaming-capable LLM

   # ✅ Always available
   stream_mode=["updates", "values"]
   ```

### 🔍 Debugging Interrupts

```python
# Enable debug mode
for event in graph.stream(state, config=config, stream_mode=["debug"]):
    mode, data = event
    print(f"[DEBUG] {mode}: {data}")

# Check thread state
from langgraph.checkpoint import CheckpointAPI

checkpoint_api = CheckpointAPI(checkpointer)
thread_state = checkpoint_api.get_state(config)
print(f"Is interrupted: {thread_state.tasks}")
print(f"Interrupt data: {thread_state.values.get('__interrupt__')}")
```

### 📊 Monitoring Interrupted Threads

```python
# List all interrupted threads
from langgraph.checkpoint.postgres import PostgresSaver

checkpointer = PostgresSaver(connection_string="...")

# Query interrupted threads
interrupted_threads = checkpointer.list(
    filter={"status": "interrupted"},
    limit=100
)

for thread in interrupted_threads:
    print(f"Thread: {thread.config['thread_id']}")
    print(f"Interrupted at: {thread.timestamp}")
    print(f"Waiting for: {thread.values.get('__interrupt__')}")
```

---

## Summary: Key Takeaways

1. **Use `interrupt()` over static breakpoints** (recommended since v0.2.31)
2. **Always use durable checkpointers in production** (PostgreSQL, SQLite)
3. **Nodes restart from beginning on resume** - cache expensive operations
4. **Combine `Command` for state updates + routing** (modern pattern)
5. **Stream modes enable rich real-time UX** (`messages` + `updates` + `custom`)
6. **Thread IDs must be unique per execution** to avoid state conflicts
7. **Multiple interrupts matched by index** - maintain order when resuming
8. **Interrupted threads persist indefinitely** - zero resource usage while paused
9. **Works across machines** - resume on different server/process
10. **LangGraph v1.0 coming October 2025** - current patterns will remain compatible

---

## Sources

- [LangGraph Human-in-the-Loop Concepts](https://langchain-ai.github.io/langgraphjs/concepts/human_in_the_loop/)
- [LangGraph Interrupts Documentation](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [How to Wait for User Input Using Interrupt](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/wait-user-input/)
- [LangChain Changelog: interrupt() Simplifying HITL](https://changelog.langchain.com/announcements/interrupt-simplifying-human-in-the-loop-agents)
- [Making it Easier to Build HITL Agents with interrupt](https://blog.langchain.com/making-it-easier-to-build-human-in-the-loop-agents-with-interrupt/)
- [Human-in-the-Loop in LangGraph with interrupt() - Medium](https://medium.com/@areebaayub2908/human-in-the-loop-in-langgraph-with-interrupt-langgraph-a3a9774b847e)
- [LangGraph Part 4: HITL for Reliable AI Workflows - Medium](https://medium.com/@sitabjapal03/langgraph-part-4-human-in-the-loop-for-reliable-ai-workflows-aa4cc175bce4)
- [Interrupts and Commands in LangGraph - DEV Community](https://dev.to/jamesbmour/interrupts-and-commands-in-langgraph-building-human-in-the-loop-workflows-4ngl)
- [Mastering Persistence in LangGraph - Medium](https://medium.com/@vinodkrane/mastering-persistence-in-langgraph-checkpoints-threads-and-beyond-21e412aaed60)
- [Agentic RAG and HITL with LangGraph](https://vanducng.dev/2025/06/26/Agentic-RAG-and-Human-in-the-Loop-with-LangGraph/)
- [LangGraph 201: Adding Human Oversight - Towards Data Science](https://towardsdatascience.com/langgraph-201-adding-human-oversight-to-your-deep-research-agent/)
- [LangGraph Production Template - GitHub](https://github.com/KirtiJha/langgraph-interrupt-workflow-template)
- [LangGraph v0.4: Working with Interrupts](https://changelog.langchain.com/announcements/langgraph-v0-4-working-with-interrupts)
- [Human-in-the-Loop with LangGraph: Mastering Interrupts - Medium](https://medium.com/@piyushagni5/human-in-the-loop-with-langgraph-mastering-interrupts-and-commands-9e1cf2183ae3)
- [LangGraph Architecture and Design - Medium](https://medium.com/@shuv.sdr/langgraph-architecture-and-design-280c365aaf2c)
- [Advanced LangGraph: Conditional Edges and Tool-Calling - DEV](https://dev.to/jamesli/advanced-langgraph-implementing-conditional-edges-and-tool-calling-agents-3pdn)
- [Beginner's Guide to LangGraph - Medium](https://medium.com/@kbdhunga/beginners-guide-to-langgraph-understanding-state-nodes-and-edges-part-1-897e6114fa48)
- [LangGraph Streaming Documentation](https://github.com/langchain-ai/langgraph/blob/main/docs/docs/concepts/streaming.md)
- [LangGraph Streaming 101: 5 Modes - DEV Community](https://dev.to/sreeni5018/langgraph-streaming-101-5-modes-to-build-responsive-ai-applications-4p3f)
- [How to Use Interrupt with astream - LangChain Forum](https://forum.langchain.com/t/how-to-use-interrupt-with-astream-for-frontend-interaction/1516)
- [Transactional Agentic AI with LangGraph - MarkTechPost](https://www.marktechpost.com/2025/12/31/how-to-design-transactional-agentic-ai-systems-with-langgraph-using-two-phase-commit-human-interrupts-and-safe-rollbacks/)
