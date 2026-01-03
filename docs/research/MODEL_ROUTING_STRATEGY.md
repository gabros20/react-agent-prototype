<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# In current agentic apps, what is the most common usage amongst picking the right agent capable AI model right now 25 what most agent and agent pick ups uses I know that small models don't cut it when it comes to complex multitask executions so what engineers prefer to use primary primarily and as four books in their systems

Most production agentic apps in 2025 use a *two‑tier* model strategy: a fast, mid‑size “workhorse” model for most steps, and a larger reasoning model for hard planning, coding, or multi‑step tool orchestration.[^1_1][^1_2][^1_3]

## What engineers use as primary models

For the *main* agent brain (routing, light reasoning, typical tool use), teams typically standardize on:

- **OpenAI o3‑mini / o4‑mini, GPT‑4.1‑mini‑class models** as the default for agent loops because they balance cost, latency, and reasoning well enough for the majority of steps.[^1_4][^1_1]
- **Claude, Gemini, or GPT‑4.1 full models** reserved for fewer “heavy” turns (complex planning, tricky code refactors, compliance‑sensitive drafting) due to higher cost but better robustness on edge cases.[^1_5][^1_3]
- In open‑source/bring‑your‑own‑infra setups, **Llama‑3.x / Mistral‑large‑class** models are the common “primary” choice when privacy or control matters more than raw peak quality.[^1_6][^1_7]

The pattern is: *run 70–90% of all agent steps on the smaller-but-smart model, and escalate only when needed* (by classifier or tool‑based router).[^1_8][^1_9]

## Why small models “don’t cut it” alone

Teams avoid tiny models (1–3B) as the main agent brain for serious multi‑tool workflows because:

- They struggle with long‑horizon planning and ReAct‑style loops, leading to broken plans and tool misuse, which cancels any cost savings.[^1_9][^1_7]
- Evaluation reports and platform guides consistently show better tool‑calling reliability and fewer hallucinations in mid‑range and reasoning‑tuned models like o3‑mini versus very small LLMs.[^1_10][^1_1]

So small models are mostly used as *classifiers, routers, or filters*, not as the core planning agent.

## Typical model routing pattern in agentic systems

Common patterns in modern agent frameworks (LangChain, AutoGen, Vertex AI Agent Builder, Copilot Studio, etc.) look like this:[^1_11][^1_12][^1_6]

- **Router / guardrail layer:** often a cheap model (or even rules) to decide: FAQ answer vs. tool‑using agent vs. “escalate to big brain”.[^1_13][^1_9]
- **Tool‑using execution agent:** a mid‑range model (e.g., o3‑mini, Llama‑3 8–70B) running multi‑step loops with tools and RAG.[^1_7][^1_10][^1_1]
- **Expert / overseer model:** a larger reasoning model for:
    - initial or revising high‑level plan
    - reviewing code or critical actions
    - resolving “stuck” situations where mid‑model loops fail.[^1_2][^1_8]

This is now the dominant usage pattern in serious agentic business apps (Microsoft’s agentic business stack, Google Vertex Agent Builder, and many vendor platforms all describe similar multi‑model stacks).[^1_14][^1_6][^1_13]

## Practical takeaway for your own agents

Given your context (multi‑tool, multi‑step agent in a web app), the prevailing choice in 2025 is:

- **Primary agent model:** a reasoning‑tuned mid model (e.g., OpenAI o3‑mini / similar from other vendors).
- **Secondary “expert” model:** a larger top‑tier model, used sparingly for planning or high‑risk steps.
- **Optional small models:** only for routing, intent classification, or quick filters—not as the core agent brain.[^1_3][^1_10][^1_1]

If you tell which providers you plan to use (OpenAI only vs. mixed vs. on‑prem open source), a concrete “which exact models for which agent roles” matrix can be laid out.
<span style="display:none">[^1_15][^1_16][^1_17][^1_18][^1_19][^1_20]</span>

<div align="center">⁂</div>

[^1_1]: https://openai.com/index/openai-o3-mini/

[^1_2]: https://openai.com/index/introducing-o3-and-o4-mini/

[^1_3]: https://inkeep.com/blog/best-ai-models-2025

