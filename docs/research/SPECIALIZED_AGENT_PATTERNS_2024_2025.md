# Specialized Agent Types and Configurations for Multi-Agent Systems (2024-2025)

**Research Summary: Role-Based Agent Specialization, Tool Permissions, Model Selection, and Capability Boundaries**

---

## Table of Contents

1. [Role-Based Agent Specialization Patterns](#role-based-agent-specialization-patterns)
2. [Tool Permission Strategies](#tool-permission-strategies)
3. [Model Selection and Cost Optimization](#model-selection-and-cost-optimization)
4. [Agent Capability Boundaries and Sandboxing](#agent-capability-boundaries-and-sandboxing)
5. [Framework-Specific Implementations](#framework-specific-implementations)
6. [Memory Architecture and Context Sharing](#memory-architecture-and-context-sharing)
7. [Implementation Patterns and Best Practices](#implementation-patterns-and-best-practices)

---

## Role-Based Agent Specialization Patterns

### Core Agent Role Types

#### 1. Planner/Architect Agents (Read-Only, Strategic)

**Characteristics:**
- **Purpose**: High-level planning, task decomposition, strategy formulation
- **Tool Access**: Read-only operations, analysis tools
- **Model Selection**: Larger, more capable models (GPT-4, Claude Opus)
- **Permissions**: Cannot execute changes, limited to observation and planning

**Implementation Patterns:**

**Plan-and-Execute (P-t-E) Pattern:**
- Planner creates task list; executors carry out steps
- Planner can be a larger, slower model; executors can be smaller, faster models
- Enables cost optimization (expensive planning, cheap execution)
- Separation allows modular testing and debugging

**OpenCode Plan Agent:**
```yaml
# Restricted agent for planning and analysis
name: Plan Agent
tools:
  read: true
  write: false
  bash: false
  search: true
permissions: read-only
description: "Analysis and planning without making changes"
```

**Benefits:**
- Explicit long-term planning
- Smaller/weaker models for execution steps
- Clear separation of strategic vs tactical decisions
- Prevents costly model usage for simple execution tasks

**Sources:**
- [Plan-and-Execute Agents (LangChain)](https://blog.langchain.com/planning-agents/)
- [OpenCode Agents](https://opencode.ai/docs/agents/)
- [What is Agentic AI Planning Pattern? (Analytics Vidhya)](https://www.analyticsvidhya.com/blog/2024/11/agentic-ai-planning-pattern/)

---

#### 2. Executor/Worker Agents (Tool Execution)

**Characteristics:**
- **Purpose**: Execute specific tasks using specialized tools
- **Tool Access**: Scoped permissions based on task requirements
- **Model Selection**: Smaller, faster models (GPT-3.5, Claude Sonnet, Haiku)
- **Permissions**: Write access to specific domains only

**CrewAI Worker Pattern:**
```python
worker_agent = Agent(
    role="Worker",
    goal="Execute specific tasks using specialized tools",
    tools=[database_tool, api_tool],
    allow_delegation=False,  # Cannot delegate to others
    verbose=True
)
```

**Specialization Benefits:**
- Smaller, focused prompts for domain expertise
- Persistent intermediate context prevents forgetting
- Task-based decomposition for efficiency
- Can use domain-specific, cheaper models

**AutoGen Executor Types:**
- **CodeExecutorAgent**: Executes code in sandboxed environments
- **UserProxyAgent**: Relays user inputs and executes approved actions
- **AssistantAgent**: Task-oriented with specific expertise

**Sources:**
- [CrewAI Agents Documentation](https://docs.crewai.com/en/concepts/agents)
- [Understanding Different Types of Agents in AutoGen](https://medium.com/@shmilysyg/understanding-different-types-of-agents-in-autogen-41ddb987ed54)
- [Multi-Agent Conversation Framework (AutoGen)](https://microsoft.github.io/autogen/docs/Use-Cases/agent_chat/)

---

#### 3. Critic/Reviewer Agents (Quality Control)

**Characteristics:**
- **Purpose**: Review outputs, validate quality, identify errors
- **Tool Access**: Read access to outputs, analysis tools
- **Model Selection**: Medium-to-large models with strong reasoning
- **Permissions**: Can reject/approve but not modify directly

**Generator-Critic Pattern:**
```python
# Sequential workflow with quality gate
generator = Agent(
    role="Generator",
    goal="Create content",
    tools=[content_tools]
)

critic = Agent(
    role="Critic",
    goal="Review content for quality",
    tools=[validation_tools],
    output_schema={
        "status": "PASS|FAIL",
        "feedback": "string",
        "issues": ["list"]
    }
)

# Loop: Generator → Critic → (if FAIL) Generator with feedback
```

**Implementation Approaches:**

**Google ADK Quality Control:**
- SequentialAgent manages draft-and-review interaction
- Parent LoopAgent enforces quality gate and exit condition
- Critic outputs 'PASS' or detailed error descriptions
- Conditional looping until quality criteria met

**Multi-Agent Critique Aggregation:**
- Fuses evaluations from diverse agents
- Uses voting, averaging, debate mechanisms
- Enhances reasoning and reduces single-agent bias
- Applied in LLM alignment and reinforcement learning

**Software Engineering Example:**
- Report Agent generates bug reports
- False-Positive Pruner Agent refines reports
- Critic Agent reviews and ranks vulnerabilities
- Filters false positives and prioritizes critical issues

**Sources:**
- [Developer's Guide to Multi-Agent Patterns in ADK](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/)
- [Multi-Agent Critique Aggregation](https://www.emergentmind.com/topics/multi-agent-critique-aggregation)
- [LLM-Based Multi-Agent Systems for Software Engineering](https://dl.acm.org/doi/10.1145/3712003)

---

#### 4. Debug/Error Correction Agents

**Characteristics:**
- **Purpose**: Diagnose issues, suggest fixes, iterative refinement
- **Tool Access**: Read + limited write (for fixes), debugging tools
- **Model Selection**: Models with strong reasoning capabilities
- **Permissions**: Can modify code but requires approval for deployment

**Reflection and Error Correction Mechanisms:**

**ReAct Pattern:**
- Iterative Reasoning + Acting loop
- Agent reflects on past actions and observations
- Corrects and improves based on mistakes
- Key for complex real-world environments

**Reflexion Pattern:**
- Self-criticism and self-reflection over past actions
- Learns from mistakes and refines for future steps
- Improves quality of final results through iteration

**OpenCode Debug Agent:**
```yaml
name: Debug Agent
purpose: Investigation and debugging
tools:
  bash: true
  read: true
  write: false  # Read-only for investigation
  search: true
permissions: investigation-only
```

**Actor-Critic Approaches:**

**ACC-Collab Framework:**
- Actor-agent performs actions
- Critic-agent evaluates and provides feedback
- Specialized collaboration through learning
- Outperforms single-agent approaches

**LLaMAC Framework:**
- Centralized critic acts as coordinator
- Makes suggestions based on decision memory
- Actors interact with environment and execute
- Continuous feedback loop for improvement

**Sources:**
- [LLM Powered Autonomous Agents (Lil'Log)](https://lilianweng.github.io/posts/2023-06-23-agent/)
- [OpenCode Agents](https://opencode.ai/docs/agents/)
- [ACC-Collab: An Actor-Critic Approach to Multi-Agent LLM Collaboration](https://openreview.net/forum?id=nfKfAzkiez)

---

#### 5. Research/Information Gathering Agents

**Characteristics:**
- **Purpose**: Gather data, synthesize information, provide context
- **Tool Access**: Search, retrieval, analysis tools (read-heavy)
- **Model Selection**: Cost-effective models for search, larger for synthesis
- **Permissions**: External API access, web search, database queries

**Anthropic's Multi-Agent Research System:**

**Orchestrator-Worker Pattern:**
```python
# Lead agent coordinates parallel research
lead_agent = Agent(
    role="Research Coordinator",
    goal="Analyze query and develop research strategy",
    tools=[task_decomposition, strategy_planning]
)

# Specialized subagents for parallel search
subagents = [
    Agent(role="Web Search Specialist", tools=[web_search]),
    Agent(role="Academic Research", tools=[arxiv_search, paper_retrieval]),
    Agent(role="Data Analyst", tools=[database_query, data_processing])
]

# Workflow:
# 1. User query → Lead agent
# 2. Lead agent spawns subagents for different aspects
# 3. Subagents operate in parallel
# 4. Lead agent synthesizes results
```

**CrewAI Research Pipeline:**
```python
research_crew = Crew(
    agents=[
        Agent(role="Researcher", goal="Gather data"),
        Agent(role="Analyst", goal="Process findings"),
        Agent(role="Writer", goal="Create content"),
        Agent(role="Reviewer", goal="Quality check")
    ],
    process=Process.SEQUENTIAL  # research → analysis → writing → review
)
```

**Hierarchical Decomposition:**
- High-level agents break down complex research goals
- Delegate sub-tasks to specialist agents
- Parent waits for results to continue reasoning
- Manages context window limitations effectively

**AWS Security Assessment Example:**
```python
security_crew = Crew(
    agents=[
        Agent(
            role="Infrastructure Mapper",
            goal="Document AWS resources and configurations",
            backstory="Experienced cloud architect"
        ),
        Agent(
            role="Security Analyst",
            goal="Examine infrastructure for vulnerabilities",
            backstory="Cybersecurity expert"
        ),
        Agent(
            role="Report Writer",
            goal="Synthesize findings into recommendations",
            backstory="Technical documentation specialist"
        )
    ]
)
```

**Sources:**
- [How We Built Our Multi-Agent Research System (Anthropic)](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Build Agentic Systems with CrewAI and Amazon Bedrock](https://aws.amazon.com/blogs/machine-learning/build-agentic-systems-with-crewai-and-amazon-bedrock/)
- [Agentic Design Patterns Part 5: Multi-Agent Collaboration](https://www.deeplearning.ai/the-batch/agentic-design-patterns-part-5-multi-agent-collaboration/)

---

### Additional Specialized Roles

#### Manager/Coordinator Agents
- **Purpose**: Oversee task distribution, monitor progress
- **Pattern**: Hierarchical supervision of subordinate agents
- **Tools**: Task delegation, status monitoring, escalation handling
- **Models**: Medium-to-large models with strong reasoning

#### Review Agents (Code Review)
- **Purpose**: Code review with read-only access
- **Tools**: Documentation tools, static analysis
- **Permissions**: Read-only + documentation write access
- **Focus**: Maintain code quality without execution risks

#### Documentation Agents
- **Purpose**: Generate and maintain documentation
- **Tools**: File operations for docs, no system commands
- **Permissions**: Write access to documentation directories only
- **Model**: Medium models with good writing capabilities

**Sources:**
- [CrewAI Guide: Build Multi-Agent AI Teams](https://mem0.ai/blog/crewai-guide-multi-agent-ai-teams)
- [OpenCode Agents](https://opencode.ai/docs/agents/)

---

## Tool Permission Strategies

### Permission Architecture Patterns

#### 1. Allowlist-Based Permissions

**Warp Agent Permissions:**
```yaml
agent_profile:
  name: "Conservative Assistant"
  permissions:
    auto_execute_allowlist:
      - "ls"
      - "pwd"
      - "git status"
      - "cat"
      - "grep"
    require_approval:
      - "rm"
      - "git push"
      - "npm install"
    blocked:
      - "sudo"
      - "chmod +x"
```

**Best Practices:**
- Empty allowlist by default
- Users add read-only commands first
- Gradually expand based on trust and use case
- Separate allowlists per agent profile

**Sources:**
- [Agent Profiles & Permissions (Warp)](https://docs.warp.dev/agents/using-agents/agent-profiles-permissions)

---

#### 2. Permission Levels by Agent Type

**OpenCode Permission System:**

| Agent Type | Read | Write | Bash | Search | Network |
|------------|------|-------|------|---------|---------|
| Plan       | ✓    | ✗     | ✗    | ✓       | ✓       |
| Review     | ✓    | Docs  | ✗    | ✓       | ✓       |
| Debug      | ✓    | ✗     | ✓    | ✓       | ✓       |
| Executor   | ✓    | ✓     | ✓    | ✓       | Scoped  |
| Docs       | ✓    | Docs  | ✗    | ✓       | ✓       |

**Configuration Example:**
```yaml
agent:
  type: review
  tools:
    read: true
    write:
      scope: ["docs/**", "README.md"]
    bash: false
    search: true
    network:
      allowed_domains: ["docs.company.com", "api.company.com"]
```

---

#### 3. Dynamic Permission Management

**LangGraph User-Based Permissions:**

```python
# Store sub-agent permissions in database
def get_user_agent_permissions(user_id: str) -> List[str]:
    """Fetch which agents this user can access"""
    return db.query(
        "SELECT agent_name FROM user_agent_permissions WHERE user_id = ?",
        user_id
    )

# Initialize main agent with user-specific tools
def create_agent_for_user(user_id: str):
    available_agents = get_user_agent_permissions(user_id)

    tools = []
    if "flight_booking" in available_agents:
        tools.append(flight_booking_agent)
    if "marketing" in available_agents:
        tools.append(marketing_agent)

    return create_agent(tools=tools)
```

**Permission Check Strategies:**
1. **Invocation-time checks**: Verify permissions when agent is called
2. **Initialization filtering**: Only bind tools user has access to
3. **Hierarchical delegation**: Primary assistant filters agents by permissions

**Sources:**
- [LangGraph User Permissions Discussion](https://github.com/langchain-ai/langgraph/discussions/1034)

---

#### 4. Tool Permission Survey Data (2024)

**LangChain State of AI Agents Survey (1,300+ professionals):**

**Permission Distribution:**
- **Read-only tools**: Most common approach
- **Read + Write with approval**: Second most common
- **Read + Write + Delete freely**: Very rare (< 5%)

**Enterprise Patterns (2000+ employees):**
- Heavy emphasis on read-only permissions
- Pair guardrails with offline evaluations
- Catch regressions in pre-production
- Risk-averse approach to prevent data loss

**Smaller Companies:**
- More willing to grant write permissions
- Faster iteration cycles
- Accept higher risk for speed

**Sources:**
- [LangChain State of AI Agents Report](https://www.langchain.com/stateofaiagents)

---

#### 5. Model Context Protocol (MCP) Permissions

**Fine-Grained Authorization:**

```typescript
// MCP Permission Policy
interface MCPPermission {
  agent_id: string;
  tool_name: string;
  actions: {
    read?: ResourceScope[];
    write?: ResourceScope[];
    execute?: ExecutionScope;
  };
  conditions?: {
    require_approval?: boolean;
    rate_limit?: number;
    time_window?: string;
  };
}

// Example: Agent with scoped database access
const dbAgentPermission: MCPPermission = {
  agent_id: "data_analyst",
  tool_name: "database",
  actions: {
    read: ["public.*", "analytics.*"],
    write: ["analytics.temp_*"],  // Only temp tables
    execute: { queries: "SELECT_ONLY" }
  },
  conditions: {
    rate_limit: 100,
    time_window: "1m"
  }
};
```

**Key Principles:**
- Give agents exactly the access they need, nothing more
- Dynamic authorization based on context
- Secure AI agent tool use at granular level
- Prevent privilege escalation

**Sources:**
- [MCP Permissions: Securing AI Agent Access to Tools](https://www.cerbos.dev/blog/mcp-permissions-securing-ai-agent-access-to-tools)
- [What is MCP and Why Does It Matter?](https://www.lindy.ai/blog/what-is-mcp)

---

## Model Selection and Cost Optimization

### Cost-Capability Trade-Off Framework

**Three-Dimensional Analysis:**
1. **Cost**: Price per million tokens (input/output)
2. **Latency**: Response time for decision-making
3. **Intelligence**: Reasoning capability, accuracy

**Key Principle:** *"Which dimension matters most and which trade-offs are acceptable?"*

---

### Model Pricing Comparison (2024-2025)

| Model | Input ($/1M tokens) | Output ($/1M tokens) | Use Case |
|-------|---------------------|----------------------|----------|
| **GPT-4.1** | $5-10 | $15-30 | Complex reasoning, planning |
| **GPT-3.5 Turbo** | $0.50 | $1.50 | Simple tasks, high volume |
| **Claude Opus 4.5** | $15 | $75 | Advanced reasoning, coding |
| **Claude Sonnet 4.5** | $3 | $15 | Balanced cost/performance |
| **Claude Haiku** | $0.25 | $1.25 | Fast, lightweight tasks |
| **Gemini Flash** | $0.10 | $0.30 | Draft responses, high-throughput |

**Price Trends:**
- 50-98% reduction in AI model pricing (2024)
- Multi-model strategies increasingly viable
- 78% of enterprises use multi-model approaches

**Sources:**
- [Claude 4 vs GPT-4.1 vs Gemini Pricing & Performance](https://itecsonline.com/post/claude-4-vs-gpt-4-vs-gemini-pricing-features-performance)
- [Choosing LLMs for AI Agents: Claude, GPT-4, Gemini Compared](https://softcery.com/lab/ai-agent-llm-selection)

---

### Model Specialization by Capability

#### Best Use Cases by Model:

**Claude (Anthropic):**
- **Strengths**: Coding, tool use, agentic workflows, safety
- **Tool Use Performance**: 81.4% (retail), 59.6% (airline)
- **Best For**: Long-running agents, conservative behavior, technical tasks
- **Agent Roles**: Executor, Debug, Technical Research

**GPT Models (OpenAI):**
- **Strengths**: General versatility, analysis, reasoning
- **Tool Use Performance**: 68.0% (retail), 49.4% (airline)
- **Best For**: Multi-domain agents, customer support, content creation
- **Agent Roles**: Planner, Coordinator, General Assistant

**Gemini (Google):**
- **Strengths**: Multimodal tasks, real-time processing
- **Best For**: Research agents, image/video analysis, fast responses
- **Agent Roles**: Research, Multimodal Analysis, Real-time Tasks

**Llama (Meta):**
- **Strengths**: Open development, customization
- **Best For**: On-premise deployment, fine-tuned specialists
- **Agent Roles**: Domain-specific workers, privacy-sensitive tasks

**DeepSeek:**
- **Strengths**: Cost-effective deployment
- **Best For**: High-volume, budget-conscious workloads
- **Agent Roles**: Simple executors, data processing

**Sources:**
- [ChatGPT vs Claude: Which AI Model is Best for AI Agents?](https://datagrid.com/blog/chatgpt-vs-claude-ai-agent-architects)
- [Compare AI Models and Agents in 2025](https://www.jenova.ai/en/resources/compare-ai-models-and-agents-in-2025)

---

### Cost Optimization Strategies

#### 1. Complexity-Based Routing

**Pattern:**
```python
def route_to_model(query: str, complexity_threshold: float = 0.7):
    """Route queries to appropriate model based on complexity"""

    # Quick complexity assessment (use cheap model)
    complexity_score = assess_complexity(query)  # 0.0 - 1.0

    if complexity_score < complexity_threshold:
        # 70% of queries: GPT-3.5 (93% cost savings)
        return execute_with_model("gpt-3.5-turbo", query)
    else:
        # 30% of queries: GPT-4 (ensures accuracy)
        return execute_with_model("gpt-4", query)
```

**Results:**
- 60-80% cost savings while maintaining quality
- Simple queries handled by cheaper models
- Complex queries escalated to powerful models
- Overall system performance maintained

---

#### 2. Cascade Model Strategy

**Implementation:**
```python
class CascadeAgent:
    def __init__(self):
        self.models = [
            ("gpt-3.5-turbo", 0.85),  # (model, confidence_threshold)
            ("claude-sonnet", 0.90),
            ("gpt-4", 1.0)
        ]

    async def execute(self, task: str):
        for model, threshold in self.models:
            result = await execute_task(model, task)

            if result.confidence >= threshold:
                return result  # Success, stop cascade

            # Low confidence, try next model
            continue

        # Fallback to most expensive model
        return await execute_task("gpt-4", task)
```

**Benefits:**
- Cheaper models attempted first
- Escalation only when needed
- Similar or better success rates
- Significant cost reduction

---

#### 3. Multi-Agent Model Assignment

**Agent-Specific Model Configuration:**

```python
# CrewAI example with model routing
planner = Agent(
    role="Strategic Planner",
    llm=ChatOpenAI(model="gpt-4"),  # Expensive, smart
    goal="Create comprehensive project plan"
)

executors = [
    Agent(
        role="Data Collector",
        llm=ChatOpenAI(model="gpt-3.5-turbo"),  # Cheap, fast
        goal="Gather data from APIs"
    ),
    Agent(
        role="Report Generator",
        llm=ChatAnthropic(model="claude-haiku"),  # Cheap, fast
        goal="Format data into reports"
    )
]

reviewer = Agent(
    role="Quality Reviewer",
    llm=ChatAnthropic(model="claude-sonnet"),  # Medium cost/quality
    goal="Review outputs for quality"
)
```

**Cost Breakdown Example:**
- Planner: 5% of calls, 30% of cost (GPT-4)
- Executors: 85% of calls, 40% of cost (GPT-3.5/Haiku)
- Reviewer: 10% of calls, 30% of cost (Sonnet)
- **Total Savings**: ~60% vs. all-GPT-4

---

#### 4. Draft-Refine Pattern

**Two-Stage Approach:**

```python
async def draft_refine_workflow(user_request: str):
    # Stage 1: Fast, cheap draft (90%+ of cases)
    draft = await gemini_flash.generate(user_request)

    # Quality check
    quality_score = evaluate_response(draft)

    if quality_score.confidence > 0.85 and quality_score.complexity < 0.5:
        return draft  # Good enough, save cost

    # Stage 2: Refine with better model (only when needed)
    refinement_prompt = f"""
    Original request: {user_request}
    Draft response: {draft}
    Issues detected: {quality_score.issues}

    Please refine this response to address the issues.
    """

    return await claude_sonnet.generate(refinement_prompt)
```

**Results:**
- Cheap model handles 90%+ of cases adequately
- Expensive model only for complex/low-confidence cases
- Significant cost reduction with acceptable trade-offs

**Sources:**
- [Building a Cost-Effective Multi-Model System: GPT-4 + GPT-3.5](https://dev.to/jamesli/building-a-cost-effective-multi-model-system-gpt-4-gpt-35-implementation-guide-1pni)
- [How to Reduce 78%+ of LLM Cost](https://www.ai-jason.com/learning-ai/how-to-reduce-llm-cost)

---

#### 5. "Ask-the-Expert" Pattern

**Limited Escalation Approach:**

```python
class AskTheExpertAgent:
    def __init__(self, expert_calls_limit: int = 5):
        self.junior_model = "gpt-3.5-turbo"
        self.expert_model = "gpt-4"
        self.expert_calls_remaining = expert_calls_limit

    async def plan_task(self, task: str):
        # Junior planner attempts first
        plan = await self.create_plan(self.junior_model, task)

        # Check if stuck
        if self.is_stuck(plan) and self.expert_calls_remaining > 0:
            # Call expert for help
            expert_advice = await self.ask_expert(task, plan)
            self.expert_calls_remaining -= 1

            # Junior incorporates expert guidance
            plan = await self.revise_plan(plan, expert_advice)

        return plan

    def is_stuck(self, plan: dict) -> bool:
        """Detect when planner needs expert help"""
        return (
            plan.get("confidence", 1.0) < 0.5 or
            plan.get("errors", []) or
            plan.get("request_help", False)
        )
```

**Benefits:**
- Junior model handles most work
- Expert consulted only for critical decisions
- Defined "lifeline" budget prevents cost overruns
- 45.45% of tasks: equal or better performance vs. all-GPT-4

**Sources:**
- [$0.93 or $0.05? How to Get GPT-4 Results Without Going Broke](https://www.glassburyai.net/blog/093-or-005-how-to-get-gpt-4-results-without-going-broke-the-secret-life-of-budget-ai-agents)

---

#### 6. Modern Router-Based Systems (GPT-5 Pattern)

**Automatic Sub-Model Selection:**

```
User Prompt
     ↓
  [Router]
     ↓
  ┌──┴──┬──────┬───────┐
  ↓     ↓      ↓       ↓
Nano  Mini  Thinking  Main
(simple) (quick) (complex) (full)
```

**Router Decision Logic:**
- **Nano**: Trivial queries, classifications
- **Mini**: Standard questions, common patterns
- **Thinking**: Complex reasoning, multi-step problems
- **Main**: Novel problems, expert-level tasks

**Benefits:**
- Transparent to user (single model interface)
- Optimal cost/performance automatically
- Faster responses for simple queries
- Quality maintained for complex tasks

**Sources:**
- [GPT-5: Best Features, Pricing & Accessibility](https://research.aimultiple.com/gpt-5/)
- [Build Your Own GPT-5: Smart Model Routing with Langflow](https://www.langflow.org/blog/how-to-build-your-own-gpt-5)

---

### Cost Optimization Best Practices

1. **Implement model routing layer** - Don't use frontier models for trivial tasks
2. **Profile your workload** - Understand task complexity distribution
3. **Start conservative** - Begin with cheaper models, escalate when needed
4. **Monitor confidence scores** - Track when escalation is justified
5. **Use caching** - Reuse responses for similar queries
6. **Batch when possible** - Reduce per-request overhead
7. **Right-size context windows** - Don't send unnecessary context
8. **Evaluate regularly** - Measure cost vs. quality trade-offs

**Sources:**
- [Cost-Effective Agentic AI: Managing Compute and Data Costs](https://www.gocodeo.com/post/cost-effective-agentic-ai-managing-compute-and-data-costs)
- [How to Keep AI Agent Costs Predictable and Within Budget](https://datagrid.com/blog/8-strategies-cut-ai-agent-costs)

---

## Agent Capability Boundaries and Sandboxing

### Security Architecture Principles

#### 1. Agency vs. Autonomy

**Key Definitions:**

**Agency:**
- Scope of actions AI system is *permitted and enabled* to take
- Requires boundaries and permission systems
- Focuses on *what* the agent can do

**Autonomy:**
- Degree of independent decision-making *without human intervention*
- Requires oversight mechanisms and behavioral controls
- Focuses on *when* and *how* the agent decides

**Implementation:**
```yaml
agent_config:
  agency:
    # What actions are available
    permitted_tools: ["read", "search", "analyze"]
    forbidden_tools: ["delete", "deploy", "purchase"]
    resource_caps:
      max_api_calls: 100
      max_cost_per_task: 5.00

  autonomy:
    # How independently it operates
    approval_required:
      - tool: "write"
        threshold: "always"
      - tool: "api_call"
        threshold: "cost > 1.00"
    monitoring:
      log_all_actions: true
      alert_on_anomaly: true
```

**Sources:**
- [Agentic AI Security: Threats, Risks & Best Practices](https://www.rippling.com/blog/agentic-ai-security)
- [The Agentic AI Security Scoping Matrix](https://aws.amazon.com/blogs/security/the-agentic-ai-security-scoping-matrix-a-framework-for-securing-autonomous-ai-systems/)

---

#### 2. Guardrails and Capability Boundaries

**Policy Engine Pattern:**

```python
class AgentGuardrails:
    def __init__(self, policy: dict):
        self.policy = policy

    async def enforce(self, agent_action: Action) -> ActionResult:
        # Check if action is allowed
        if agent_action.tool in self.policy.get("blocked_tools", []):
            return ActionResult.DENIED("Tool is blocked by policy")

        # Check resource caps
        if self.would_exceed_budget(agent_action):
            return ActionResult.DENIED("Would exceed resource budget")

        # Require human approval for sensitive operations
        if self.requires_approval(agent_action):
            approval = await self.request_human_approval(agent_action)
            if not approval:
                return ActionResult.DENIED("Human approval not granted")

        # Execute with monitoring
        return await self.execute_with_monitoring(agent_action)

    def requires_approval(self, action: Action) -> bool:
        """Determine if action needs human approval"""
        sensitive_tools = self.policy.get("require_approval", [])
        return action.tool in sensitive_tools
```

**Defining Strict Boundaries:**
- Reduces risk of unintended autonomy
- Policy engines block disallowed behaviors
- Cap resource usage (API calls, costs, time)
- Require human approval for sensitive tasks

**Sources:**
- [Agentic AI Security: Threats, Risks & Best Practices](https://www.rippling.com/blog/agentic-ai-security)

---

### Sandboxing Architectures

#### 1. Sandboxing Fundamentals

**Purpose:**
- Isolated environments for testing and monitoring AI behavior
- Execute agent actions without exposing sensitive resources
- Evaluate capabilities in controlled setting

**What Sandboxing Controls:**
- **Where** code runs
- **Which** local files agent can access/modify
- **How** code executes (resource limits)

**What Sandboxing Does NOT Control:**
- **What** agent is authorized to do across systems
- **How confidently** agent interprets tasks
- **Which** external APIs agent can call

**Critical Insight:**
> "A sandbox controls where code runs. It doesn't control what the agent is allowed to do across systems — or how confidently it interprets the task."

**Sources:**
- [Why Docker Sandboxes Alone Don't Make AI Agents Safe](https://blog.arcade.dev/docker-sandboxes-arent-enough-for-agent-safety)
- [Understanding Agentic Systems and the Importance of Sandboxing](https://medium.com/@ssthil75/understanding-agentic-systems-and-the-importance-of-sandboxing-43ab9ed18a0e)

---

#### 2. UK AI Safety Institute Sandboxing Protocol

**Three-Axis Isolation:**

**1. Tooling Isolation:**
- Restricts model access to certain tools
- Controls code execution capabilities
- Limits which actions are available

**2. Host Isolation:**
- Prevents model from escaping sandbox
- Protects host system from compromise
- Enforces process-level boundaries

**3. Network Isolation:**
- Controls interaction with external systems
- Restricts internet access
- Prevents data exfiltration

**Implementation Example:**
```yaml
sandbox_config:
  tooling:
    allowed_executables: ["python3", "node"]
    forbidden_executables: ["bash", "sh", "curl", "wget"]
    max_execution_time: 30s
    max_memory: 512MB

  host:
    filesystem:
      allowed_read: ["/workspace/**"]
      allowed_write: ["/workspace/output/**"]
      forbidden: ["/etc", "/usr", "/home"]
    process:
      max_processes: 5
      no_privilege_escalation: true

  network:
    mode: "isolated"  # or "restricted", "open"
    allowed_domains: ["api.company.com"]
    blocked_ips: ["169.254.169.254"]  # Block metadata service
```

**Sources:**
- [The Inspect Sandboxing Toolkit](https://www.aisi.gov.uk/blog/the-inspect-sandboxing-toolkit-scalable-and-secure-ai-agent-evaluations)

---

#### 3. Multi-Agent Sandboxing

**Isolation Requirements:**
- Each agent operates in separate sandbox
- Prevents unintended interactions
- Maintains independent execution contexts

**Orchestrated Communication:**
```python
class MultiAgentSandbox:
    def __init__(self):
        self.agent_sandboxes = {}
        self.shared_context = SharedMemory()

    async def execute_agent(self, agent_id: str, task: dict):
        # Each agent gets isolated sandbox
        sandbox = self.agent_sandboxes.get(agent_id)
        if not sandbox:
            sandbox = self.create_isolated_sandbox(agent_id)
            self.agent_sandboxes[agent_id] = sandbox

        # Execute in isolation
        result = await sandbox.run(task)

        # Orchestrator manages communication
        await self.shared_context.publish(agent_id, result)

        return result

    def create_isolated_sandbox(self, agent_id: str):
        """Create isolated environment for agent"""
        return DockerSandbox(
            image="agent-runtime",
            network="none",  # No network access by default
            volumes={
                f"/data/{agent_id}": {"bind": "/workspace", "mode": "rw"}
            },
            mem_limit="512m",
            cpu_quota=50000  # 50% of one core
        )
```

**Frameworks Supporting Multi-Agent Sandboxing:**
- AutoGen: Isolated execution per agent
- CrewAI: Separate contexts for agents
- LangGraph: Controlled message passing

**Sources:**
- [Understanding Agentic Systems and the Importance of Sandboxing](https://medium.com/@ssthil75/understanding-agentic-systems-and-the-importance-of-sandboxing-43ab9ed18a0e)

---

#### 4. Layered Security Architecture (Defense in Depth)

**Multi-Level Controls:**

```
┌─────────────────────────────────────────┐
│ Application Layer                       │
│ - Input validation                      │
│ - Output filtering                      │
│ - Rate limiting                         │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ Agent Layer                             │
│ - Tool permissions                      │
│ - Action approval workflows             │
│ - Guardrails & policies                 │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ Data Layer                              │
│ - Access control (RBAC)                 │
│ - Encryption at rest/transit            │
│ - Audit logging                         │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│ Network Layer                           │
│ - VPC/VPC-SC isolation                  │
│ - Firewall rules                        │
│ - Network segmentation                  │
└─────────────────────────────────────────┘
```

**Principle:**
- Compromise at one level doesn't lead to complete system failure
- Multiple independent security controls
- Redundant protection mechanisms

**Sources:**
- [Safety and Security for AI Agents (Google ADK)](https://google.github.io/adk-docs/safety/)

---

#### 5. Limit-by-Default Principle

**Never Inherit Full Human Capabilities:**

```python
# ❌ BAD: Agent inherits all user permissions
agent = Agent(
    permissions=current_user.permissions  # Too broad!
)

# ✅ GOOD: Agent gets minimal necessary permissions
agent = Agent(
    permissions={
        "read": ["public/*", "project/data/*"],
        "write": ["project/outputs/*"],
        "execute": []  # No execution by default
    },
    require_approval_for=["write", "delete", "api_call"]
)
```

**Scope Restrictions:**
- **Read vs. Write**: Most agents only need read access
- **Directory scoping**: Limit to specific paths
- **Review vs. Merge**: Can review PRs but not merge
- **Time-based limits**: Permissions expire after duration

**Enterprise Best Practices:**
- Start with read-only permissions
- Add capabilities incrementally
- Require human approval for sensitive operations
- Regularly audit agent permissions

**Sources:**
- [Why Docker Sandboxes Alone Don't Make AI Agents Safe](https://blog.arcade.dev/docker-sandboxes-arent-enough-for-agent-safety)
- [Safety and Security for AI Agents (Google ADK)](https://google.github.io/adk-docs/safety/)

---

### Security Challenges in Multi-Agent Systems

#### 1. Rogue Agents

**Threat:**
- Compromised or malicious agents operating outside monitoring
- Adversaries exploit delegation and trust relationships
- One bad agent can compromise entire system

**Mitigation:**
```python
class AgentMonitor:
    async def validate_agent_action(self, agent_id: str, action: Action):
        # Behavioral anomaly detection
        if self.is_anomalous_behavior(agent_id, action):
            await self.quarantine_agent(agent_id)
            await self.alert_security_team(agent_id, action)
            return ActionResult.BLOCKED

        # Verify agent hasn't been tampered with
        if not self.verify_agent_integrity(agent_id):
            await self.quarantine_agent(agent_id)
            return ActionResult.BLOCKED

        return ActionResult.ALLOW

    def is_anomalous_behavior(self, agent_id: str, action: Action) -> bool:
        """Detect unusual patterns"""
        baseline = self.get_agent_baseline(agent_id)
        return (
            action.frequency > baseline.max_frequency * 2 or
            action.tool not in baseline.typical_tools or
            action.data_volume > baseline.max_data_volume
        )
```

---

#### 2. Inter-Agent Communication Security

**Attack Surface:**
- Agent-to-agent messages can be intercepted
- Compromised agent spreads malicious instructions
- Trust relationships exploited

**Secure Communication Pattern:**
```python
class SecureAgentCommunication:
    def __init__(self):
        self.encryption_key = self.load_encryption_key()
        self.trusted_agents = self.load_trusted_registry()

    async def send_message(self, from_agent: str, to_agent: str, message: dict):
        # Authentication: Verify sender identity
        if not self.verify_agent_identity(from_agent):
            raise SecurityError("Agent authentication failed")

        # Authorization: Check if communication allowed
        if not self.is_communication_allowed(from_agent, to_agent):
            raise SecurityError("Communication not authorized")

        # Encryption: Protect message content
        encrypted_msg = self.encrypt(message, self.encryption_key)

        # Message validation: Check for malicious content
        if self.contains_malicious_content(message):
            await self.alert_security(from_agent, message)
            raise SecurityError("Malicious content detected")

        # Send with signature
        signed_msg = self.sign_message(encrypted_msg, from_agent)
        await self.deliver(to_agent, signed_msg)

    async def receive_message(self, to_agent: str, signed_msg: bytes):
        # Verify signature
        from_agent, encrypted_msg = self.verify_signature(signed_msg)

        # Decrypt
        message = self.decrypt(encrypted_msg, self.encryption_key)

        # Validate message format and content
        if not self.validate_message(message):
            raise SecurityError("Invalid message format")

        return from_agent, message
```

**Security Mechanisms:**
- **Encryption**: Protect message confidentiality
- **Authentication**: Verify sender identity
- **Message validation**: Detect malicious payloads
- **Rate limiting**: Prevent message flooding

**Sources:**
- [Securing Agentic AI in a Multi-Agent World](https://www.straiker.ai/blog/securing-agentic-ai-in-a-multi-agent-world)

---

#### 3. Network Controls and Data Exfiltration Prevention

**VPC-SC (Virtual Private Cloud Service Controls):**
```yaml
network_policy:
  vpc_service_controls:
    perimeter:
      name: "agent-execution-perimeter"
      resources:
        - "projects/agent-runtime"
      restricted_services:
        - "storage.googleapis.com"
        - "bigquery.googleapis.com"
      ingress_policies:
        - allow_from: ["trusted-network"]
      egress_policies:
        - allow_to: ["api.company.com"]
        - deny_to: ["*"]  # Default deny

  firewall_rules:
    - name: "block-metadata-service"
      direction: "egress"
      action: "deny"
      destination: "169.254.169.254/32"

    - name: "allow-company-apis"
      direction: "egress"
      action: "allow"
      destination: "api.company.com"
```

**Best Practices:**
- Confine agent activity within secure perimeters
- Prevent unauthorized data exfiltration
- Limit potential impact radius
- Default-deny network policies

**Sources:**
- [Safety and Security for AI Agents (Google ADK)](https://google.github.io/adk-docs/safety/)

---

## Framework-Specific Implementations

### CrewAI

#### Agent Configuration

```python
from crewai import Agent, Task, Crew, Process

# Define specialized agents
planner = Agent(
    role="Strategic Planner",
    goal="Create comprehensive project plans",
    backstory="You are an experienced project manager with 10 years of experience.",
    verbose=True,
    allow_delegation=False,  # Cannot delegate to others
    llm=ChatOpenAI(model="gpt-4")
)

researcher = Agent(
    role="Senior Researcher",
    goal="Uncover cutting-edge developments in AI",
    backstory="You are a researcher at a leading AI think tank.",
    verbose=True,
    allow_delegation=True,  # Can delegate sub-tasks
    tools=[search_tool, scrape_tool],
    llm=ChatOpenAI(model="gpt-3.5-turbo")
)

writer = Agent(
    role="Content Writer",
    goal="Create engaging content based on research",
    backstory="You are a skilled content writer specializing in technical topics.",
    verbose=True,
    allow_delegation=False,
    llm=ChatAnthropic(model="claude-sonnet")
)

critic = Agent(
    role="Quality Reviewer",
    goal="Ensure content meets quality standards",
    backstory="You are a meticulous editor with high standards.",
    verbose=True,
    allow_delegation=False,
    llm=ChatOpenAI(model="gpt-4")
)

# Create tasks
plan_task = Task(
    description="Create a research plan for {topic}",
    agent=planner,
    expected_output="Detailed research plan with milestones"
)

research_task = Task(
    description="Research latest developments in {topic}",
    agent=researcher,
    expected_output="Comprehensive research report"
)

write_task = Task(
    description="Write article based on research",
    agent=writer,
    expected_output="Polished article draft"
)

review_task = Task(
    description="Review article for quality and accuracy",
    agent=critic,
    expected_output="Approved article or feedback for revision"
)

# Create crew with sequential process
crew = Crew(
    agents=[planner, researcher, writer, critic],
    tasks=[plan_task, research_task, write_task, review_task],
    process=Process.SEQUENTIAL,  # or Process.HIERARCHICAL
    verbose=True
)

# Execute
result = crew.kickoff(inputs={"topic": "Multi-agent AI systems"})
```

#### Hierarchical vs. Sequential Patterns

**Hierarchical CrewAI:**
- Manager agent supervises subordinate agents
- Delegates tasks based on specialization
- Subordinates report status and escalate issues
- Structured command chain

**Sequential CrewAI:**
- Agents operate in defined order
- Output of one becomes input to next
- No central manager
- Linear workflow

**Sources:**
- [CrewAI Agents Documentation](https://docs.crewai.com/en/concepts/agents)
- [Implementing CrewAI in Hierarchical Teams](https://sparkco.ai/blog/implementing-crewai-in-hierarchical-teams-a-2025-blueprint)

---

### AutoGen

#### Agent Types and Configuration

```python
from autogen import ConversableAgent, AssistantAgent, UserProxyAgent

# 1. ConversableAgent - Structured conversations
conversable = ConversableAgent(
    name="conversable_agent",
    system_message="You are a helpful assistant for structured conversations.",
    llm_config={"model": "gpt-3.5-turbo", "temperature": 0.5},
    human_input_mode="NEVER"  # or "ALWAYS", "TERMINATE"
)

# 2. AssistantAgent - Task-oriented with expertise
assistant = AssistantAgent(
    name="assistant",
    system_message="You are a coding assistant specializing in Python.",
    llm_config={
        "model": "gpt-4",
        "temperature": 0,
        "functions": [
            {
                "name": "execute_code",
                "description": "Execute Python code",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "code": {"type": "string"}
                    }
                }
            }
        ]
    }
)

# 3. UserProxyAgent - Human intermediary
user_proxy = UserProxyAgent(
    name="user_proxy",
    human_input_mode="TERMINATE",  # Ask for input on termination
    max_consecutive_auto_reply=10,
    code_execution_config={
        "work_dir": "workspace",
        "use_docker": True  # Sandboxed execution
    }
)

# Multi-agent conversation
user_proxy.initiate_chat(
    assistant,
    message="Write a Python function to calculate Fibonacci numbers."
)
```

#### Configuration Parameters

**Key Settings:**

1. **llm_config**: LLM inference configuration
   ```python
   llm_config = {
       "model": "gpt-4",
       "temperature": 0.7,
       "max_tokens": 1000,
       "functions": [...],  # Tool definitions
       "timeout": 60
   }
   ```

2. **human_input_mode**: Controls human involvement
   - `"NEVER"`: Fully autonomous
   - `"TERMINATE"`: Ask on completion
   - `"ALWAYS"`: Ask for every response

3. **system_message**: Agent instructions and role

4. **code_execution_config**: Sandboxed execution settings
   ```python
   code_execution_config = {
       "work_dir": "workspace",
       "use_docker": True,
       "timeout": 60,
       "last_n_messages": 3
   }
   ```

#### Workflow Patterns

**Sequential Workflow:**
```python
# Agent A → Agent B → Agent C
result_ab = agent_a.initiate_chat(agent_b, message=task)
result_bc = agent_b.initiate_chat(agent_c, message=result_ab)
```

**Parallel Workflow:**
```python
import asyncio

async def parallel_execution():
    tasks = [
        agent_a.a_initiate_chat(task_1),
        agent_b.a_initiate_chat(task_2),
        agent_c.a_initiate_chat(task_3)
    ]
    results = await asyncio.gather(*tasks)
    return results
```

**Group Chat (Finite State Machine):**
```python
from autogen import GroupChat, GroupChatManager

# Define allowed transitions
allowed_transitions = {
    agent_a: [agent_b, agent_c],
    agent_b: [agent_c],
    agent_c: [agent_a]
}

group_chat = GroupChat(
    agents=[agent_a, agent_b, agent_c],
    messages=[],
    max_round=10,
    allowed_or_disallowed_speaker_transitions=allowed_transitions,
    speaker_transitions_type="allowed"
)

manager = GroupChatManager(groupchat=group_chat, llm_config=llm_config)
```

**Sources:**
- [Multi-agent Conversation Framework (AutoGen)](https://microsoft.github.io/autogen/docs/Use-Cases/agent_chat/)
- [Understanding Different Types of Agents in AutoGen](https://medium.com/@shmilysyg/understanding-different-types-of-agents-in-autogen-41ddb987ed54)
- [Building Multi Agent Framework with AutoGen](https://www.analyticsvidhya.com/blog/2023/11/launching-into-autogen-exploring-the-basics-of-a-multi-agent-framework/)

---

### LangGraph

#### Agent Specialization Pattern

```python
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor, ToolInvocation
from langchain_core.agents import AgentAction
from langchain.chat_models import ChatOpenAI

# Define state
class AgentState(TypedDict):
    messages: List[BaseMessage]
    agent_outcome: Union[AgentAction, AgentFinish, None]
    intermediate_steps: List[tuple[AgentAction, str]]

# Create specialized agents
planner_llm = ChatOpenAI(model="gpt-4", temperature=0)
executor_llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)

# Define agent nodes
def planner_node(state: AgentState):
    """Strategic planning agent"""
    messages = state["messages"]
    response = planner_llm.invoke(messages)
    return {"agent_outcome": response, "messages": messages + [response]}

def executor_node(state: AgentState):
    """Task execution agent"""
    tool_executor = ToolExecutor(tools)
    action = state["agent_outcome"]
    response = tool_executor.invoke(ToolInvocation(
        tool=action.tool,
        tool_input=action.tool_input
    ))
    return {"intermediate_steps": [(action, response)]}

def critic_node(state: AgentState):
    """Quality review agent"""
    result = state["intermediate_steps"][-1][1]
    validation = validate_output(result)
    if validation["status"] == "PASS":
        return {"messages": [AIMessage(content=result)]}
    else:
        # Send back to executor with feedback
        return {
            "messages": [HumanMessage(content=f"Revise: {validation['feedback']}")]
        }

# Build graph
workflow = StateGraph(AgentState)

workflow.add_node("planner", planner_node)
workflow.add_node("executor", executor_node)
workflow.add_node("critic", critic_node)

workflow.set_entry_point("planner")
workflow.add_edge("planner", "executor")
workflow.add_edge("executor", "critic")

# Conditional edge: retry or finish
workflow.add_conditional_edges(
    "critic",
    lambda x: "executor" if needs_revision(x) else END
)

app = workflow.compile()
```

#### Hierarchical Multi-Agent Pattern

```python
# Supervisor coordinates specialized agents
from langgraph.prebuilt import create_supervisor

# Define specialist agents
research_agent = create_agent(
    llm=ChatOpenAI(model="gpt-3.5-turbo"),
    tools=[search_tool, scrape_tool],
    system_message="You are a research specialist."
)

coding_agent = create_agent(
    llm=ChatOpenAI(model="gpt-4"),
    tools=[python_repl, code_analyzer],
    system_message="You are a coding specialist."
)

# Create supervisor
supervisor_chain = create_supervisor(
    llm=ChatOpenAI(model="gpt-4"),
    members=["researcher", "coder"],
    system_prompt="""You are a supervisor managing a research and coding team.
    Delegate tasks to the appropriate specialist based on the request."""
)

# Supervisor decides which agent to invoke
class SupervisorState(TypedDict):
    messages: List[BaseMessage]
    next: str

def supervisor_node(state: SupervisorState):
    result = supervisor_chain.invoke(state["messages"])
    return {"next": result["next"]}

def research_node(state: SupervisorState):
    result = research_agent.invoke(state["messages"])
    return {"messages": [result]}

def coding_node(state: SupervisorState):
    result = coding_agent.invoke(state["messages"])
    return {"messages": [result]}

# Build hierarchical graph
workflow = StateGraph(SupervisorState)
workflow.add_node("supervisor", supervisor_node)
workflow.add_node("researcher", research_node)
workflow.add_node("coder", coding_node)

workflow.set_entry_point("supervisor")
workflow.add_conditional_edges(
    "supervisor",
    lambda x: x["next"],
    {"researcher": "researcher", "coder": "coder", "FINISH": END}
)
workflow.add_edge("researcher", "supervisor")
workflow.add_edge("coder", "supervisor")

app = workflow.compile()
```

#### User-Based Tool Permissions

```python
# Database-backed permission system
def create_agent_for_user(user_id: str, session_id: str):
    """Create agent with user-specific permissions"""

    # Fetch user's allowed agents from database
    allowed_agents = db.query("""
        SELECT agent_name FROM user_agent_permissions
        WHERE user_id = ?
    """, user_id)

    # Build tool list based on permissions
    tools = []

    if "flight_booking" in allowed_agents:
        tools.append(flight_booking_tool)

    if "database_access" in allowed_agents:
        # Scoped database tool with user's permissions
        tools.append(create_scoped_db_tool(user_id))

    if "file_access" in allowed_agents:
        # Scoped file tool limited to user's directories
        tools.append(create_scoped_file_tool(user_id))

    # Create agent with limited tools
    return create_agent(
        llm=ChatOpenAI(model="gpt-4"),
        tools=tools,
        system_message=f"Session: {session_id}, User: {user_id}"
    )

def create_scoped_db_tool(user_id: str):
    """Create database tool with user-specific permissions"""
    user_permissions = get_user_db_permissions(user_id)

    @tool
    def scoped_database_query(query: str) -> str:
        """Execute database query with user permissions"""
        # Validate query against user permissions
        if not is_query_allowed(query, user_permissions):
            return "Error: You don't have permission for this query"

        # Execute with user's credentials
        return execute_query(query, user_id)

    return scoped_database_query
```

**Sources:**
- [LangGraph Supervisor Pattern](https://github.com/langchain-ai/langgraph-supervisor-py)
- [Multi-Agent System Tutorial with LangGraph](https://blog.futuresmart.ai/multi-agent-system-with-langgraph)
- [LangGraph User Permissions Discussion](https://github.com/langchain-ai/langgraph/discussions/1034)

---

### Claude (Anthropic)

#### Agent Skills System (2025)

**Skill Structure:**
```markdown
<!-- /skills/web_research/SKILL.md -->

# Web Research Skill

## Description
Advanced web research and information gathering.

## Instructions
1. Use search tools to find relevant sources
2. Verify information from multiple sources
3. Synthesize findings into coherent summary
4. Cite sources with URLs

## Tools
- web_search
- web_scrape
- url_fetch

## Scripts
- /scripts/verify_sources.py
- /scripts/extract_citations.py

## References
- /references/research_guidelines.md
```

**Dynamic Skill Discovery:**
```python
# Claude discovers and loads skills as needed
class ClaudeAgent:
    def __init__(self):
        self.loaded_skills = {}
        self.skill_directory = ".claude/skills/"

    async def execute_task(self, task: str):
        # Determine which skills are needed
        required_skills = await self.identify_required_skills(task)

        # Load skills dynamically
        for skill_name in required_skills:
            if skill_name not in self.loaded_skills:
                skill = await self.load_skill(skill_name)
                self.loaded_skills[skill_name] = skill

        # Execute with skill context
        context = self.build_skill_context(self.loaded_skills)
        return await self.claude_api.execute(task, context=context)

    async def load_skill(self, skill_name: str):
        """Load skill from SKILL.md and associated files"""
        skill_path = f"{self.skill_directory}{skill_name}/SKILL.md"
        skill_def = await self.read_file(skill_path)

        return {
            "instructions": self.parse_instructions(skill_def),
            "tools": self.parse_tools(skill_def),
            "scripts": await self.load_scripts(skill_name),
            "references": await self.load_references(skill_name)
        }
```

**Key Insight:**
> "Skill = Prompt Template + Conversation Context Injection + Execution Context Modification + Optional data files and Python Scripts"

#### Advanced Tool Use

**Dynamic Tool Discovery:**
```python
# Tools loaded on-demand, not all upfront
class ToolRegistry:
    def __init__(self):
        self.available_tools = self.discover_tools()
        self.loaded_tools = {}

    def discover_tools(self) -> dict:
        """Catalog available tools without loading all definitions"""
        return {
            "database": {"category": "data", "cost": "medium"},
            "web_search": {"category": "research", "cost": "low"},
            "code_execution": {"category": "compute", "cost": "high"}
        }

    async def get_tool(self, tool_name: str) -> Tool:
        """Load tool definition only when needed"""
        if tool_name not in self.loaded_tools:
            tool_def = await self.load_tool_definition(tool_name)
            self.loaded_tools[tool_name] = tool_def

        return self.loaded_tools[tool_name]

# Agent only loads tools relevant to current task
agent = ClaudeAgent(tool_registry=ToolRegistry())
```

**Benefits:**
- Avoid stuffing all tool definitions into context upfront
- Save tokens (some agents use 50,000+ tokens for tool definitions)
- Discover and load tools on-demand
- Keep only what's relevant for current task

#### CLAUDE.md Custom Instructions

**Project-Specific Configuration:**
```markdown
<!-- .claude/CLAUDE.md -->

# Project Guidelines

## Role
You are a backend API developer working on a NestJS application.

## Coding Standards
- Use TypeScript strict mode
- Follow repository pattern
- Write unit tests for services
- Use dependency injection

## Workflows
- Before making changes, read relevant files
- Run tests after changes: `npm test`
- Check linting: `npm run lint`
- Update OpenAPI docs if API changes

## Tools Allowed
- read, write: Code files in /src
- bash: npm commands, git commands
- search: Codebase search only
```

**User-Level vs. Project-Level:**
- **User agents**: `~/.claude/agents/` (global)
- **Project agents**: `.claude/agents/` (project-specific)

**Sources:**
- [Introducing Agent Skills (Anthropic)](https://www.anthropic.com/news/skills)
- [Claude Agent Skills: A First Principles Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [Building Agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Claude Code Settings](https://docs.claude.com/en/docs/claude-code/settings)

---

## Memory Architecture and Context Sharing

### Memory Isolation Strategies

#### 1. Dual-Tier Memory Architecture

**Pattern:**
```python
class AgentMemory:
    def __init__(self, agent_id: str, session_id: str):
        self.agent_id = agent_id
        self.session_id = session_id

        # Private memory: Isolated to this agent
        self.private_memory = PrivateMemoryStore(agent_id)

        # Shared memory: Accessible to team members
        self.shared_memory = SharedMemoryStore(session_id)

    async def store(self, key: str, value: Any, scope: str = "private"):
        """Store information with specified scope"""
        if scope == "private":
            await self.private_memory.set(key, value)
        elif scope == "shared":
            await self.shared_memory.set(key, value, author=self.agent_id)

    async def recall(self, key: str, scope: str = "private"):
        """Retrieve information from specified scope"""
        if scope == "private":
            return await self.private_memory.get(key)
        elif scope == "shared":
            return await self.shared_memory.get(key)
```

**Use Cases:**

**Private Memory:**
- Sensitive user information
- Agent-specific state and context
- Working memory for tasks
- Credentials and secrets

**Shared Memory:**
- Team collaboration facts
- Project-wide knowledge
- Completed task results
- Shared learnings

**Sources:**
- [Collaborative Memory: Multi-User Memory Sharing in LLM Agents](https://arxiv.org/html/2505.18279v1)

---

#### 2. Session Boundaries and Isolation

**Implementation:**
```python
class SessionMemoryManager:
    def __init__(self):
        self.sessions = {}

    def create_session(
        self,
        session_id: str,
        domain: str,
        participants: List[str]
    ):
        """Create isolated memory space for session"""
        self.sessions[session_id] = {
            "domain": domain,
            "participants": participants,
            "memory": MemoryStore(),
            "access_control": self.create_access_policy(participants)
        }

    async def store_in_session(
        self,
        session_id: str,
        agent_id: str,
        key: str,
        value: Any
    ):
        """Store memory scoped to session"""
        session = self.sessions[session_id]

        # Verify agent is participant
        if agent_id not in session["participants"]:
            raise PermissionError(f"Agent {agent_id} not in session")

        # Store with metadata
        await session["memory"].set(key, {
            "value": value,
            "author": agent_id,
            "timestamp": datetime.now(),
            "session_id": session_id
        })
```

**Session Types:**

1. **Project Sessions**: Shared by all agents working on a project
2. **User Sessions**: Private to user and their agents
3. **Task Sessions**: Temporary, cleaned up after task completion
4. **Domain Sessions**: Specialized knowledge for specific domains

**Benefits:**
- Prevents information leakage between unrelated workstreams
- Enables rich context within specific boundaries
- Clear ownership and access control
- Easy cleanup and archival

**Sources:**
- [Why Multi-Agent Systems Need Memory Engineering (MongoDB)](https://www.mongodb.com/company/blog/technical/why-multi-agent-systems-need-memory-engineering)

---

#### 3. Working Memory and Context Windows

**Context Window as Working Memory:**
```python
class AgentWorkingMemory:
    def __init__(self, context_window_size: int = 8000):
        self.context_window = []
        self.max_tokens = context_window_size
        self.current_tokens = 0

    def add_to_working_memory(self, item: str):
        """Add to working memory, evicting if needed"""
        item_tokens = count_tokens(item)

        # Evict oldest items if over budget
        while self.current_tokens + item_tokens > self.max_tokens:
            evicted = self.context_window.pop(0)
            self.current_tokens -= count_tokens(evicted)

            # Archive evicted items to long-term memory
            await self.archive_to_long_term(evicted)

        self.context_window.append(item)
        self.current_tokens += item_tokens

    def get_working_memory(self) -> str:
        """Get current working memory for LLM context"""
        return "\n".join(self.context_window)
```

**Key Concept:**
> "What your agent 'remembers' is fundamentally determined by what exists in its context window at any given moment. Think of the context window as the agent's working memory."

**Sources:**
- [Agent Memory: How to Build Agents that Learn and Remember (Letta)](https://www.letta.com/blog/agent-memory)

---

### Shared Memory Topologies

#### 1. Local Memory with Message Passing (AutoGen, Chain-of-Agents)

**Architecture:**
```python
class LocalMemoryAgent:
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.local_memory = {}  # Isolated memory
        self.message_queue = MessageQueue()

    async def process_task(self, task: dict):
        # Use local memory
        context = self.local_memory.get("context", {})

        # Execute task
        result = await self.execute(task, context)

        # Update local memory
        self.local_memory["last_result"] = result

        # Share via message passing
        await self.send_message({
            "from": self.agent_id,
            "result": result,
            "timestamp": datetime.now()
        })

        return result

    async def receive_message(self, message: dict):
        """Receive updates from other agents"""
        # Integrate into local memory if relevant
        if self.is_relevant(message):
            self.local_memory[f"shared_{message['from']}"] = message
```

**Trade-offs:**

**Pros:**
- No interference between agents
- Clear ownership of data
- Easier to debug and reason about

**Cons:**
- Redundancy (same fact stored by multiple agents)
- Inconsistency risk if agents don't share updates
- More communication overhead

---

#### 2. Shared Memory Pool (Memory Sharing Framework)

**Architecture:**
```python
class SharedMemoryPool:
    def __init__(self):
        self.global_memory = {}
        self.access_log = []
        self.lock = asyncio.Lock()

    async def read(self, agent_id: str, key: str):
        """Read from shared memory"""
        async with self.lock:
            value = self.global_memory.get(key)
            self.access_log.append({
                "agent": agent_id,
                "action": "read",
                "key": key,
                "timestamp": datetime.now()
            })
            return value

    async def write(self, agent_id: str, key: str, value: Any):
        """Write to shared memory"""
        async with self.lock:
            # Conflict detection
            if key in self.global_memory:
                await self.handle_conflict(agent_id, key, value)

            self.global_memory[key] = {
                "value": value,
                "author": agent_id,
                "version": self.get_version(key) + 1,
                "timestamp": datetime.now()
            }

            self.access_log.append({
                "agent": agent_id,
                "action": "write",
                "key": key,
                "timestamp": datetime.now()
            })
```

**Trade-offs:**

**Pros:**
- "Team mind" - knowledge immediately global
- No redundancy
- Tight coordination enabled
- Consistent state

**Cons:**
- Noisy commons - irrelevant details accumulate
- Concurrency challenges
- Harder to isolate agent failures
- Requires conflict resolution

**Sources:**
- [Memory in LLM-based Multi-agent Systems: Mechanisms, Challenges, and Collective Intelligence](https://www.techrxiv.org/users/1007269/articles/1367390/master/file/data/LLM_MAS_Memory_Survey_preprint_/LLM_MAS_Memory_Survey_preprint_.pdf?inline=true)

---

### Concurrency and Synchronization

#### Atomic Operations

```python
class AtomicMemoryOperations:
    def __init__(self):
        self.memory = {}
        self.locks = {}

    async def atomic_update(self, key: str, update_fn: Callable):
        """Ensure update happens entirely or not at all"""
        async with self.get_lock(key):
            # Read current value
            current = self.memory.get(key)

            try:
                # Apply update function
                new_value = update_fn(current)

                # Write new value
                self.memory[key] = new_value

                return new_value
            except Exception as e:
                # Rollback on error
                logger.error(f"Atomic update failed: {e}")
                raise

    async def compare_and_swap(
        self,
        key: str,
        expected: Any,
        new_value: Any
    ) -> bool:
        """Update only if current value matches expected"""
        async with self.get_lock(key):
            current = self.memory.get(key)

            if current == expected:
                self.memory[key] = new_value
                return True
            else:
                return False
```

**Critical Requirements:**
- Prevent partial updates
- Handle concurrent access
- Maintain consistency
- Rollback on failure

**Sources:**
- [Why Multi-Agent Systems Need Memory Engineering (MongoDB)](https://medium.com/mongodb/why-multi-agent-systems-need-memory-engineering-153a81f8d5be)

---

### Model Context Protocol (MCP) for Memory

**Purpose:**
- Give AI agents ability to share memory
- Retain task context across tools
- Collaborate without custom integrations

**Implementation:**
```python
# MCP-compatible memory server
class MCPMemoryServer:
    def __init__(self):
        self.memory_stores = {}
        self.context_graph = ContextGraph()

    async def store_context(
        self,
        agent_id: str,
        context_type: str,
        data: dict
    ):
        """Store context for cross-tool access"""
        context_id = self.generate_context_id()

        await self.memory_stores.setdefault(agent_id, {}).update({
            context_id: {
                "type": context_type,
                "data": data,
                "timestamp": datetime.now(),
                "access_count": 0
            }
        })

        # Build context graph for discovery
        self.context_graph.add_node(context_id, data)

        return context_id

    async def get_relevant_context(
        self,
        agent_id: str,
        query: str
    ) -> List[dict]:
        """Retrieve relevant context for current task"""
        agent_memory = self.memory_stores.get(agent_id, {})

        # Semantic search in context graph
        relevant_ids = self.context_graph.search(query, limit=5)

        return [
            agent_memory[cid]
            for cid in relevant_ids
            if cid in agent_memory
        ]
```

**Sources:**
- [What is MCP and Why Does It Matter?](https://www.lindy.ai/blog/what-is-mcp)

---

## Implementation Patterns and Best Practices

### Agent Prompt Engineering

#### Role-Based System Prompts

**Planner Agent:**
```
You are a Strategic Planner agent with expertise in project management.

ROLE: Analyze requirements and create detailed execution plans.

CAPABILITIES:
- Read and analyze documents
- Search for relevant information
- Create task breakdowns and timelines

CONSTRAINTS:
- You CANNOT execute tasks yourself
- You CANNOT write or modify files
- You MUST delegate execution to worker agents

OUTPUT FORMAT:
Provide plans as structured JSON:
{
  "objective": "...",
  "tasks": [
    {"id": 1, "description": "...", "assigned_to": "worker_type", "dependencies": []},
    ...
  ],
  "timeline": "...",
  "risks": [...]
}

INSTRUCTIONS:
1. Analyze the full requirements thoroughly
2. Break down into actionable tasks
3. Identify dependencies and ordering
4. Estimate effort and timeline
5. Flag potential risks
6. DO NOT proceed to execution - return plan for approval
```

**Executor Agent:**
```
You are a Worker agent specialized in task execution.

ROLE: Execute specific tasks assigned by the planner.

CAPABILITIES:
- Write and modify files
- Execute code and commands
- Call external APIs
- Process data

CONSTRAINTS:
- Execute ONLY the assigned task
- Stay within your permission boundaries
- Request approval for sensitive operations
- Report progress and blockers

WORKFLOW:
1. Acknowledge the task assignment
2. Execute step-by-step
3. Report progress after each significant step
4. Handle errors gracefully
5. Return structured results

ERROR HANDLING:
If you encounter an error:
- DO NOT proceed further
- Report the error clearly
- Suggest potential solutions
- Wait for guidance
```

**Critic Agent:**
```
You are a Quality Reviewer agent.

ROLE: Review outputs for correctness, quality, and compliance.

EVALUATION CRITERIA:
1. Correctness: Does it meet the requirements?
2. Quality: Is it well-structured and maintainable?
3. Security: Are there any security concerns?
4. Performance: Are there obvious inefficiencies?

OUTPUT FORMAT:
{
  "status": "PASS" | "FAIL",
  "score": 0-100,
  "findings": [
    {"type": "error|warning|suggestion", "description": "...", "location": "..."},
    ...
  ],
  "feedback": "Detailed feedback for improvement"
}

INSTRUCTIONS:
- Be thorough but constructive
- Identify specific issues with locations
- Suggest concrete improvements
- If FAIL, provide actionable feedback
- If PASS, note any optional improvements
```

**Sources:**
- [The Ultimate Guide to Prompt Engineering in 2025](https://www.lakera.ai/blog/prompt-engineering-guide)

---

### Multi-Agent Communication Patterns

#### 1. Sequential Chain

```python
async def sequential_chain(initial_task: str):
    """Linear workflow: A → B → C"""

    # Step 1: Planning
    plan = await planner_agent.execute(initial_task)

    # Step 2: Research
    research = await research_agent.execute(plan)

    # Step 3: Execution
    result = await executor_agent.execute(research)

    # Step 4: Review
    review = await critic_agent.execute(result)

    if review["status"] == "FAIL":
        # Retry with feedback
        result = await executor_agent.execute({
            "task": research,
            "feedback": review["feedback"]
        })

    return result
```

---

#### 2. Parallel Execution with Aggregation

```python
async def parallel_aggregation(task: str):
    """Multiple agents work in parallel, results aggregated"""

    # Coordinator decomposes task
    subtasks = await coordinator.decompose(task)

    # Execute in parallel
    results = await asyncio.gather(*[
        agent_a.execute(subtasks[0]),
        agent_b.execute(subtasks[1]),
        agent_c.execute(subtasks[2])
    ])

    # Aggregator combines results
    final = await aggregator.synthesize(results)

    return final
```

---

#### 3. Hierarchical Delegation

```python
async def hierarchical_delegation(complex_task: str):
    """Manager delegates to specialists"""

    # Manager analyzes and assigns
    assignment = await manager.analyze_and_assign(complex_task)

    # Route to specialist
    if assignment["type"] == "research":
        result = await research_specialist.execute(assignment["task"])
    elif assignment["type"] == "coding":
        result = await coding_specialist.execute(assignment["task"])
    elif assignment["type"] == "analysis":
        result = await analysis_specialist.execute(assignment["task"])

    # Manager reviews result
    review = await manager.review(result)

    if review["needs_escalation"]:
        # Escalate to higher capability model
        result = await expert_agent.execute({
            "original_task": assignment["task"],
            "attempt": result,
            "issue": review["issue"]
        })

    return result
```

---

#### 4. Iterative Refinement (ReAct/Reflexion)

```python
async def iterative_refinement(task: str, max_iterations: int = 3):
    """Agent iteratively improves through reflection"""

    result = None
    history = []

    for iteration in range(max_iterations):
        # Execute
        result = await executor.execute({
            "task": task,
            "history": history
        })

        # Reflect
        reflection = await reflector.analyze({
            "task": task,
            "attempt": result,
            "iteration": iteration
        })

        history.append({
            "iteration": iteration,
            "result": result,
            "reflection": reflection
        })

        # Check if satisfactory
        if reflection["quality_score"] >= 0.9:
            break

        # Continue with learnings
        task = {
            "original": task,
            "learnings": reflection["improvements"]
        }

    return result
```

---

### Testing and Evaluation

#### Multi-Agent System Testing

```python
class MultiAgentTester:
    async def test_agent_collaboration(self):
        """Test that agents collaborate correctly"""

        # Setup test scenario
        task = "Research AI trends and write a report"

        # Execute workflow
        result = await self.run_multi_agent_workflow(task)

        # Validate
        assert result["status"] == "completed"
        assert "research_findings" in result
        assert "report" in result
        assert result["quality_score"] > 0.8

    async def test_permission_enforcement(self):
        """Test that permission boundaries are enforced"""

        # Attempt unauthorized action
        with pytest.raises(PermissionError):
            await read_only_agent.execute({
                "action": "write",
                "file": "test.txt",
                "content": "unauthorized"
            })

    async def test_error_recovery(self):
        """Test that errors are handled gracefully"""

        # Inject error
        with mock.patch("executor.api_call", side_effect=Exception("API Error")):
            result = await resilient_agent.execute("task")

        # Verify recovery
        assert result["status"] == "recovered"
        assert result["fallback_used"] == True

    async def test_cost_optimization(self):
        """Test that cost optimization strategies work"""

        # Track costs
        cost_tracker = CostTracker()

        # Execute with routing
        result = await cost_optimized_workflow.execute(
            tasks=test_tasks,
            tracker=cost_tracker
        )

        # Verify savings
        baseline_cost = self.calculate_all_gpt4_cost(test_tasks)
        actual_cost = cost_tracker.total_cost

        assert actual_cost < baseline_cost * 0.5  # At least 50% savings
```

---

### Monitoring and Observability

```python
class AgentObservability:
    def __init__(self):
        self.tracer = OpenTelemetryTracer()
        self.metrics = PrometheusMetrics()

    @trace_agent_execution
    async def execute_with_monitoring(self, agent_id: str, task: dict):
        """Execute agent task with full observability"""

        span = self.tracer.start_span(f"agent_{agent_id}_execution")

        try:
            # Record start
            self.metrics.agent_execution_started.inc({
                "agent_id": agent_id,
                "task_type": task["type"]
            })

            start_time = time.time()

            # Execute
            result = await agent.execute(task)

            # Record metrics
            duration = time.time() - start_time
            self.metrics.agent_execution_duration.observe(duration, {
                "agent_id": agent_id
            })

            # Log result
            span.set_attribute("status", "success")
            span.set_attribute("output_size", len(str(result)))

            return result

        except Exception as e:
            # Record failure
            self.metrics.agent_execution_failed.inc({
                "agent_id": agent_id,
                "error_type": type(e).__name__
            })

            span.set_attribute("status", "error")
            span.set_attribute("error", str(e))

            raise
        finally:
            span.end()
```

---

## Key Takeaways

### 1. Role Specialization is Critical
- Architect/Planner: Read-only, high-capability models
- Executor/Worker: Scoped write access, cost-effective models
- Critic/Reviewer: Quality gates with medium models
- Debug: Reflection-based error correction
- Research: Parallel information gathering

### 2. Tool Permissions Must Be Explicit
- Default to read-only
- Allowlist-based permissions
- User-scoped dynamic permissions
- Require approval for sensitive operations
- Enterprise: Heavily favor read-only + offline evaluation

### 3. Model Selection Drives Economics
- 60-80% cost savings with smart routing
- Complexity-based routing: 70% cheap, 30% expensive
- Cascade pattern: Try cheap first, escalate if needed
- Multi-agent: Assign models by role requirements
- Draft-refine: Fast draft + smart refinement

### 4. Sandboxing Alone Isn't Enough
- Sandbox controls *where*, not *what*
- Need permission systems for cross-system authorization
- Three-axis isolation: Tooling, Host, Network
- Defense in depth: Multiple security layers
- Limit-by-default: Never inherit full human capabilities

### 5. Memory Architecture Matters
- Private vs. shared memory trade-offs
- Session boundaries prevent leakage
- Atomic operations for shared memory
- Working memory = context window
- MCP enables cross-tool memory sharing

### 6. Framework Choice Depends on Use Case
- **CrewAI**: Best for business workflows, hierarchical teams
- **AutoGen**: Best for research, code generation, flexible conversations
- **LangGraph**: Best for complex state machines, custom control flow
- **Claude**: Best for coding agents, dynamic skill loading

---

## Sources

### CrewAI
- [Agents - CrewAI](https://docs.crewai.com/en/concepts/agents)
- [CrewAI Guide: Build Multi-Agent AI Teams](https://mem0.ai/blog/crewai-guide-multi-agent-ai-teams)
- [CrewAI Framework 2025: Complete Review](https://latenode.com/blog/ai-frameworks-technical-infrastructure/crewai-framework/crewai-framework-2025-complete-review-of-the-open-source-multi-agent-ai-platform)
- [Implementing CrewAI in Hierarchical Teams](https://sparkco.ai/blog/implementing-crewai-in-hierarchical-teams-a-2025-blueprint)
- [Build Agentic Systems with CrewAI and Amazon Bedrock](https://aws.amazon.com/blogs/machine-learning/build-agentic-systems-with-crewai-and-amazon-bedrock/)

### AutoGen
- [Multi-agent Conversation Framework (AutoGen)](https://microsoft.github.io/autogen/docs/Use-Cases/agent_chat/)
- [Understanding Different Types of Agents in AutoGen](https://medium.com/@shmilysyg/understanding-different-types-of-agents-in-autogen-41ddb987ed54)
- [Agent and Multi-Agent Applications (AutoGen)](https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/core-concepts/agent-and-multi-agent-application.html)
- [Building Multi Agent Framework with AutoGen](https://www.analyticsvidhya.com/blog/2023/11/launching-into-autogen-exploring-the-basics-of-a-multi-agent-framework/)

### LangGraph
- [LangGraph User Permissions Discussion](https://github.com/langchain-ai/langgraph/discussions/1034)
- [LangGraph Supervisor Pattern](https://github.com/langchain-ai/langgraph-supervisor-py)
- [LangChain State of AI Agents Report](https://www.langchain.com/stateofaiagents)
- [Multi-Agent System Tutorial with LangGraph](https://blog.futuresmart.ai/multi-agent-system-with-langgraph)

### Agent Patterns
- [20 Agentic AI Workflow Patterns That Actually Work in 2025](https://skywork.ai/blog/agentic-ai-examples-workflow-patterns-2025/)
- [Developer's Guide to Multi-Agent Patterns in ADK](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/)
- [Agentic Design Patterns Part 5: Multi-Agent Collaboration](https://www.deeplearning.ai/the-batch/agentic-design-patterns-part-5-multi-agent-collaboration/)
- [Plan-and-Execute Agents (LangChain)](https://blog.langchain.com/planning-agents/)
- [What is Agentic AI Planning Pattern?](https://www.analyticsvidhya.com/blog/2024/11/agentic-ai-planning-pattern/)

### Model Selection & Cost
- [Choosing LLMs for AI Agents: Claude, GPT-4, Gemini Compared](https://softcery.com/lab/ai-agent-llm-selection)
- [Claude 4 vs GPT-4.1 vs Gemini Pricing & Performance](https://itecsonline.com/post/claude-4-vs-gpt-4-vs-gemini-pricing-features-performance)
- [ChatGPT vs Claude: Which AI Model is Best for AI Agents?](https://datagrid.com/blog/chatgpt-vs-claude-ai-agent-architects)
- [Building a Cost-Effective Multi-Model System](https://dev.to/jamesli/building-a-cost-effective-multi-model-system-gpt-4-gpt-35-implementation-guide-1pni)
- [How to Reduce 78%+ of LLM Cost](https://www.ai-jason.com/learning-ai/how-to-reduce-llm-cost)
- [How to Get GPT-4 Results Without Going Broke](https://www.glassburyai.net/blog/093-or-005-how-to-get-gpt-4-results-without-going-broke-the-secret-life-of-budget-ai-agents)
- [Build Your Own GPT-5: Smart Model Routing](https://www.langflow.org/blog/how-to-build-your-own-gpt-5)

### Security & Sandboxing
- [Agentic AI Security: Threats, Risks & Best Practices](https://www.rippling.com/blog/agentic-ai-security)
- [The Agentic AI Security Scoping Matrix](https://aws.amazon.com/blogs/security/the-agentic-ai-security-scoping-matrix-a-framework-for-securing-autonomous-ai-systems/)
- [Safety and Security for AI Agents (Google ADK)](https://google.github.io/adk-docs/safety/)
- [Why Docker Sandboxes Alone Don't Make AI Agents Safe](https://blog.arcade.dev/docker-sandboxes-arent-enough-for-agent-safety)
- [The Inspect Sandboxing Toolkit](https://www.aisi.gov.uk/blog/the-inspect-sandboxing-toolkit-scalable-and-secure-ai-agent-evaluations)
- [Understanding Agentic Systems and the Importance of Sandboxing](https://medium.com/@ssthil75/understanding-agentic-systems-and-the-importance-of-sandboxing-43ab9ed18a0e)
- [Securing Agentic AI in a Multi-Agent World](https://www.straiker.ai/blog/securing-agentic-ai-in-a-multi-agent-world)

### Permissions
- [Agent Profiles & Permissions (Warp)](https://docs.warp.dev/agents/using-agents/agent-profiles-permissions)
- [OpenCode Agents](https://opencode.ai/docs/agents/)
- [MCP Permissions: Securing AI Agent Access to Tools](https://www.cerbos.dev/blog/mcp-permissions-securing-ai-agent-access-to-tools)

### Claude/Anthropic
- [Introducing Agent Skills (Anthropic)](https://www.anthropic.com/news/skills)
- [How We Built Our Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Claude Agent Skills: A First Principles Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [Building Agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Introducing Advanced Tool Use on Claude](https://www.anthropic.com/engineering/advanced-tool-use)
- [Claude Code Settings](https://docs.claude.com/en/docs/claude-code/settings)

### Memory & Context
- [Collaborative Memory: Multi-User Memory Sharing in LLM Agents](https://arxiv.org/html/2505.18279v1)
- [Memory in LLM-based Multi-agent Systems](https://www.techrxiv.org/users/1007269/articles/1367390/master/file/data/LLM_MAS_Memory_Survey_preprint_/LLM_MAS_Memory_Survey_preprint_.pdf?inline=true)
- [Why Multi-Agent Systems Need Memory Engineering (MongoDB)](https://www.mongodb.com/company/blog/technical/why-multi-agent-systems-need-memory-engineering)
- [Agent Memory: How to Build Agents that Learn and Remember](https://www.letta.com/blog/agent-memory)
- [What is MCP and Why Does It Matter?](https://www.lindy.ai/blog/what-is-mcp)

### Critic & Quality Control
- [Multi-Agent Critique Aggregation](https://www.emergentmind.com/topics/multi-agent-critique-aggregation)
- [LLM-Based Multi-Agent Systems for Software Engineering](https://dl.acm.org/doi/10.1145/3712003)
- [LLM Powered Autonomous Agents (Lil'Log)](https://lilianweng.github.io/posts/2023-06-23-agent/)
- [ACC-Collab: An Actor-Critic Approach to Multi-Agent LLM Collaboration](https://openreview.net/forum?id=nfKfAzkiez)

### Prompt Engineering
- [The Ultimate Guide to Prompt Engineering in 2025](https://www.lakera.ai/blog/prompt-engineering-guide)
- [The State of Prompt Engineering in September 2025](https://promptbestie.com/en/prompt-engineering-2025-evolution-automation-security-enterprise-guide/)
