# Multi-Agent Orchestration Patterns: Comprehensive Research 2024-2025

**Research Date:** January 2026
**Focus Areas:** Orchestrator/supervisor patterns, intent classification, routing, context transfer, response assembly, decision criteria

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Orchestrator/Supervisor Patterns](#orchestratorsupervisor-patterns)
3. [Intent Classification and Routing](#intent-classification-and-routing)
4. [Context Transfer Between Agents](#context-transfer-between-agents)
5. [Response Assembly from Multiple Agents](#response-assembly-from-multiple-agents)
6. [Single vs Multi-Agent Decision Criteria](#single-vs-multi-agent-decision-criteria)
7. [Framework Comparison](#framework-comparison)
8. [Performance Metrics and Benchmarks](#performance-metrics-and-benchmarks)
9. [Implementation Patterns](#implementation-patterns)
10. [Production Considerations](#production-considerations)

---

## Executive Summary

Multi-agent orchestration has evolved rapidly in 2024-2025, with clear patterns emerging across major frameworks (LangGraph, AutoGen, CrewAI, Google ADK, OpenAI Swarm). The consensus: **hierarchical orchestration with supervisor agents** is the dominant pattern for complex tasks, while **single agents remain optimal** for simple, focused operations.

### Key Insights

- **Hierarchical patterns** (supervisor → specialized workers) provide the best balance of control and scalability
- **Intent classification** and semantic routing are critical for directing tasks to appropriate specialist agents
- **Context engineering** has emerged as a new discipline for managing state and information flow between agents
- **Performance trade-offs**: Multi-agent systems show 88% vs 50% accuracy improvement over single agents, but at 3x latency and cost
- **Production reality**: Most frameworks are synchronous and in-memory; production requires external state stores and async architecture

---

## Orchestrator/Supervisor Patterns

### 1. Manager-Worker Pattern (Most Common)

**Architecture:**
```
Supervisor Agent (Orchestrator)
    ├── Specialist Agent 1 (e.g., Search)
    ├── Specialist Agent 2 (e.g., Database)
    ├── Specialist Agent 3 (e.g., Code Generation)
    └── Specialist Agent N
```

**Implementation across frameworks:**

#### LangGraph Hierarchical Teams
```python
# Supervisor node coordinates specialized agents
supervisor = Agent(
    role="Manager",
    goal="Coordinate workflow and delegate tasks",
    tools=[delegate_to_agent],
    allow_delegation=True
)

# Worker agents focus on specific tasks
search_agent = Agent(role="Search Specialist", tools=[web_search])
db_agent = Agent(role="Database Specialist", tools=[query_db])
code_agent = Agent(role="Code Generator", tools=[generate_code])

# Supervisor decides routing based on context
class SupervisorDecision(TypedDict):
    next_agent: str
    context: dict
```

**Key characteristics:**
- Supervisor has **no tools** (only orchestration logic)
- Workers have **specialized tools** and domain expertise
- Supervisor **decomposes** main problem into sub-tasks
- Communication flows through supervisor (star topology)

#### CrewAI Hierarchical Process
```python
crew = Crew(
    agents=[supervisor_agent, worker1, worker2, worker3],
    tasks=[task1, task2, task3],
    process=Process.hierarchical,  # Enables manager mode
    manager_agent=custom_manager,  # Optional: custom manager
    allow_delegation=True
)
```

**Features:**
- Auto-creates manager if not provided
- `allowed_agents` parameter for controlled delegation (new in 2024)
- Manager validates results before moving to next task

**Controlled delegation example:**
```python
executive = Agent(
    role="Executive Director",
    allow_delegation=True,
    allowed_agents=["Communications Manager", "Research Manager"]
)
# Reduces choice paralysis, creates clear hierarchy
```

#### AutoGen v0.4 Actor Model
```python
# Event-driven, asynchronous supervisor pattern
from autogen import ConversableAgent, GroupChat

supervisor = ConversableAgent(
    name="Supervisor",
    system_message="Coordinate agents to solve tasks"
)

# GroupChat with supervisor manages conversation flow
group_chat = GroupChat(
    agents=[supervisor, agent1, agent2, agent3],
    messages=[],
    max_round=20,
    speaker_selection_method="auto"  # or custom function
)
```

**v0.4 enhancements:**
- Actor model for distributed systems
- Async message passing
- Event-driven architecture
- Cross-language support (Python + .NET)

### 2. Orchestrator-Worker Pattern (Anthropic)

Anthropic's research system uses this pattern with key lessons:

**Architecture insights:**
- Lead agent **decomposes queries** into subtasks
- Each subagent needs: **objective, output format, tool guidance, task boundaries**
- Subagents operate **in parallel** for speed
- Lead agent **synthesizes** results

**Teaching the orchestrator:**
```python
orchestrator_prompt = """
You are a research orchestrator. For each query:
1. Decompose into 3-5 focused subtasks
2. For each subtask, specify:
   - Clear objective
   - Expected output format
   - Relevant tools/sources
   - Boundaries (what NOT to do)
3. Monitor progress and synthesize results
"""
```

### 3. Dynamic Orchestration with Reinforcement Learning

**Latest research (arXiv 2505.19591, May 2025):**

Traditional multi-agent systems use static collaboration patterns. Dynamic Orchestration introduces:

- **Runtime routing**: Orchestrator routes agents at each step based on current context
- **Sequential decision problem**: Each routing decision is optimized for current state
- **Adaptive evolution**: RL continuously updates orchestrator policy from completed tasks
- **Trajectory pruning**: Learns to emphasize strong agent paths, prune weak ones

**Benefits:**
- Flexible, scalable coordination
- Implicit inference graph
- Continuous improvement from feedback

---

## Intent Classification and Routing

### The Routing Problem

Modern LLM apps have dozens of specialized agents (retrievers, planners, tools). Misclassified intent cascades through incorrect agents, compounding errors.

### Routing Patterns

#### 1. Dispatcher Pattern (Google ADK)

**Concept:**
```
User Query → Intent Classifier → Route to Specialist
                                    ├── Weather Agent
                                    ├── News Agent
                                    ├── Booking Agent
                                    └── Chitchat Agent
```

**Implementation methods:**

**a) LLM-based routing:**
```python
router_prompt = """
Classify this query into one of: [WEATHER, NEWS, BOOKING, CHITCHAT]
Query: {user_query}
Classification:
"""
# Fast but costs 1 LLM call per request
```

**b) Fine-tuned classifier (recommended for production):**
```python
# Fine-tuned BERT on intent-labeled data
# Pros: Fast, cheap, accurate
# Cons: Requires training dataset
from transformers import pipeline
classifier = pipeline("text-classification", model="intent-classifier")
intent = classifier(user_query)[0]['label']
```

**c) Semantic routing (cutting-edge):**
```python
# Pre-encode example utterances for each intent
weather_examples = ["what's the weather", "is it raining", "temperature today"]
news_examples = ["latest headlines", "what's happening", "current events"]

# Embed user query, find nearest neighbor
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')

query_embedding = model.encode(user_query)
# Compare with pre-encoded intent examples
nearest_intent = find_nearest(query_embedding, intent_embeddings)
```

**Benefits of semantic routing:**
- No LLM call at runtime (cost savings)
- Sub-100ms latency
- Easy to add new intents (just add examples)

#### 2. Hierarchical Classification

For complex domains with many intents:

```python
# Level 1: Broad category (e.g., "Customer Service")
if confidence < threshold:
    ask_for_clarification()
else:
    # Level 2: Specific intent within category
    route_to_domain_specialist()
```

**Example architecture:**
```
User Query
    → Broad Classifier (General, Shopping, Support, Account)
        → Domain-Specific Classifier
            → Specialist Agent
```

#### 3. MARCO Framework (2024)

**Multi-Agent Real-time Chat Orchestration:**
- Optimizes real-time task execution
- Intelligent multi-agent coordination
- Handles intent in dynamic conversations

### Routing Best Practices

1. **Separation of concerns**: Routing agent handles collaboration, task agents focus on execution
2. **Focused agents succeed**: Agent with 5 tools > agent with 50 tools
3. **Fallback strategy**: When confidence < threshold, escalate to human or general agent
4. **Monitor misclassifications**: Track routing errors to identify edge cases

---

## Context Transfer Between Agents

### The Context Problem

As agents run longer, context explodes: chat history, tool outputs, documents, intermediate reasoning. This creates a bottleneck.

### Emerging Discipline: Context Engineering

**Treat context as a first-class system** with its own architecture, lifecycle, and constraints.

### Google ADK's Architecture Principles

#### 1. Separate Storage from Presentation
- **Sessions**: Durable state (persisted)
- **Working context**: Per-call view (ephemeral)

```python
# Session: Long-term memory
session = Session(
    id="user-123",
    state={"preferences": {...}, "history": [...]}
)

# Working context: Just what this call needs
working_context = session.build_context(
    current_turn=user_message,
    max_tokens=4000
)
```

#### 2. Explicit Transformations

Context built through **named, ordered processors:**

```python
context_processors = [
    TruncateProcessor(max_tokens=8000),
    PriorityProcessor(keep_recent=True),
    SummaryProcessor(summarize_old=True),
    ToolOutputProcessor(format_results=True)
]

context = apply_processors(raw_data, context_processors)
```

#### 3. Scope by Default

**Every model call sees minimum context required:**

```python
# Bad: All agents see everything
global_context = {**session_history, **all_tool_outputs, **all_docs}

# Good: Scoped context per agent
search_agent_context = filter_context(
    global_context,
    relevant_to=["search_results", "current_query"]
)
```

### Agent Handoff Patterns

#### LangGraph Supervisor Handoff
```python
class SupervisorDecision(TypedDict):
    next_agent: str
    context: dict  # Extracted context for next agent

# Supervisor extracts relevant context
def supervisor_node(state):
    decision = llm.invoke(state)
    return {
        "next": decision.next_agent,
        "messages": [
            SystemMessage(f"Context from supervisor: {decision.context}")
        ]
    }
```

#### OpenAI Swarm Handoffs
```python
def triage_agent(context_variables):
    # Handoff with context
    return agent_handoff(
        target_agent=sales_agent,
        context={"user_intent": "purchase", "product_id": "123"}
    )

# Next agent receives context
def sales_agent(context_variables):
    product_id = context_variables.get("product_id")
    # Continue with context
```

### Context Management Approaches

#### 1. Observation Masking
- Filter irrelevant observations before adding to context
- Only show agent what it needs

```python
def mask_observations(observations, agent_role):
    if agent_role == "search":
        return filter(lambda o: o.type == "search_result", observations)
    elif agent_role == "code":
        return filter(lambda o: o.type in ["code", "error"], observations)
```

#### 2. LLM Summarization
- Summarize old context to fit token limits
- Keep recent context verbatim

```python
if context_tokens > max_tokens:
    old_context = context[:split_point]
    summary = llm.summarize(old_context)
    new_context = summary + context[split_point:]
```

#### 3. SagaLLM Pattern (2024)
- **Checkpointing**: Save state at milestones
- **State restoration**: Roll back on errors
- **Constraint validation**: Ensure context integrity
- **Transactional rollback**: Undo failed agent chains

### Memory Architectures

#### Centralized Memory (Shared State)
```python
# All agents read/write to shared memory
shared_memory = {
    "conversation_history": [...],
    "facts": {...},
    "working_set": [...]
}

# Pros: Simple, consistent
# Cons: Tight coupling, conflicts
```

#### Decentralized Memory (Local + Sharing)
```python
# Each agent has local memory
agent1_memory = LocalMemory()
agent2_memory = LocalMemory()

# Share selectively
agent1.share_with(agent2, key="search_results")

# Pros: Efficiency, control
# Cons: Coordination overhead
```

#### Letta Framework
- **In-context memory**: Current conversation
- **Persistent blocks**: State across requests
- **Archival memory**: Long-term storage
- **Multi-agent orchestration**: Built-in state sharing

### A2A Protocol (Agent-to-Agent) - Google 2024

**Open standard for agent interoperability:**
- Universal communication protocol
- Enterprise-grade auth/authz
- Long-running task support
- Multimodal interactions
- Dynamic capability discovery

### Model Context Protocol (MCP) - Anthropic

**Standard for connecting AI to data sources:**
- Two-way connections
- Tool/resource discovery
- Security boundaries

---

## Response Assembly from Multiple Agents

### Parallel/Concurrent Aggregation Pattern

**Use case:** Multiple agents analyze same problem from different angles, results synthesized

**Architecture:**
```
User Query → Dispatcher
                ├── Code Review Agent → Result 1
                ├── Security Agent → Result 2
                ├── Performance Agent → Result 3
                └── Best Practices Agent → Result 4
                        ↓
                Aggregator/Synthesizer Agent
                        ↓
                    Final Response
```

**Implementation:**

```python
# Fan-out phase
async def parallel_analysis(code_snippet):
    tasks = [
        code_review_agent.analyze(code_snippet),
        security_agent.analyze(code_snippet),
        performance_agent.analyze(code_snippet),
        best_practices_agent.analyze(code_snippet)
    ]
    results = await asyncio.gather(*tasks)

    # Fan-in phase (aggregation)
    final_report = synthesizer_agent.aggregate(results)
    return final_report
```

**Aggregation strategies:**

#### 1. Full Context Aggregation (CrewAI)
```python
# Pass complete, unmodified outputs
planner_agent_context = {
    "flight_results": flight_agent.output,  # Full tokens
    "weather_data": weather_agent.output,   # Full tokens
    "activities": activity_agent.output     # Full tokens
}

# Pros: Complete information
# Cons: Token explosion
```

#### 2. Selective Aggregation
```python
# Extract key fields only
synthesized_context = {
    "best_flight": extract_top_result(flight_agent.output),
    "weather_summary": summarize(weather_agent.output),
    "recommended_activity": activity_agent.output["top_choice"]
}

# Pros: Token efficiency
# Cons: May lose nuance
```

#### 3. Structured Aggregation
```python
# Define output schema for each agent
class AgentOutput(BaseModel):
    summary: str
    confidence: float
    details: dict

# Aggregator combines structured outputs
def aggregate(outputs: List[AgentOutput]):
    weighted_summary = weighted_avg(
        [o.summary for o in outputs],
        [o.confidence for o in outputs]
    )
    return weighted_summary
```

### Sequential Pipeline Pattern

**Use case:** Task has clear stages, each agent builds on previous

**Architecture:**
```
Input → Agent A → Agent B → Agent C → Output
        (Parse)   (Analyze) (Format)
```

**Implementation:**
```python
# Linear, deterministic pipeline
result = input_data
for agent in [parse_agent, analyze_agent, format_agent]:
    result = agent.process(result)
return result

# Pros: Easy to debug, predictable
# Cons: No parallelism, bottlenecks
```

### AWS Bedrock Multi-Agent Collaboration

**Native collaboration features:**
- Automatic task delegation
- Response aggregation across agents
- Enterprise-grade reliability
- Built-in monitoring

### Microsoft Agent Framework Patterns

**Built-in orchestration patterns:**

1. **Sequential**: Agent A → Agent B → Agent C
2. **Concurrent**: All agents run in parallel, aggregate at end
3. **Hand-off**: Agent A decides when to transfer to Agent B
4. **Magentic**: Magnetic attraction between compatible agents

### When to Avoid Concurrent Aggregation

**Don't use when:**
- No clear conflict resolution strategy (what if agents disagree?)
- Aggregation logic is too complex
- Results lower quality (more opinions ≠ better outcome)
- Latency-sensitive (parallel = multiple LLM calls)

---

## Single vs Multi-Agent Decision Criteria

### Decision Framework

```
Start with single agent → Does it struggle? → Consider multi-agent
                              ↓ No
                         Ship it ✓
```

### When to Use Single Agent

**Best for:**
- Simple retrieval tasks (fetch document, summarize)
- Focused operations with clear scope
- Low-latency requirements (one LLM call)
- Prototyping and MVP

**Characteristics:**
- 1-3 tools maximum
- Clear input → output mapping
- No complex decision trees
- Predictable execution path

**Example tasks:**
- "Summarize this document"
- "Search database for X"
- "Generate code snippet for Y"
- "Translate text"

**Performance:**
- Latency: ~2-5 seconds
- Cost: 1-2 LLM calls
- Accuracy: 50% on complex strategic reasoning (research)
- Debugging: Simple

### When to Use Multi-Agent

**Best for:**
- Complex, multi-step tasks
- Diverse skill requirements (code + design + writing)
- Task decomposition needed
- Specialist expertise required
- Long-running workflows
- Collaborative review/refinement

**Characteristics:**
- 4+ distinct capabilities needed
- Dynamic routing based on context
- Iterative refinement (agent A critiques agent B)
- Cross-domain expertise

**Example tasks:**
- "Build and deploy full web application"
- "Research topic, write report, create presentation"
- "Analyze codebase, identify bugs, generate fixes, test"
- "Multi-modal tasks (text + vision + code)"

**Performance:**
- Latency: 3x slower than single agent
- Cost: 3x higher (multiple LLM calls)
- Accuracy: 88% on strategic reasoning (vs 50% single agent)
- Debugging: Complex (which agent failed?)

### Microsoft's Decision Criteria

**Questions to ask:**
1. **Can single entity handle it?** If yes → single agent
2. **Need distributed intelligence?** If yes → multi-agent
3. **Scalability requirements?** High → multi-agent
4. **Fault tolerance needs?** High → multi-agent
5. **Deterministic workflow possible?** If yes → prefer deterministic

**Choose deterministic workflows when:**
- Logic is clear and fixed
- Reliability > flexibility
- Debugging/auditing critical

**Choose LLM orchestration when:**
- Dynamic decision-making needed
- Flexibility > predictability
- Innovation encouraged

### Research Evidence

**Study on human reasoning simulation:**
- Single LLM accuracy: 50%
- Multi-agent system accuracy: 88%
- Task: Strategic reasoning with personality pairs

### Practical Challenges (Cognition.ai, 2025)

**Reality check:**
> "In 2025, running multiple agents in collaboration only results in fragile systems."

**Issues observed:**
- **Latency**: 3-agent chains tripled response time
- **Cost**: Every agent = another LLM call
- **Debugging**: Hard to trace failures
- **Fragility**: More points of failure

**When fragility is acceptable:**
- Internal tools (humans can retry)
- Non-critical paths
- High-value tasks (cost justified)

### Benefits of Multi-Agent (When Done Right)

1. **Hallucination mitigation**: Agents cross-verify information
2. **Context window expansion**: Distribute load across agents
3. **Specialization**: Each agent masters specific domain
4. **Scalability**: Add agents without retraining

---

## Framework Comparison

### Overview Table

| Framework | Strength | Best For | Production-Ready | Learning Curve |
|-----------|----------|----------|------------------|----------------|
| **LangGraph** | Precise control, graph-based | Custom workflows, complex state | ✓ Yes | High |
| **AutoGen v0.4** | Research-driven, flexibility | Experimentation, research | ✓ Yes | High |
| **CrewAI** | Simple, role-based | Rapid prototyping | ⚠ Partial | Low |
| **Google ADK** | Multi-agent focus, context mgmt | Enterprise, multi-agent | ✓ Yes | Medium |
| **OpenAI Swarm** | Handoffs, routines | Educational, simple flows | ✗ Experimental | Low |
| **Semantic Kernel** | Enterprise features, .NET | .NET ecosystem, enterprise | ✓ Yes | Medium |

### LangGraph

**Strengths:**
- Full control over graph structure (nodes, edges, conditional routing)
- Stateful workflows with checkpointing
- Explicit error handling and loops
- Best for complex, custom orchestration

**Multi-agent capabilities:**
- Hierarchical teams (subgraphs as agents)
- Supervisor pattern built-in
- Collaboration via shared scratchpad
- Sequential, parallel, branching flows

**Code pattern:**
```python
from langgraph.graph import StateGraph

# Define state
class AgentState(TypedDict):
    messages: List[Message]
    next: str

# Build graph
graph = StateGraph(AgentState)
graph.add_node("supervisor", supervisor_node)
graph.add_node("worker1", worker1_node)
graph.add_node("worker2", worker2_node)

# Conditional routing
graph.add_conditional_edges(
    "supervisor",
    route_to_worker,
    {"worker1": "worker1", "worker2": "worker2"}
)
```

**When to use:**
- Need precise control over workflow
- Complex branching/looping logic
- Stateful, long-running tasks
- Custom error recovery

### AutoGen v0.4

**Strengths:**
- Actor model (distributed, scalable)
- Async, event-driven architecture
- Cross-language support (Python + .NET)
- Research-oriented (cutting-edge patterns)

**Multi-agent capabilities:**
- GroupChat for multi-agent collaboration
- Speaker selection (auto or custom)
- Nested conversations
- Reflection and self-critique

**Architecture:**
```python
from autogen import ConversableAgent

# Agents with roles
assistant = ConversableAgent(name="Assistant", llm_config=config)
user_proxy = ConversableAgent(name="User", human_input_mode="ALWAYS")

# Group chat
from autogen import GroupChat, GroupChatManager
group_chat = GroupChat(
    agents=[assistant, specialist1, specialist2],
    messages=[],
    max_round=10
)
manager = GroupChatManager(groupchat=group_chat)
```

**When to use:**
- Rapid prototyping of agent behaviors
- Research and experimentation
- Need async/distributed architecture
- Cross-language requirements

**v0.4 improvements:**
- Replaced synchronous loops with actor model
- Better observability (OpenTelemetry)
- Modular, pluggable components
- Long-running, proactive agents

### CrewAI

**Strengths:**
- Simplest to get started
- Role-based design (intuitive)
- Graph-based execution (not just linear)
- Multi-LLM support (mix GPT, Claude, LLaMA)

**Multi-agent capabilities:**
- Hierarchical process (auto-creates manager)
- Sequential and parallel tasks
- Delegation between agents
- Context sharing

**Code pattern:**
```python
from crewai import Agent, Task, Crew, Process

# Define agents with roles
manager = Agent(role="Project Manager", goal="Coordinate team")
developer = Agent(role="Developer", goal="Write code", tools=[code_tools])
reviewer = Agent(role="Code Reviewer", goal="Review quality")

# Define tasks
tasks = [
    Task(description="Implement feature X", agent=developer),
    Task(description="Review code", agent=reviewer, context=[tasks[0]])
]

# Create crew
crew = Crew(
    agents=[manager, developer, reviewer],
    tasks=tasks,
    process=Process.hierarchical
)

result = crew.kickoff()
```

**When to use:**
- Need to ship quickly
- Role-based workflow fits naturally
- Don't need deep customization
- Team familiar with role abstractions

**Limitations:**
- Highly opinionous (hard to customize deeply)
- Synchronous, in-memory (not prod-ready for long tasks)
- Less control over orchestration logic

### Google ADK (Agent Development Kit)

**Strengths:**
- Built for multi-agent systems
- Context engineering focus
- A2A protocol (agent interoperability)
- Enterprise features (auth, governance)

**Multi-agent patterns:**
- Dispatcher (routing)
- Hierarchical (supervisor)
- Collaborative (shared context)
- Scatter-gather (parallel + aggregate)

**Code pattern:**
```python
# ADK's context scoping
@adk.agent
def search_agent(context: Context):
    # Scoped context (only sees relevant data)
    results = search(context.query)
    return results

# Supervisor routes to specialists
@adk.agent
def supervisor(context: Context):
    intent = classify_intent(context.query)
    if intent == "search":
        return route_to(search_agent, context)
    elif intent == "code":
        return route_to(code_agent, context)
```

**When to use:**
- Building multi-agent from scratch
- Need sophisticated context management
- Enterprise requirements (security, governance)
- Agent-to-agent communication across systems

### OpenAI Swarm → Agents SDK

**Status:** Swarm is experimental (not for production). Migrated to **Agents SDK** (production-ready).

**Strengths:**
- Simplest handoff pattern
- Great for learning
- Lightweight (no heavy abstractions)
- Routines + handoffs primitives

**Code pattern:**
```python
def triage_agent():
    """Initial contact, routes to specialists"""
    return handoff_to(sales_agent) if intent == "buy" else handoff_to(support_agent)

def sales_agent(context_variables):
    """Handle sales inquiries"""
    product = context_variables.get("product")
    # Process sale

def support_agent(context_variables):
    """Handle support requests"""
    # Process support
```

**When to use (Swarm):**
- Educational purposes
- Prototyping handoff flows
- Simple, linear agent chains

**When to use (Agents SDK):**
- Production multi-agent systems
- Need enterprise features
- Actively maintained

### Semantic Kernel + Agent Framework (Microsoft)

**Strengths:**
- Combines Semantic Kernel + AutoGen patterns
- Enterprise-grade features
- .NET + Python support
- Type safety, filters, telemetry

**Multi-agent patterns:**
- Sequential
- Concurrent
- Hand-off
- Magentic (magnetic attraction)

**When to use:**
- .NET ecosystem
- Enterprise requirements
- Need type safety and strong contracts
- Microsoft stack

---

## Performance Metrics and Benchmarks

### Key Benchmarks

#### 1. MultiAgentBench / MARBLE
- Evaluates collaboration quality (not just task completion)
- Milestone-based KPIs
- Tests coordination protocols: star, chain, tree, graph topologies
- Measures group discussion vs cognitive planning strategies

#### 2. AgentBench (ICLR'24)
- First benchmark for LLM-as-Agent
- 8 diverse environments
- Tests autonomous agent capabilities

#### 3. CLASSIC Framework (Enterprise)

Five dimensions for enterprise AI agents:

| Dimension | Metric | Target |
|-----------|--------|--------|
| **Cost** | Token usage, API calls, infrastructure | Minimize |
| **Latency** | TTFT, end-to-end response time | <5s ideal |
| **Accuracy** | Task success rate, hallucination rate | >90% |
| **Stability** | Uptime, error rate, consistency | 99.9% |
| **Security** | Auth, data privacy, compliance | Zero breaches |

### Latency Metrics

**Time To First Token (TTFT):**
- Delay before user sees first token
- Critical for streaming UX
- Target: <1s for good UX

**Inter-Token Latency (ITL):**
- Delay between tokens during generation
- Affects perceived speed
- Target: <50ms for smooth streaming

**End-to-End Request Latency:**
- Total time for complete response
- More relevant for async agents
- Varies widely: 2s (single agent) to 20s+ (multi-agent)

### Cost Metrics

**Token usage:**
- Input tokens (prompt + context)
- Output tokens (generated response)
- Multi-agent: Multiply by number of agents

**Example cost comparison:**

| Architecture | LLM Calls | Avg Tokens | Cost (GPT-4) |
|--------------|-----------|------------|--------------|
| Single Agent | 1-2 | 4,000 | $0.12 |
| 3-Agent Sequential | 3-4 | 12,000 | $0.36 |
| 5-Agent Parallel + Aggregator | 6 | 20,000 | $0.60 |

**Claude cost note:**
- Second-best accuracy
- Higher operational costs
- Need cost-efficient benchmarks

### Multi-Agent Specific Metrics

**Coordination Efficiency:**
- Communication overhead (messages between agents)
- Decision synchronization (alignment of actions)
- Adaptive feedback loops (refinement based on prior interactions)

**Communication Efficiency:**
```
Efficiency = Useful Information Transferred / Total Messages
```

**Trajectory Quality:**
- How often does supervisor route to correct agent?
- How many retries needed?
- Success rate per agent

### Performance Benchmarks (Research Data)

**Single vs Multi-Agent Accuracy:**
- Single LLM: 50% on strategic reasoning tasks
- Multi-agent: 88% on same tasks
- Improvement: +76%

**Latency Comparison:**
- Single agent: 2-5 seconds
- 3-agent chain: 6-15 seconds (3x)
- 5-agent parallel: 8-20 seconds (latency of slowest + aggregation)

**Cost Comparison:**
- Single agent: Baseline
- Multi-agent: 3-5x baseline (depending on architecture)

### Observability and Monitoring

**Datadog LLM Observability:**
- End-to-end tracing across agents
- Track inputs, outputs, latency, token usage, errors at each step
- Identify bottlenecks in multi-agent flows

**Instrumentation frameworks:**
- **LangSmith**: LangChain's observability platform
- **Arize AI**: ML observability, drift detection
- **OpenTelemetry**: Industry-standard tracing

**What to track:**
```python
metrics = {
    "total_tokens": sum(agent.tokens for agent in agents),
    "total_latency": end_time - start_time,
    "agent_latencies": {agent.name: agent.latency for agent in agents},
    "success_rate": successful_tasks / total_tasks,
    "retry_count": sum(agent.retries for agent in agents),
    "cost": calculate_cost(total_tokens)
}
```

### Cost-Performance Tradeoffs

**Pareto optimization:**
- Plot accuracy vs cost
- Find optimal point on curve
- Example: GPT-4o on Azure (fast, accurate) vs Claude (accurate, expensive)

**Optimization strategies:**
1. **Caching**: Reuse context across calls (Anthropic prompt caching)
2. **Parallelization**: Run independent agents concurrently
3. **Model routing**: Use small models for simple tasks, large for complex
4. **Context pruning**: Only pass necessary information

---

## Implementation Patterns

### Pattern 1: Hierarchical Team (LangGraph)

```python
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import create_react_agent

# State shared across agents
class TeamState(TypedDict):
    messages: List[Message]
    next: str
    context: dict

# Create supervisor
supervisor_prompt = """
You are a supervisor coordinating a team of specialists:
- researcher: Searches web, gathers information
- coder: Writes and debugs code
- writer: Creates documentation

Given the user request, decide which worker to assign the next task.
When the task is complete, respond with FINISH.
"""

supervisor_agent = create_react_agent(
    llm,
    tools=[],
    state_modifier=supervisor_prompt
)

# Create workers
researcher = create_react_agent(llm, tools=[web_search, read_url])
coder = create_react_agent(llm, tools=[execute_code, read_file])
writer = create_react_agent(llm, tools=[write_document])

# Routing function
def route_to_worker(state: TeamState) -> str:
    decision = supervisor_agent.invoke(state)
    next_worker = parse_decision(decision)

    if next_worker == "FINISH":
        return END
    return next_worker

# Build graph
graph = StateGraph(TeamState)
graph.add_node("supervisor", supervisor_agent)
graph.add_node("researcher", researcher)
graph.add_node("coder", coder)
graph.add_node("writer", writer)

# Supervisor decides routing
graph.add_conditional_edges(
    "supervisor",
    route_to_worker,
    {
        "researcher": "researcher",
        "coder": "coder",
        "writer": "writer",
        END: END
    }
)

# Workers report back to supervisor
for worker in ["researcher", "coder", "writer"]:
    graph.add_edge(worker, "supervisor")

graph.set_entry_point("supervisor")
team = graph.compile()

# Execute
result = team.invoke({"messages": [HumanMessage(content="Build a web scraper")]})
```

### Pattern 2: Intent Router + Specialists (Custom)

```python
from typing import Literal
from pydantic import BaseModel
from anthropic import Anthropic

client = Anthropic()

# Define intents
class Intent(BaseModel):
    category: Literal["search", "code", "write", "analyze"]
    confidence: float
    reasoning: str

# Router agent (uses structured output)
def route_request(user_query: str) -> Intent:
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"""
            Classify this request into one category:
            - search: Web search, research, finding information
            - code: Programming, debugging, code generation
            - write: Writing documents, reports, content
            - analyze: Data analysis, interpretation, insights

            Request: {user_query}

            Respond with JSON: {{"category": "...", "confidence": 0.0-1.0, "reasoning": "..."}}
            """
        }]
    )

    intent_data = json.loads(response.content[0].text)
    return Intent(**intent_data)

# Specialist agents
search_agent = Agent(name="Search", tools=[web_search], prompt=search_prompt)
code_agent = Agent(name="Coder", tools=[execute_code], prompt=code_prompt)
write_agent = Agent(name="Writer", tools=[write_doc], prompt=write_prompt)
analyze_agent = Agent(name="Analyst", tools=[analyze_data], prompt=analyze_prompt)

# Orchestrator
def orchestrate(user_query: str):
    # Route to specialist
    intent = route_request(user_query)

    if intent.confidence < 0.7:
        # Low confidence, ask for clarification
        return "I'm not sure how to help. Can you clarify your request?"

    # Dispatch to specialist
    agents = {
        "search": search_agent,
        "code": code_agent,
        "write": write_agent,
        "analyze": analyze_agent
    }

    specialist = agents[intent.category]
    result = specialist.run(user_query)

    return result
```

### Pattern 3: Parallel Execution + Aggregation (AsyncIO)

```python
import asyncio
from typing import List

# Specialist agents
async def code_review_agent(code: str) -> dict:
    # Analyze code quality
    return {"score": 8, "issues": ["missing docstring"], "agent": "code_review"}

async def security_agent(code: str) -> dict:
    # Check for security issues
    return {"score": 9, "issues": [], "agent": "security"}

async def performance_agent(code: str) -> dict:
    # Analyze performance
    return {"score": 7, "issues": ["O(n²) loop"], "agent": "performance"}

# Parallel execution
async def analyze_code_parallel(code_snippet: str) -> dict:
    # Fan-out: All agents run in parallel
    results = await asyncio.gather(
        code_review_agent(code_snippet),
        security_agent(code_snippet),
        performance_agent(code_snippet)
    )

    # Fan-in: Aggregate results
    aggregated = {
        "overall_score": sum(r["score"] for r in results) / len(results),
        "all_issues": [issue for r in results for issue in r["issues"]],
        "agent_reports": results
    }

    # Synthesizer agent creates final report
    final_report = synthesizer_agent.create_report(aggregated)

    return final_report

# Usage
result = asyncio.run(analyze_code_parallel(user_code))
```

### Pattern 4: Context-Scoped Handoffs (Production)

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class AgentContext:
    """Scoped context passed between agents"""
    query: str
    session_id: str
    history: List[Message]
    max_tokens: int = 4000

    def filter_for_agent(self, agent_name: str) -> dict:
        """Return only relevant context for this agent"""
        if agent_name == "search":
            return {
                "query": self.query,
                "recent_queries": self.history[-3:]
            }
        elif agent_name == "code":
            return {
                "query": self.query,
                "code_history": [m for m in self.history if m.type == "code"]
            }
        # Default: minimal context
        return {"query": self.query}

class Agent:
    def __init__(self, name: str, tools: List):
        self.name = name
        self.tools = tools

    def run(self, context: AgentContext) -> str:
        # Get scoped context
        scoped = context.filter_for_agent(self.name)

        # Run with minimal context
        result = self.llm.invoke(
            prompt=self.prompt,
            context=scoped,
            tools=self.tools
        )

        return result

class Supervisor:
    def __init__(self, agents: List[Agent]):
        self.agents = {a.name: a for a in agents}

    def orchestrate(self, user_query: str, session_id: str):
        # Build full context
        context = AgentContext(
            query=user_query,
            session_id=session_id,
            history=load_history(session_id)
        )

        # Route to agent
        agent_name = self.route(context)
        agent = self.agents[agent_name]

        # Agent receives scoped context
        result = agent.run(context)

        # Save to history
        save_history(session_id, result)

        return result
```

### Pattern 5: ReWOO (Reasoning Without Observation)

**AWS Strands Agents pattern:**

```python
# Phase 1: Planning
plan = planner_agent.create_plan(user_query)
# Output: [
#   {"step": 1, "action": "search", "input": "LangGraph docs"},
#   {"step": 2, "action": "read", "input": "search_result_url"},
#   {"step": 3, "action": "summarize", "input": "read_content"}
# ]

# Phase 2: Execution (parallel where possible)
results = {}
for step in plan:
    if step_dependencies_met(step, results):
        results[step["step"]] = execute_tool(step["action"], step["input"])

# Phase 3: Synthesis
final_answer = synthesizer_agent.create_answer(
    query=user_query,
    plan=plan,
    results=results
)
```

**Benefits:**
- Clear separation of planning, execution, synthesis
- Enables parallel execution of independent steps
- Easier to debug (inspect plan before execution)

### Pattern 6: Reflexion (Iterative Refinement)

```python
def reflexion_loop(task: str, max_iterations: int = 3):
    attempt = initial_agent.solve(task)

    for i in range(max_iterations):
        # Critic evaluates attempt
        critique = critic_agent.evaluate(task, attempt)

        if critique["score"] >= 9:
            return attempt  # Good enough

        # Refiner improves based on critique
        attempt = refiner_agent.improve(
            task=task,
            previous_attempt=attempt,
            critique=critique
        )

    return attempt
```

---

## Production Considerations

### 1. State Management

**Problem:** Most frameworks are synchronous and in-memory. Production needs persistence.

**Solutions:**

#### External State Store
```python
# Bad: In-memory (lost on crash)
agent_state = {"messages": [], "context": {}}

# Good: External store
import redis
r = redis.Redis()

def save_state(session_id: str, state: dict):
    r.set(f"session:{session_id}", json.dumps(state))

def load_state(session_id: str) -> dict:
    data = r.get(f"session:{session_id}")
    return json.loads(data) if data else {}
```

#### Checkpointing (LangGraph)
```python
from langgraph.checkpoint import MemorySaver, SqliteSaver

# Development: In-memory
checkpointer = MemorySaver()

# Production: Persistent
checkpointer = SqliteSaver.from_conn_string("checkpoints.db")

# Use in graph
graph = StateGraph(AgentState)
# ... add nodes/edges ...
app = graph.compile(checkpointer=checkpointer)

# State automatically persisted at each step
```

### 2. Async Architecture for Long-Running Tasks

**Problem:** Agent tasks can take minutes/hours. HTTP request timeout.

**Solution: Job Queue Pattern**

```python
from celery import Celery
from redis import Redis

app = Celery('agents', broker='redis://localhost:6379')
redis_client = Redis()

# Enqueue task
@app.route('/agent/run', methods=['POST'])
def run_agent():
    task_id = str(uuid.uuid4())
    agent_task.apply_async(
        args=[request.json],
        task_id=task_id
    )
    return {"task_id": task_id, "status": "queued"}

# Worker executes agent
@app.task(bind=True)
def agent_task(self, params):
    # Update status
    redis_client.set(f"task:{self.request.id}:status", "running")

    # Run multi-agent workflow
    result = orchestrator.run(params)

    # Save result
    redis_client.set(f"task:{self.request.id}:result", json.dumps(result))
    redis_client.set(f"task:{self.request.id}:status", "completed")

# Poll for status
@app.route('/agent/status/<task_id>')
def get_status(task_id):
    status = redis_client.get(f"task:{task_id}:status")
    result = redis_client.get(f"task:{task_id}:result")

    return {
        "status": status,
        "result": json.loads(result) if result else None
    }
```

### 3. Error Handling and Retries

**Supervisor must handle failures:**

```python
def supervisor_with_retry(state: AgentState, max_retries: int = 2):
    agent_name = route(state)

    for attempt in range(max_retries):
        try:
            result = agents[agent_name].run(state)

            # Validate result
            if validate(result):
                return result
            else:
                # Try different agent
                agent_name = fallback_agent(agent_name)

        except Exception as e:
            log_error(e, agent_name, attempt)

            if attempt == max_retries - 1:
                # Final failure: flag in report
                return {
                    "success": False,
                    "error": str(e),
                    "failed_agent": agent_name
                }

    return result
```

### 4. Rate Limiting and Cost Controls

```python
from functools import wraps
import time

class RateLimiter:
    def __init__(self, max_calls_per_minute: int):
        self.max_calls = max_calls_per_minute
        self.calls = []

    def allow(self) -> bool:
        now = time.time()
        # Remove calls older than 1 minute
        self.calls = [c for c in self.calls if now - c < 60]

        if len(self.calls) < self.max_calls:
            self.calls.append(now)
            return True
        return False

# Per-agent rate limiting
agent_limiters = {
    "search": RateLimiter(max_calls_per_minute=10),
    "code": RateLimiter(max_calls_per_minute=5),
}

def rate_limited_invoke(agent_name: str, *args, **kwargs):
    limiter = agent_limiters[agent_name]

    if not limiter.allow():
        raise RateLimitError(f"Rate limit exceeded for {agent_name}")

    return agents[agent_name].invoke(*args, **kwargs)
```

### 5. Observability

**Structured logging:**

```python
import structlog

logger = structlog.get_logger()

def supervisor_node(state: AgentState):
    logger.info(
        "supervisor.routing",
        session_id=state["session_id"],
        query=state["messages"][-1],
        available_agents=list(agents.keys())
    )

    next_agent = route(state)

    logger.info(
        "supervisor.routed",
        session_id=state["session_id"],
        selected_agent=next_agent
    )

    return {"next": next_agent}
```

**OpenTelemetry tracing:**

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

def orchestrate(query: str, session_id: str):
    with tracer.start_as_current_span("orchestrate") as span:
        span.set_attribute("session_id", session_id)
        span.set_attribute("query", query)

        # Route
        with tracer.start_as_current_span("route"):
            agent_name = route(query)
            span.set_attribute("selected_agent", agent_name)

        # Execute
        with tracer.start_as_current_span(f"agent.{agent_name}"):
            result = agents[agent_name].run(query)

        return result
```

### 6. Testing Multi-Agent Systems

**Unit tests for individual agents:**

```python
def test_search_agent():
    agent = search_agent
    result = agent.run("Python asyncio tutorial")

    assert "asyncio" in result.lower()
    assert len(result) > 100
```

**Integration tests for orchestration:**

```python
def test_supervisor_routing():
    # Given a code question
    query = "How do I use asyncio.gather?"

    # Supervisor should route to code agent
    state = {"messages": [HumanMessage(content=query)]}
    next_agent = supervisor.route(state)

    assert next_agent == "coder"

def test_end_to_end_flow():
    # Full multi-agent workflow
    result = orchestrator.run("Research Python async patterns and write summary")

    # Should have used researcher and writer
    assert "researcher" in result.agents_used
    assert "writer" in result.agents_used

    # Result should be coherent
    assert len(result.output) > 500
```

### 7. Graceful Degradation

```python
def orchestrate_with_fallback(query: str):
    try:
        # Try multi-agent approach
        return multi_agent_orchestrator.run(query)
    except Exception as e:
        logger.warning("Multi-agent failed, falling back to single agent", error=str(e))

        # Fallback: Single powerful agent
        return single_agent.run(query)
```

---

## Key Takeaways

### Design Principles

1. **Start simple**: Single agent → Multi-agent only when needed
2. **Supervisor pattern dominates**: Central orchestrator + specialized workers
3. **Context is critical**: Scope context per agent, don't pass everything
4. **Intent routing matters**: Correct routing = task success
5. **Expect failures**: Retries, fallbacks, error handling built-in
6. **Monitor everything**: Latency, cost, tokens, success rate

### Architectural Recommendations

**For prototypes:**
- CrewAI (simple, fast to ship)
- OpenAI Swarm (learning handoffs)

**For custom workflows:**
- LangGraph (full control, complex logic)
- Google ADK (multi-agent focus)

**For research:**
- AutoGen v0.4 (cutting-edge patterns, async)

**For enterprise:**
- Microsoft Agent Framework (type safety, .NET)
- Google ADK (A2A protocol, governance)

### When to Use Multi-Agent

**Use multi-agent if ≥2 of these are true:**
- Task requires 4+ distinct capabilities
- Need specialist expertise (code + design + writing)
- Iterative refinement needed (review/critique cycles)
- Task is long-running (minutes/hours)
- Accuracy > cost/latency

**Stick with single agent if:**
- Simple retrieval/transformation
- Latency-sensitive (<5s requirement)
- Cost-constrained
- Deterministic workflow possible

### Production Checklist

- [ ] External state store (Redis, PostgreSQL)
- [ ] Async architecture (job queue for long tasks)
- [ ] Error handling and retries per agent
- [ ] Rate limiting per agent
- [ ] Cost tracking and budgets
- [ ] Structured logging + tracing (OpenTelemetry)
- [ ] Unit and integration tests
- [ ] Graceful degradation (fallback to single agent)
- [ ] Monitoring dashboard (latency, cost, success rate)
- [ ] Alerting on failures/anomalies

---

## Sources

### LangGraph
- [LangGraph Multi-Agent Orchestration: Complete Framework Guide](https://latenode.com/blog/ai-frameworks-technical-infrastructure/langgraph-multi-agent-orchestration/langgraph-multi-agent-orchestration-complete-framework-guide-architecture-analysis-2025)
- [LangGraph: Multi-Agent Workflows](https://blog.langchain.com/langgraph-multi-agent-workflows/)
- [LangGraph AI Framework 2025](https://latenode.com/blog/langgraph-ai-framework-2025-complete-architecture-guide-multi-agent-orchestration-analysis)
- [Multi-Agent System Tutorial with LangGraph](https://blog.futuresmart.ai/multi-agent-system-with-langgraph)
- [Hierarchical Agent Teams](https://langchain-ai.github.io/langgraph/tutorials/multi_agent/hierarchical_agent_teams/)

### AutoGen
- [AutoGen - Microsoft Research](https://www.microsoft.com/en-us/research/project/autogen/)
- [GitHub - microsoft/autogen](https://github.com/microsoft/autogen)
- [Microsoft AutoGen: Redefining Multi-Agent System Frameworks](https://www.akira.ai/blog/microsoft-autogen-with-multi-agent-system)
- [New AutoGen Architecture Preview](https://microsoft.github.io/autogen/0.2/blog/2024/10/02/new-autogen-architecture-preview/)
- [Design Patterns for AI Agents: Using Autogen](https://medium.com/@LakshmiNarayana_U/design-patterns-for-ai-agents-using-autogen-for-effective-multi-agent-collaboration-5f1067a7c63b)

### CrewAI
- [GitHub - crewAIInc/crewAI](https://github.com/crewAIInc/crewAI)
- [Hierarchical AI Agents: A Guide to CrewAI Delegation](https://activewizards.com/blog/hierarchical-ai-agents-a-guide-to-crewai-delegation)
- [Orchestrating Specialist AI Agents with CrewAI](https://activewizards.com/blog/orchestrating-specialist-ai-agents-with-crewai-a-guide)
- [Hierarchical Process - CrewAI](https://docs.crewai.com/how-to/hierarchical-process)

### Research Papers
- [Multi-Agent Collaboration via Evolving Orchestration](https://arxiv.org/html/2505.19591v1)
- [Multi-Agent Collaboration Mechanisms: A Survey of LLMs](https://arxiv.org/html/2501.06322v1)
- [LLM-Based Multi-Agent Systems for Software Engineering](https://dl.acm.org/doi/10.1145/3712003)
- [Evaluation and Benchmarking of LLM Agents: A Survey](https://arxiv.org/html/2507.21504v1)
- [Towards Effective GenAI Multi-Agent Collaboration](https://arxiv.org/html/2412.05449v1)
- [AgentOrchestra Framework](https://arxiv.org/html/2506.12508v1)
- [Taxonomy of Hierarchical Multi-Agent Systems](https://arxiv.org/html/2508.12683)

### Google & Google ADK
- [Developer's guide to multi-agent patterns in ADK](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/)
- [Architecting efficient context-aware multi-agent framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)
- [Vertex AI Agent Builder overview](https://docs.cloud.google.com/agent-builder/overview)
- [Build and manage multi-system agents with Vertex AI](https://cloud.google.com/blog/products/ai-machine-learning/build-and-manage-multi-system-agents-with-vertex-ai)

### OpenAI
- [GitHub - openai/swarm](https://github.com/openai/swarm)
- [OpenAI Swarm: Multi-Agent Systems](https://medium.com/@michael_79773/exploring-openais-swarm-an-experimental-framework-for-multi-agent-systems-5ba09964ca18)
- [OpenAI's Swarm AI agent framework](https://venturebeat.com/ai/openais-swarm-ai-agent-framework-routines-and-handoffs)

### Intent Classification & Routing
- [Intent Recognition and Auto-Routing in Multi-Agent Systems](https://gist.github.com/mkbctrl/a35764e99fe0c8e8c00b2358f55cd7fa)
- [Enhancing Intent Classification in Agentic LLM Applications](https://medium.com/@mr.murga/enhancing-intent-classification-and-error-handling-in-agentic-llm-applications-df2917d0a3cc)
- [AI Agent Routing: Tutorial & Best Practices](https://www.patronus.ai/ai-agent-development/ai-agent-routing)
- [MARCO: Multi-Agent Real-time Chat Orchestration](https://thegrigorian.medium.com/marco-multi-agent-real-time-chat-orchestration-a5071267fb9f)

### Context Management
- [Cutting Through the Noise: Smarter Context Management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/)
- [How Agent Handoffs Work in Multi-Agent Systems](https://towardsdatascience.com/how-agent-handoffs-work-in-multi-agent-systems/)
- [Stateful Agents: The Missing Link in LLM Intelligence](https://www.letta.com/blog/stateful-agents)

### Performance & Benchmarks
- [Benchmarking Multi-Agent AI: Insights & Practical Use](https://galileo.ai/blog/benchmarks-multi-agent-ai)
- [Evaluating LLM-based Agents: Metrics, Benchmarks, Best Practices](https://samiranama.com/posts/Evaluating-LLM-based-Agents-Metrics,-Benchmarks,-and-Best-Practices/)
- [A Comprehensive Guide to Evaluating Multi-Agent LLM Systems](https://orq.ai/blog/multi-agent-llm-eval-system)
- [GitHub - THUDM/AgentBench](https://github.com/THUDM/AgentBench)

### AWS & Other Frameworks
- [Customize agent workflows with Strands Agents](https://aws.amazon.com/blogs/machine-learning/customize-agent-workflows-with-advanced-orchestration-techniques-using-strands-agents/)
- [Guidance for Multi-Agent Orchestration on AWS](https://aws.amazon.com/solutions/guidance/multi-agent-orchestration-on-aws/)
- [Introduction to Microsoft Agent Framework](https://learn.microsoft.com/en-us/agent-framework/overview/agent-framework-overview)

### Decision Criteria
- [Single-Agent vs Multi-Agent Systems](https://www.digitalocean.com/resources/articles/single-agent-vs-multi-agent)
- [When to Use Multi-Agent Systems](https://www.netguru.com/blog/multi-agent-systems-vs-solo-agents)
- [Don't Build Multi-Agents](https://cognition.ai/blog/dont-build-multi-agents)
- [Multi-agent LLMs in 2025](https://www.superannotate.com/blog/multi-agent-llms)

### Anthropic
- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)

---

**Document Version:** 1.0
**Last Updated:** January 4, 2026
**Total Sources:** 50+
**Word Count:** ~12,000