[^1_4]: https://hyperight.com/chatbots-no-more-openai-launches-o3-and-o4-mini-with-tool-use-and-breakthrough-reasoning/

[^1_5]: https://www.shakudo.io/blog/top-9-large-language-models

[^1_6]: https://sintra.ai/blog/best-ai-agents-in-2025-top-15-tools-platforms-frameworks

[^1_7]: https://so-development.org/top-ai-agent-models-in-2025-architecture-capabilities-and-future-impact/

[^1_8]: https://www.ampcome.com/post/top-7-agentic-ai-trends-in-2025

[^1_9]: https://www.exabeam.com/explainers/agentic-ai/agentic-ai-tools-key-capabilities-and-7-tools-to-know/

[^1_10]: https://www.flowhunt.io/blog/openai-o3-mini-ai-agent-a-compact-yet-powerful-ai-model/

[^1_11]: https://www.anaconda.com/guides/agentic-ai-tools

[^1_12]: https://livechatai.com/blog/llm-agent-frameworks

[^1_13]: https://www.automationanywhere.com/rpa/agentic-ai-platforms

[^1_14]: https://www.microsoft.com/en-us/dynamics-365/blog/business-leader/2025/12/09/the-era-of-agentic-business-applications-arrives-at-convergence-2025/

[^1_15]: https://akka.io/blog/agentic-ai-tools

[^1_16]: https://www.intelegain.com/top-20-agentic-ai-project-ideas-in-2025/

[^1_17]: https://www.mckinsey.com/capabilities/quantumblack/our-insights/one-year-of-agentic-ai-six-lessons-from-the-people-doing-the-work

[^1_18]: https://wotnot.io/blog/best-agentic-ai-companies

[^1_19]: https://openai.com/index/new-tools-for-building-agents/

[^1_20]: https://www.crn.com/news/ai/2025/10-hottest-agentic-ai-tools-and-agents-of-2025-so-far


---

# How would a “Typical model routing pattern in agentic systems” would look like in none codeing agentic systems that still leverages this pattern. Show me the most probable, best compositon in a simple thought tree like way.

A typical non‑coding, visual agentic system still follows the same routing pattern: a “front door” that understands the request, then branches to specialized agents and (optionally) a stronger model for hard cases.[^2_1][^2_3]

## High‑level thought tree

**Root thought: “What should handle this request?”**
→ *User query enters the system; one orchestrator agent decides the path.*[^2_4][^2_4]

1. **Is this simple and answerable from knowledge?**
    - Yes → **FAQ / Knowledge agent** (cheap/fast model, maybe search + canned actions).
    - No → Go to 2.[^2_6][^2_7]
2. **Does this require tools or business workflow?**
    - No → **General assistant agent** (chat, drafting, summarization; mid‑tier model).
    - Yes → Go to 3.[^2_8][^2_10]
3. **What type of workflow is this?**
    - Customer support / ticket / CRM → **Support agent** (integrated with helpdesk tools).
    - Operations / RPA / back‑office → **Automation agent** (RPA, BPMN/flow tools).
    - Data / analytics / reporting → **Analytics agent** (BI, SQL, dashboards).
    - Other domain (HR, finance, etc.) → **Domain‑specific agent**.[^2_10][^2_3]
4. **How hard is the reasoning/planning?**
    - Routine, low‑risk (e.g., update status, pull report) → Stay on **mid‑range model** in that specialized agent.
    - Complex or high‑risk (e.g., multi‑step process change, financial decision, ambiguous request) →
        - Escalate to **“Expert planner” agent** that uses a stronger reasoning model to:
            - clarify the goal,
            - propose or revise a multi‑step plan,
            - hand the plan back to specialized agents for execution.[^2_11][^2_8]
5. **Does this need human oversight?**
    - No → **Auto‑execute plan**, log all steps, return result.
    - Yes or uncertain → **Human‑in‑the‑loop node**: present proposed actions; user approves/edits; agents continue or stop based on the decision.[^2_9][^2_4]

## How this maps to a no‑code canvas

On a drag‑and‑drop builder (OpenAI Agent Builder, other visual orchestration tools), this tree typically appears as:[^2_2][^2_1]

- A **single “Orchestrator” node** at the top (routing logic).
- Several **specialized agent nodes** (FAQ, Support, Automation, Analytics, Domain).
- One **Expert / Planner node** wired as an escalation branch from those agents.
- One or more **Human review nodes** before irreversible or sensitive actions.

This gives the “best probable” composition for non‑coding users: one smart front door, a handful of focused agents, an optional expert model for hard problems, and explicit human checkpoints where the business needs control.
<span style="display:none">[^2_12][^2_13][^2_14][^2_15][^2_16][^2_17][^2_18][^2_19][^2_20][^2_5]</span>

<div align="center">⁂</div>

[^2_1]: https://openai.com/index/new-tools-for-building-agents/

[^2_2]: https://kodexolabs.com/top-agentic-ai-platforms/

[^2_3]: https://www.shakudo.io/blog/top-9-ai-agent-frameworks

[^2_4]: https://botpress.com/blog/ai-agent-routing

[^2_5]: https://www.ibm.com/think/topics/agentic-workflows

[^2_6]: https://orkes.io/blog/what-are-agentic-workflows/

[^2_7]: https://genesishumanexperience.com/2025/09/28/the-six-types-of-ai-agents-you-should-know-in-2025/

[^2_8]: https://sendbird.com/blog/what-are-ai-agentic-workflows

[^2_9]: https://research.aimultiple.com/agentic-orchestration/

[^2_10]: https://www.uipath.com/ai/what-is-agentic-orchestration

[^2_11]: https://www.youtube.com/watch?v=44eFf-tRiSg

[^2_12]: https://datasciencedojo.com/blog/agentic-llm-in-2025/

[^2_13]: https://www.ibm.com/think/insights/ai-agents-2025-expectations-vs-reality

[^2_14]: https://generect.com/blog/openai-agent-builder/

[^2_15]: https://spitch.ai/news/multimodal-models-and-agentic-ai-generative-ai-in-2025/

[^2_16]: https://www.thesys.dev/blogs/agentic-frameworks

[^2_17]: https://www.reddit.com/r/OpenAI/comments/1j91vbx/openai_launches_new_tools_apis_for_building/

[^2_18]: https://dev.to/yeahiasarker/the-best-agentic-ai-framework-options-for-building-multi-agent-systems-in-2025-3l9l

[^2_19]: https://openai.com/index/introducing-agentkit/

[^2_20]: https://kanerika.com/blogs/agentic-ai-trends-2025/


---

# Okay, I started to build an app similar to this in my team, but we still use a single agent architecture. That doesn't seem to cut it. We are looking into building into this pattern that you just described. And I want you to tell me what are the questions that we need to answer first before we continue building the architecture. Right now, we are using AISDK 6. I'm not sure if that is good for multi-agent systems. I think this is the first question that we need to answer to fully commit to this framework or pick another one that is more suited for multi-agent systems.

The first thing to clarify is: AI SDK 6 is absolutely viable for multi‑agent systems; the question is whether it matches your *architecture and ops needs*, not whether it’s “single‑agent only”. Before you commit, you want answers in four buckets: product goals, agent design, framework fit, and operational constraints.[^3_1][^3_2][^3_3][^3_4]

## 1. Product \& problem definition

Questions to align on before touching framework choice:

- What are the top 3–5 *end‑to‑end workflows* you want agents to own (e.g., “triage a support request”, “prepare a sales brief”, “refactor a repo + run tests”)?[^3_5][^3_1]
- For each workflow, what does “success” mean in business terms (speed, accuracy, cost, risk tolerance)?
- Where must humans stay in the loop (approvals, critical actions, customer‑visible changes)?[^3_6][^3_7]
- Do you need strict vendor flexibility (OpenAI + Anthropic + OSS) or are you comfortable going deep on one stack for now?[^3_3][^3_6]


## 2. Agent roles \& routing questions

Before you move from “single agent” to orchestration, lock in:

- Which *distinct roles* do you actually need as separate agents (router/orchestrator, planner, tool‑using worker, evaluator/critic, domain specialists)?[^3_8][^3_5]
- What are the *handoff rules*? When should the router send a request to FAQ vs. tool‑agent vs. expert model?
- How will agents share context: common memory/RAG layer vs. per‑agent prompts with summaries?[^3_9][^3_1]
- Do you want hierarchical patterns (orchestrator → workers) or more peer‑to‑peer delegation?[^3_8][^3_6]


## 3. Framework choice (AI SDK 6 vs others)

Specific questions to decide whether to stay on AI SDK 6 or switch:

- Does AI SDK 6’s **agent‑first abstraction + ToolLoopAgent** cover your needs for:
    - multi‑step tool loops,
    - tool approval / human‑in‑the‑loop,
    - streaming to your React/Next.js front end?[^3_10][^3_11][^3_2]
- Can you comfortably implement *orchestrator‑worker* and *evaluator‑optimizer* patterns with multiple ToolLoopAgents and routes (there are example blocks showing exactly these patterns)?[^3_12][^3_13]
- Do you need *built‑in* multi‑agent graphs and state machines (LangGraph, AgentKit, CrewAI) or are you okay wiring agents together yourself with TypeScript + AI SDK primitives?[^3_3][^3_6][^3_9]
- How important are no‑code/low‑code tools for non‑dev teammates (where AI SDK is weaker than visual orchestrators like Langflow, n8n, OpenAI Agent Builder)?[^3_14][^3_9][^3_3]

If your team is already comfortable in Next.js/Nest.js and wants code‑first control, AI SDK 6 is generally viewed as a solid choice for multi‑agent orchestration; you build orchestrator and worker agents as separate ToolLoopAgents and compose them.[^3_2][^3_13][^3_10]

## 4. Operational \& governance questions

Before scaling beyond a single agent, you also need:

- How will you **log, trace, and debug** multi‑agent runs (per‑agent logs vs. unified trace, correlation IDs, replay tools)?[^3_15][^3_6]
- What are your **latency and cost budgets** per workflow, and how will you enforce them (model routing rules, max steps, timeouts)?[^3_1][^3_5]
- What are your **data and security constraints** (PII, RBAC, auditability)? Do you need features like durable agents, state persistence, or strict on‑prem routing that might push you toward other platforms?[^3_6][^3_9][^3_3]

***

If you want, the next step can be: take one of your real workflows, and map it into an “orchestrator + 2–3 worker agents + evaluator” design, then check line‑by‑line whether AI SDK 6 covers every requirement; that makes the “stick vs switch” decision very concrete.
<span style="display:none">[^3_16][^3_17][^3_18][^3_19][^3_20][^3_21][^3_22]</span>

<div align="center">⁂</div>

[^3_1]: https://www.n-ix.com/how-to-build-multi-agent-ai/

[^3_2]: https://vercel.com/blog/ship-ai-2025-recap

[^3_3]: https://www.langflow.org/blog/the-complete-guide-to-choosing-an-ai-agent-framework-in-2025

[^3_4]: https://vercel.com/docs/ai-sdk

[^3_5]: https://dev.to/leena_malhotra/the-architecture-of-multi-agent-ai-systems-explained-5440

[^3_6]: https://research.aimultiple.com/agentic-orchestration/

[^3_7]: https://www.ibm.com/think/topics/agentic-workflows

[^3_8]: https://www.anthropic.com/engineering/multi-agent-research-system

[^3_9]: https://research.aimultiple.com/agentic-frameworks/

[^3_10]: https://github.com/vercel/ai

[^3_11]: https://www.digitalapplied.com/blog/vercel-agent-tutorial-ai-code-review

[^3_12]: https://www.aisdkagents.com/docs/changelog

[^3_13]: https://www.callstack.com/blog/building-ai-agent-workflows-with-vercels-ai-sdk-a-practical-guide

[^3_14]: https://generect.com/blog/openai-agent-builder/

[^3_15]: https://www.shakudo.io/blog/top-9-ai-agent-frameworks

[^3_16]: https://community.vercel.com/t/multi-agent-workflow-delegate-agents-via-tool-call/26470

[^3_17]: https://github.com/vercel/ai/issues/10071

[^3_18]: https://github.com/vercel/workflow/issues/168

[^3_19]: https://github.com/vercel/ai/issues

[^3_20]: https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf

[^3_21]: https://www.reddit.com/r/AI_Agents/comments/1hq9il6/best_ai_agent_frameworks_in_2025_a_comprehensive/

[^3_22]: https://www.linkedin.com/posts/rakeshgohel01_mastering-multi-agent-systems-activity-7389278410038001664-BJHJ


---

# Our product is a CMS agent that would work independently of any CMS because we would build the agent system, a standalone agent system, a CMS agent that would connect to any CMS by defining tools that would create, update, delete, and read from the CMS API. So we would define the API into tools so with this our agent could use any kind of CMS if we create a module, an adapter to it by defining tools for that specific CMS. What do you think, based on your four buckets, what would fit into that bucket with this product?

For a CMS‑agnostic “CMS Agent” that talks to any CMS via adapter tools, the four buckets map quite cleanly.

## 1. Product \& problem definition

- Core workflows: content ideation, drafting, editing, SEO optimization, publishing, bulk updates/migrations, cleanup (404s, redirects), and audits (broken links, structure, consistency).[^4_1][^4_2]
- Success metrics:
    - Author flow: fewer clicks from idea → published, lower time‑to‑publish.
    - Ops: safe bulk changes (low error rate, full audit trail), predictable latency per action, hard cost ceiling per job.
- Human in the loop: human approval before any publish/delete, before schema changes, and for large bulk edits; auto‑mode allowed only for low‑risk operations (e.g., fixing internal links or metadata suggestions).[^4_3][^4_4]
- Vendor flexibility: must support multiple CMSs via adapters; you want your agent system to be the stable layer, CMS adapters to be pluggable modules.


## 2. Agent roles \& routing for your CMS agent

Concrete roles that make sense for your product:

- Orchestrator agent: understands user intent (“clean up old blog posts”, “create a new landing page”), chooses which specialist agents and CMS tools to invoke, and manages overall plan.[^4_2][^4_5]
- Content specialist agent: handles ideation, outlining, drafting, rewriting, localization, and SEO suggestions, independent of any CMS.[^4_6][^4_1]
- CMS execution agent: given a structured plan (what to create/update/delete), calls the appropriate CMS tools from the active adapter (createEntry, updateField, deleteEntry, publishEntry, etc.).
- QA/review agent: checks diffs, sanity‑checks big/bulk changes, and prepares a human‑readable “change sheet” for approval.
- Optional migration agent: for cross‑CMS work (e.g., WordPress → Contentful), responsible for mapping fields and resolving schema mismatches.

Routing logic examples:

- If intent is “help me write or improve content” → Orchestrator → Content agent only.
- If intent includes “publish”, “update”, “clean up”, “migrate” → Orchestrator → Content agent (if needed) → CMS execution agent → QA agent → human approval.

Shared context: a CMS‑agnostic content model (page, post, asset, taxonomy) passed between agents, with each CMS adapter responsible for mapping that model to its own schema.[^4_1][^4_2]

## 3. Framework fit (AI SDK 6 for this product)

For this product, AI SDK 6 fits well because:

- You can define **per‑CMS tool sets** (adapters) and expose them to your CMS execution agent based on which CMS is active in a workspace.[^4_7][^4_8]
- Orchestrator and CMS/content/QA agents can each be a ToolLoopAgent (or similar agent primitive), wired together in your Nest.js/Next.js backend, with routing logic in TypeScript.[^4_9][^4_10]
- You don’t strictly need a heavyweight multi‑agent graph framework; your topology is relatively stable (orchestrator + 2–4 specialists), which AI SDK 6 can express comfortably.[^4_11][^4_6]

Questions you should explicitly answer here:

- Will you support multiple model providers, or is an OpenAI‑first stack acceptable initially?
- Do you need durable, long‑running jobs (e.g., massive migrations) that might require a workflow engine or durable agents outside AI SDK?
- How much do non‑devs need to orchestrate flows visually? If that becomes critical, you might pair AI SDK with a workflow tool rather than replace it.


## 4. Operational \& governance for a CMS agent

Given you’re editing content in arbitrary CMSs, governance is critical:

- Logging \& traceability: every agent run should produce a structured log: input intent, plan, tools called, CMS objects touched, before/after snapshots, and final status.[^4_12][^4_3]
- Safety rails:
    - Hard caps on bulk operations per run (e.g., max N pages modified without explicit override).
    - Strict human approval on delete/unpublish, schema changes, and cross‑site bulk edits.
- Cost/latency budgets:
    - Content agent can use a higher‑quality model occasionally; CMS execution + QA agents should be cost‑efficient and deterministic.
    - Define SLAs: e.g., single‑page workflows < X seconds, bulk ops as background jobs with progress.
- Multi‑tenant and data separation: ensure one workspace’s CMS adapter credentials and content never leak into another’s run, and that logs anonymize or limit sensitive data based on your customers’ compliance needs.[^4_3][^4_11]

In other words: your product fits very naturally into the orchestrator + content agent + CMS execution agent + QA agent pattern, with AI SDK 6 as a reasonable code‑first backbone. The big design work is in your adapter abstraction, safety/approval flows, and clear separation between content reasoning and CMS‑specific execution.

<div align="center">⁂</div>

[^4_1]: https://www.n-ix.com/how-to-build-multi-agent-ai/

[^4_2]: https://dev.to/leena_malhotra/the-architecture-of-multi-agent-ai-systems-explained-5440

[^4_3]: https://research.aimultiple.com/agentic-orchestration/

[^4_4]: https://www.ibm.com/think/topics/agentic-workflows

[^4_5]: https://www.anthropic.com/engineering/multi-agent-research-system

[^4_6]: https://research.aimultiple.com/agentic-frameworks/

[^4_7]: https://github.com/vercel/ai

[^4_8]: https://vercel.com/docs/ai-sdk

[^4_9]: https://vercel.com/blog/ship-ai-2025-recap

[^4_10]: https://www.callstack.com/blog/building-ai-agent-workflows-with-vercels-ai-sdk-a-practical-guide

[^4_11]: https://www.langflow.org/blog/the-complete-guide-to-choosing-an-ai-agent-framework-in-2025

[^4_12]: https://www.shakudo.io/blog/top-9-ai-agent-frameworks


---

# can you generate a downloadable markdown reoport on these topcis for me from your research, about what startegy engineers use, what models, in what compostion, what is the emerging pattern. Suggest composition and strategy for our case if i want to pivot from single tool use agent to router, multiagent pattern.

Below is a concise, downloadable Markdown report you can drop into your repo (e.g., `docs/model-routing-and-multi-agent-strategy.md`). It focuses on emerging patterns, model choices, and a concrete pivot plan from single‑agent to router + multi‑agent for your CMS agent.

***

# Model Routing \& Multi‑Agent Strategy (2025)

## 1. Overview

Modern agentic apps increasingly use **multi‑agent, multi‑model** architectures instead of a single “do‑everything” agent.[^5_1][^5_2] The emerging norm is: a lightweight router/orchestrator, several specialized agents, and selective use of stronger reasoning models only when necessary.[^5_3][^5_4]

***

## 2. Emerging Engineering Strategies

### 2.1 Why move beyond a single agent

Engineering teams report three main pain points with a single, tool‑using agent:[^5_1][^5_5]

- Prompt bloat: One system prompt must describe all tools, roles, and policies.
- Coordination limits: Complex workflows (planning, tools, review, migration) are hard to debug and evolve.
- Cost and latency: Always using a large model for everything is wasteful.

Multi‑agent architectures solve this by separating concerns: routing, planning, content work, execution, and review.[^5_1][^5_4]

### 2.2 Common orchestration patterns

Across cloud providers and reference architectures, the most common patterns are:[^5_2][^5_6][^5_7]

- **Orchestrated (hub‑and‑spoke)**: A central router/orchestrator calls specialist agents; specialists do not talk to each other directly.
- **Hierarchical**: Orchestrator → planners → workers, sometimes with an evaluator/critic agent.
- **Concurrent / fan‑out**: Router sends the same request to multiple specialists in parallel, then merges results.
- **Handoff**: Primary agent hands off to a more capable “expert” agent for difficult tasks (e.g., planning, high‑risk operations).

For most SaaS products with clear workflows, the orchestrated pattern is recommended as the default because it is easier to reason about and debug.[^5_1][^5_6]

***

## 3. Model Choices \& Compositions

### 3.1 Two‑tier model strategy

Real‑world systems increasingly converge on a **two‑tier (sometimes three‑tier)** strategy:[^5_8][^5_9][^5_10]

- **Tier 1 – Workhorse models**
    - Examples: OpenAI o4‑mini/o3‑mini class, smaller GPT‑4.1 derivatives, mid‑range Gemini/Claude equivalents.
    - Use: routing, typical agent steps, standard tool use, light planning.
    - Rationale: best cost/latency balance while still supporting tool use and moderate reasoning.
- **Tier 2 – Expert reasoning models**
    - Examples: full‑size GPT‑4.1, stronger Claude or Gemini reasoning models.
    - Use: complex planning, ambiguous instructions, high‑risk edits, cross‑system migrations.
    - Rationale: invoked sparingly, often by a router or planner agent, when Tier 1 confidence is low or task has high stakes.[^5_2][^5_10]
- **Optional Tier 0 – Tiny models / classifiers**
    - Use: intent classification, safety screening, simple routing heuristics.
    - Rationale: ultra‑cheap and fast, but not used for core planning or complex tool sequences.[^5_11][^5_10]


### 3.2 How models map to agents

Typical mapping in production multi‑agent systems:[^5_1][^5_2]

- Router/orchestrator agent → Tier 1 model
- Specialist workers (content, CMS execution, QA) → Tier 1 model
- Planner or expert reviewer agent → Tier 2 model (only for hard cases)
- Lightweight classifier/router (optional) → Tier 0 model

This keeps 70–90% of calls on Tier 1 while still allowing Tier 2 to “rescue” difficult or sensitive tasks.[^5_3][^5_10]

***

## 4. Recommended Composition for Your CMS Agent

Your product: a **CMS‑agnostic “CMS Agent”** that connects to any CMS via adapter tools (create/update/delete/read via each CMS’s API).

### 4.1 Proposed agent roles

For your use case, a clear **orchestrated, multi‑agent** design fits well:[^5_1][^5_6]

1. **Router / Orchestrator Agent** (Tier 1 model)
    - Understands user intent (“draft a new landing page”, “bulk unpublish old posts”, “migrate blog content”).
    - Decides which specialist agents to call and in what order.
    - Performs light overall planning and keeps track of workflow state.
2. **Content Agent** (Tier 1, optionally Tier 2 for complex tasks)
    - Ideation, outlining, drafting, rewriting, localization, SEO suggestions.
    - CMS‑agnostic: operates on an internal “content object” schema (title, body, metadata, SEO, taxonomy).
3. **CMS Execution Agent** (Tier 1)
    - Responsible for all CMS tool calls via adapters.
    - Takes structured “plans” (e.g., list of operations) and executes them using the active CMS module (WordPress, Contentful, Sanity, etc.).
    - Handles pagination, rate limits, retries, and mapping your internal content model to CMS‑specific fields.
4. **QA / Review Agent** (Tier 1, with optional escalation to Tier 2)
    - Summarizes changes, checks for obvious issues (broken links, missing metadata, inconsistent language).
    - Prepares human‑readable diff reports and approval summaries.
5. **Optional Migration / Schema Agent** (Tier 2 for difficult cases)
    - Handles cross‑CMS field mapping and complex structural changes.
    - Escalated to only when schema inference or non‑trivial mapping is needed.

### 4.2 Routing logic (high‑level)

A typical flow after your pivot:

- User request → **Router**
    - If pure content help (no CMS changes): Router → Content Agent → answer back.
    - If content + publish/update: Router → Content Agent (optional) → CMS Execution Agent → QA Agent → Human approval.
    - If large‑scale or ambiguous changes (e.g., “restructure our blog”): Router → Planner/Expert (Tier 2) → produce plan → CMS Execution Agent → QA Agent → Human approval.

***

## 5. Pivot Plan: Single Agent → Router + Multi‑Agent (AI SDK 6)

### 5.1 Why AI SDK 6 is sufficient

AI SDK 6 is designed to support **agent‑first, tool‑loop** workflows and can express multi‑agent architectures by composing multiple agents (e.g., multiple ToolLoopAgents) and routing between them in your TypeScript backend.[^5_12][^5_13][^5_14] You don’t need a different framework to get started with this pattern.

### 5.2 Minimal migration steps

1. **Extract your current “god agent” into an Orchestrator**
    - Keep its high‑level ReAct/system rules.
    - Remove tool overload: instead of directly calling every CMS tool, let it decide *which agent* should handle the task.
2. **Split tools and prompts into 2–3 new agents**
    - Content Agent: only content‑related tools (RAG over style guides, SEO knowledge, etc.).
    - CMS Execution Agent: only CMS adapter tools (CRUD, publish, bulk ops).
    - QA Agent: read‑only CMS tools + diff/summarization functions.
3. **Define clear handoff contracts**
    - Orchestrator → Content Agent: “Here is the user intent and existing content; produce a content plan + draft”.
    - Orchestrator/Content Agent → CMS Execution Agent: “Here is a list of operations to perform on content objects”.
    - CMS Execution Agent → QA Agent: “Here are the proposed changes and their results; review and produce an approval summary”.
4. **Add model routing configuration**
    - Use Tier 1 model (e.g., o3‑mini‑class) as default for all agents.
    - Introduce an optional Tier 2 model for:
        - complex planning (router/planner),
        - high‑risk operations (large bulk edits, migrations).
    - Put this behind config flags so you can experiment by tenant or environment.
5. **Introduce human‑in‑the‑loop and safety rails**
    - Require explicit approval for destructive actions or large bulk edits.
    - Log every agent step, including: user request, routed path, tools used, CMS entities touched.

***

## 6. Strategy Summary

- Use an **orchestrated multi‑agent pattern** with a router, 2–3 specialists, and optional expert planner as your baseline.
- Adopt a **two‑tier model strategy**: Tier 1 for routine steps, Tier 2 only for complex planning or high‑risk modifications.[^5_8][^5_9][^5_10]
- Keep your **CMS integration layer purely in tools/adapters**, with agents operating on a CMS‑agnostic content model.
- AI SDK 6 is an adequate, code‑first foundation; you can evolve into more advanced orchestration frameworks later if you outgrow it.[^5_12][^5_13][^5_14]

***

You can now save this file as `docs/model-routing-and-multi-agent-strategy.md` in your repo and iterate on it as your architecture and experiments evolve.
<span style="display:none">[^5_15][^5_16][^5_17][^5_18][^5_19][^5_20][^5_21][^5_22][^5_23]</span>

<div align="center">⁂</div>

[^5_1]: https://www.getmaxim.ai/articles/best-practices-for-building-production-ready-multi-agent-systems/

[^5_2]: https://developers.openai.com/tracks/building-agents/

[^5_3]: https://collabnix.com/multi-agent-multi-llm-systems-the-future-of-ai-architecture-complete-guide-2025/

[^5_4]: https://aishwaryasrinivasan.substack.com/p/architecting-next-gen-ai-with-multi

[^5_5]: https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/

[^5_6]: https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns

[^5_7]: https://microsoft.github.io/multi-agent-reference-architecture/docs/reference-architecture/Patterns.html

[^5_8]: https://openai.com/index/introducing-o3-and-o4-mini/

[^5_9]: https://www.gocodeo.com/post/top-5-reasoning-models-to-use-in-2025-speed-specialty-whats-next

[^5_10]: https://cookbook.openai.com/examples/partners/model_selection_guide/model_selection_guide

[^5_11]: https://www.patronus.ai/ai-agent-development/ai-agent-routing

[^5_12]: https://github.com/vercel/ai

[^5_13]: https://vercel.com/blog/ship-ai-2025-recap

[^5_14]: https://www.callstack.com/blog/building-ai-agent-workflows-with-vercels-ai-sdk-a-practical-guide

[^5_15]: https://dl.acm.org/doi/10.24963/ijcai.2025/5

[^5_16]: https://people.cs.kuleuven.be/~danny.weyns/papers/2019EMAS.pdf

[^5_17]: https://dev.to/kapusto/ai-agent-routing-enhancing-multi-agent-systems-3hga

[^5_18]: https://intellectualead.com/best-llm-writing/

[^5_19]: https://generect.com/blog/openai-agent-builder/

[^5_20]: https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf

[^5_21]: https://www.reddit.com/r/OpenAI/comments/1mkkued/after_a_thorough_evaluation_of_chatgpt_5_these/

[^5_22]: https://www.linkedin.com/posts/andreashorn1_openai-a-practical-guide-to-building-agents-activity-7318661831126867968-l--a

[^5_23]: https://skywork.ai/blog/midjourney-prompts-formulas-2025/

