# AI Engineering Knowledge Base - Table of Contents

**Purpose**: Comprehensive educational reference for building production-grade AI agents  
**Organization**: 12 layers (Foundation → Advanced) with 72 topics total  
**Grounding**: Research papers, production systems, proven implementations from this codebase

**Last Updated**: 2026-01-03
**Status**: 🚧 In Progress

---

## Quick Navigation

-   [How to Use This Knowledge Base](#how-to-use-this-knowledge-base)
-   [Learning Paths](#learning-paths)
-   [Progress Tracker](#progress-tracker)
-   [Layer Index](#layer-index)
-   [Related Documentation](#related-documentation)

---

## How to Use This Knowledge Base/

### For Beginners

Start with **Layer 0** (Foundations), then progress through **Layers 1-3**. This covers LLM basics, prompt engineering, and simple agents.

### For Intermediate Developers

Jump to **Layers 4-6** if you understand LLMs and basic agents. Focus on memory, RAG, and planning patterns.

### For Production Teams

Focus on **Layers 7-11** for reliability, error handling, tools, monitoring, and multi-agent systems.

### For Researchers

Explore **Layer 12** for cutting-edge patterns and experimental techniques.

### As Reference

Use Ctrl+F to search for specific patterns (e.g., "circuit breaker" → Layer 7.3).

---

## Learning Paths

### Path 1: Beginner → Intermediate (4-6 weeks)

```
Layer 0 (Foundations) → Layer 1 (Prompts) → Layer 2 (Context) →
Layer 3 (Agents) → Layer 4 (Memory) → Layer 5 (RAG)
```

**Outcome**: Build simple RAG-powered agents with memory

### Path 2: Production Engineering (3-4 weeks)

```
Layer 3 (Agents) → Layer 7 (Error Recovery) → Layer 8 (Tools) →
Layer 9 (HITL) → Layer 11 (Production Patterns)
```

**Outcome**: Deploy reliable, monitored agents with safety features

### Path 3: Advanced Patterns (2-3 weeks)

```
Layer 6 (Planning) → Layer 10 (Multi-Agent) → Layer 12 (Cutting-Edge)
```

**Outcome**: Implement complex orchestration and self-improving agents

---

## Progress Tracker

**Completion**: 116/117 topics (99%)

| Layer                                | Topics | Status         | Completion   |
| ------------------------------------ | ------ | -------------- | ------------ |
| Layer 0: Foundations                 | 3      | ✅ Complete    | 13/13 (100%) |
| Layer 1: Prompt Engineering          | 3      | ✅ Complete    | 14/14 (100%) |
| Layer 2: Context Engineering         | 3      | ✅ Complete    | 13/13 (100%) |
| Layer 3: Agent Architecture          | 4      | 🚧 In Progress | 18/20 (90%)  |
| Layer 4: Memory & State              | 5      | ✅ Complete    | 21/21 (100%) |
| Layer 5: Retrieval & RAG             | 4      | ✅ Complete    | 20/20 (100%) |
| Layer 6: Planning & Orchestration    | 4      | ✅ Complete    | 20/20 (100%) |
| Layer 7: Error Recovery & Resilience | 4      | ✅ Complete    | 4/4 (100%)   |
| Layer 8: Tool Design Patterns        | 4      | ✅ Complete    | 4/4 (100%)   |
| Layer 9: Human-in-the-Loop           | 3      | ⏳ Pending     | 0/15         |
| Layer 10: Multi-Agent Systems        | 4      | ⏳ Pending     | 0/20         |
| Layer 11: Production Engineering     | 5      | ⏳ Pending     | 0/25         |
| Layer 12: Cutting-Edge Patterns      | 4      | ⏳ Pending     | 0/20         |

**Latest Updates** (2026-01-03):

**Layer 8: Tool Design Patterns** (4/4 topics - ✅ 100% COMPLETE - Restructured Jan 2026):

_Consolidated from 19 granular topics into 4 high-signal documents:_

-   ✅ 8.1 Tool Definition & Schema - **NEW!** Zod validation, naming conventions, description patterns, 90%+ selection accuracy
-   ✅ 8.2 Context Injection - **NEW!** experimental_context, AgentContext interface, dependency injection, testability
-   ✅ 8.3 Tool Registry & Discovery - **NEW!** Centralized catalog, metadata, semantic discovery, 56% Recall improvement
-   ✅ 8.4 Tool Security & Safety - **NEW!** Risk classification, approval gates, egress control, OWASP Top 10

**Layer 7: Error Recovery & Resilience** (4/4 topics - ✅ 100% COMPLETE - Restructured Jan 2026):

_Consolidated from 24 granular topics into 4 high-signal documents:_

-   ✅ 7.1 Error Classification & Taxonomy - **NEW!** Five-Module Taxonomy, Three-Source Model, MAST for multi-agent, 87% root cause detection
-   ✅ 7.2 Recovery Strategy Selection - **NEW!** Retry/Fallback/Skip/Escalate decision tree, exponential backoff, Saga pattern
-   ✅ 7.3 Resilience Patterns - **NEW!** Circuit breakers, bulkheads, timeouts, per-tool isolation, 80% cascade prevention
-   ✅ 7.4 Tool Validation & Self-Healing - **NEW!** Silent failure detection, post-mutation verification, anomaly detection, 98% accuracy

**Layer 6: Planning & Orchestration** (20/20 topics - ✅ 100% COMPLETE - Restructured Dec 2025):

_Plan-and-Execute (5/5 - ✅ COMPLETE)_:

-   ✅ 6.1.1 Separation - **NEW!** Planner-Executor-Replanner pattern, ReWOO (5× token efficiency), AI SDK v6 ToolLoopAgent
-   ✅ 6.1.2 Alternatives - **NEW!** Multi-plan generation, constrained/score-based selection, 40% dead-end reduction
-   ✅ 6.1.3 Feasibility - **NEW!** Multi-dimension scoring (tool/param/resource/permission), pre-execution validation
-   ✅ 6.1.4 Fallbacks - **NEW!** Error-type registry, alternative plan switching, graceful degradation, human escalation
-   ✅ 6.1.5 Implementation - **NEW!** Complete AI SDK v6 patterns, Planner-Worker-Solver, variable substitution (#E1, #E2)

_Reflexion (5/5 - ✅ COMPLETE)_:

-   ✅ 6.2.1 Reflexion Loop - **NEW!** Generate→Critique→Refine, +22% AlfWorld, +20% HotPotQA, episodic memory
-   ✅ 6.2.2 Quality Scoring - **NEW!** LLM-as-judge, rubric-based (5-dimension), hybrid scoring, calibration techniques
-   ✅ 6.2.3 Iteration Limits - **NEW!** 2-3 iterations optimal, combined stopping criteria, diminishing returns research
-   ✅ 6.2.4 Adaptive Reflection - **NEW!** Complexity classification (simple/moderate/complex/critical), adaptive config
-   ✅ 6.2.5 Research Findings - **NEW!** Self-correction limits (Huang 2024), external feedback essential, benchmark synthesis

_Tree of Thoughts (5/5 - ✅ COMPLETE)_:

-   ✅ 6.3.1 Multi-Path - **NEW!** ToT (4%→74% Game of 24), LATS (92.7% HumanEval), Self-Consistency (+17.9% GSM8K)
-   ✅ 6.3.2 Branching - **NEW!** Fixed K-way, adaptive, constrained branching, K=3-5 optimal
-   ✅ 6.3.3 Pruning - **NEW!** Score-based, depth-limited, beam pruning, 60-80% node reduction
-   ✅ 6.3.4 Best-First - **NEW!** Priority queue implementation, A\* variant, 50% fewer nodes explored
-   ✅ 6.3.5 When to Use - **NEW!** Decision framework, cost-benefit (10-50× cost for 70% improvement), CoT threshold

_Preflight Validation (5/5 - ✅ COMPLETE)_:

-   ✅ 6.4.1 Check Before Execute - **NEW!** 70-80% failure prevention, tool/param/resource/auth checks, suggestions
-   ✅ 6.4.2 Resource Existence - **NEW!** Automatic reference extraction, fuzzy matching, cached checks
-   ✅ 6.4.3 Constraints - **NEW!** Uniqueness, state transitions, relationships, business invariants
-   ✅ 6.4.4 Schema Compatibility - **NEW!** Zod validation, transformations, refinements, early return pattern
-   ✅ 6.4.5 Suggestions - **NEW!** Fuzzy matching, recent resources, corrective actions, 60-70% auto-recovery

**Layer 5: RAG & Retrieval** (20/20 topics - ✅ 100% COMPLETE - Restructured Dec 2025):

_Vector Search Fundamentals (5/5 - ✅ COMPLETE)_:

-   ✅ 5.1.1 Embedding Documents - **RESTRUCTURED!** AI SDK v6 `embed`/`embedMany`, OpenAI text-embedding-3-small (80.5% MTEB), batch processing
-   ✅ 5.1.2 Similarity Metrics - **RESTRUCTURED!** Cosine (85% of RAG), Dot Product (2-3× faster), Euclidean, AI SDK v6 `cosineSimilarity`
-   ✅ 5.1.3 Index Types - **RESTRUCTURED!** HNSW (95%+ recall), IVF (memory-efficient), Flat (prototyping), pgvector integration
-   ✅ 5.1.4 Query Strategies - **RESTRUCTURED!** HyDE (10-20% recall), Cohere Rerank (15-30% precision), Hybrid Search (BM25+vector)
-   ✅ 5.1.5 Top-K Selection - **RESTRUCTURED!** Retrieve-then-rerank (100→5, 94% precision), Adaptive K, MMR diversity

_Chunking Strategies (5/5 - ✅ COMPLETE)_:

-   ✅ 5.2.1 Fixed-Size Chunks - **RESTRUCTURED!** Token-based (512 tokens), 10-20% overlap critical, sentence-aware, tiktoken integration
-   ✅ 5.2.2 Semantic Chunks - **NEW!** Max-Min chunking (0.85-0.90 AMI), paragraph-based, embedding-based, hierarchical patterns
-   ✅ 5.2.3 Overlapping Windows - **NEW!** 10-20% overlap optimal (NVIDIA 15%), stride calculation, boundary handling
-   ✅ 5.2.4 Metadata Enrichment - **NEW!** 15-30% precision improvement, hierarchical paths, entity extraction, filtered retrieval
-   ✅ 5.2.5 Chunk Size Trade-offs - **NEW!** 256-512 factoid, 512-1024 analytical, query-adaptive sizing, multi-resolution indexing

_Hybrid Search (5/5 - ✅ COMPLETE)_:

-   ✅ 5.3.1 Vector Search - **NEW!** Basic semantic search, pgvector HNSW, filtered search, AI SDK v6 `embed`/`cosineSimilarity`
-   ✅ 5.3.2 Fuzzy Search - **NEW!** Levenshtein/Damerau-Levenshtein, Elasticsearch AUTO fuzziness, 80% typos within 1 edit distance
-   ✅ 5.3.3 BM25 Keyword Search - **NEW!** k1=1.2, b=0.75 defaults, BM25S 500× speedup, hybrid BM25+vector patterns
-   ✅ 5.3.4 Reranking - **NEW!** 20-35% precision improvement, Cohere Rerank API, cross-encoder patterns, batch/conditional reranking
-   ✅ 5.3.5 Fusion Strategies - **NEW!** RRF (k=60), weighted fusion, 8-15% improvement over single retrieval, multi-source hybrid

_RAG Patterns (5/5 - ✅ COMPLETE)_:

-   ✅ 5.4.1 Naive RAG - **NEW!** ~25% accuracy baseline, retrieve→augment→generate pipeline, streaming patterns
-   ✅ 5.4.2 Advanced RAG - **NEW!** HyDE (10-20% recall), query rewriting (30-40% precision), multi-query expansion, step-back prompting
-   ✅ 5.4.3 Agentic RAG - **NEW!** Self-RAG (+40%), CRAG, GraphRAG (+76% summarization), iterative retrieval, self-correction
-   ✅ 5.4.4 Context Optimization - **NEW!** Lost in the Middle mitigation, 50-70% compression, relevance ordering, MMR diversity
-   ✅ 5.4.5 Evaluation Metrics - **NEW!** RAGAS (faithfulness, relevancy), NDCG@10 >0.8 target, precision/recall/MRR, continuous monitoring

**Layer 4: Memory & State - Long-Term Memory** (5/5 topics - ✅ 100% COMPLETE - Restructured Dec 2025):

_Long-Term Memory (5/5 - ✅ COMPLETE)_:

-   ✅ 4.3.1 Vector Databases - **RESTRUCTURED!** LanceDB, Pinecone, pgvector, Weaviate, AI SDK v6 integration
-   ✅ 4.3.2 Semantic Search - **RESTRUCTURED!** Basic semantic, hybrid search, reranking (Cohere), HyDE
-   ✅ 4.3.3 Fact Extraction - **RESTRUCTURED!** LLM-based extraction, NER (spaCy), knowledge graphs (Neo4j)
-   ✅ 4.3.4 Cross-Session Retrieval - **RESTRUCTURED!** Three-tier architecture, Redis caching, recency-weighted
-   ✅ 4.3.5 When to Use - **RESTRUCTURED!** Memory type decision framework, hybrid memory system, promotion-based

**Layer 4: Memory & State - State Persistence** (5/5 topics - ✅ 100% COMPLETE - Restructured Dec 2025):

_State Persistence & Checkpointing (5/5 - ✅ COMPLETE)_:

-   ✅ 4.4.1 Why Checkpoint - **RESTRUCTURED!** 70-90% cost savings, 99%+ recovery, ByteCheckpoint, LangGraph
-   ✅ 4.4.2 What to Save - **RESTRUCTURED!** 5 core components, serialization, compression (10:1 ratio)
-   ✅ 4.4.3 When to Checkpoint - **RESTRUCTURED!** √N rule, phase transitions, hybrid scheduler, <5% overhead
-   ✅ 4.4.4 How to Resume - **RESTRUCTURED!** Three-phase recovery, idempotency, fallback recovery
-   ✅ 4.4.5 Implementation - **RESTRUCTURED!** PostgreSQL, Redis, SQLite, tiered storage, gzip compression

**Layer 4: Memory & State - Working Memory** (6/6 topics - ✅ 100% COMPLETE - Restructured Dec 2025):

_Memory Systems Overview_ (1/1 - ✅ COMPLETE):

-   ✅ 4.0.1 Memory Systems Overview - **RESTRUCTURED!** CoALA framework, Mem0 benchmarks (26% accuracy, 91% latency), hybrid storage

_Working Memory (Short-Term)_ (5/5 - ✅ COMPLETE):

-   ✅ 4.1.1 Working Memory Concept - **RESTRUCTURED!** RAM analogy, 0.2ms access, 90% token savings, AI SDK v6 integration
-   ✅ 4.1.2 Entity Extraction - **RESTRUCTURED!** Rule-based vs LLM-based, PARSE (64.7% accuracy), 96% memory savings
-   ✅ 4.1.3 Sliding Window Management - **RESTRUCTURED!** FIFO eviction, 96% cost reduction, Azure 5-turn recommendation
-   ✅ 4.1.4 Reference Resolution - **RESTRUCTURED!** Coreference (83.3 F1-score), recency heuristics, LLM fallback
-   ✅ 4.1.5 Universal Working Memory - **RESTRUCTURED!** Complete TypeScript implementation, AI SDK v6 patterns

**Layer 3: Agent Architecture** (17/20 topics - 🚧 85% COMPLETE - Restructured Dec 2025):

_What is an AI Agent?_ (3/3 - ✅ COMPLETE):

-   ✅ 3.1.1 Agent Definition - **RESTRUCTURED!** Core components (Perception→Reasoning→Acting→Memory), AI SDK v6 ToolLoopAgent
-   ✅ 3.1.2 Agent Types - **RESTRUCTURED!** Reflexive, Goal-Based, Utility-Based, Learning, hybrid architectures
-   ✅ 3.1.3 When to Use Agents - **RESTRUCTURED!** Decision framework (Single LLM → Workflow → Agent), anti-patterns

_ReAct Pattern_ (5/5 - ✅ COMPLETE):

-   ✅ 3.2.1 ReAct Loop - **RESTRUCTURED!** Think→Act→Observe cycle, AI SDK v6 ToolLoopAgent, stopWhen, 15-25% accuracy
-   ✅ 3.2.2 Reasoning Phase - **RESTRUCTURED!** Context assessment, gap identification, tool selection strategies
-   ✅ 3.2.3 Acting Phase - **RESTRUCTURED!** Tool execution, validation, single vs parallel, HITL confirmation
-   ✅ 3.2.4 Observation Phase - **RESTRUCTURED!** Result interpretation, memory updates, loop control, error recovery
-   ✅ 3.2.5 AI SDK v6 Implementation - **RESTRUCTURED!** ToolLoopAgent API, streaming, context injection, production patterns

_Tool Calling & Execution_ (5/5 - ✅ COMPLETE):

-   ✅ 3.3.1 Tool Definition - **RESTRUCTURED!** AI SDK v6 `inputSchema`, Zod schemas, rich descriptions, execution flow
-   ✅ 3.3.2 Tool Registry - **RESTRUCTURED!** Centralized catalog, TOOL_METADATA pattern, dynamic discovery
-   ✅ 3.3.3 Context Injection - **RESTRUCTURED!** `experimental_context`, AgentContext interface, context factory
-   ✅ 3.3.4 Result Validation - **RESTRUCTURED!** Read-after-write verification, schema validation, 60% silent failure detection
-   ✅ 3.3.5 Tool Composition - **RESTRUCTURED!** Sequential, parallel, map-reduce, conditional, hybrid patterns
-   ✅ 3.3.6 Dynamic Tool Search - **NEW!** Anthropic Tool Search Tool, 34-94% token savings, semantic/BM25/hybrid search, Spring AI patterns

_Loop Control & Convergence_ (4/5 - 🚧 80% COMPLETE - Restructured Dec 2025):

-   ✅ 3.4.1 Max Steps - **RESTRUCTURED!** AI SDK v6 `stopWhen: stepCountIs()`, REFRAIN 20-55% token reduction, adaptive/progressive limits, checkpoints
-   ✅ 3.4.2 Convergence Detection - **RESTRUCTURED!** 96.5% converge within 3 iterations, multi-criteria detection, finish tools, goal-state verification (ReflAct 93.3%)
-   ✅ 3.4.3 Stuck Detection - **RESTRUCTURED!** 60% failures involve loops, exact repetition, progress-based, composite detectors, Autono adaptive abandonment, HITL recovery
-   ⏳ 3.4.4 Loop State Machine - _Pending_
-   ✅ 3.4.5 Early Exit - **RESTRUCTURED!** 20-55% token reduction (REFRAIN), entropy-based (HALT-CoT 15-30%), progress-based, Stop-RAG (4.7× efficiency)

**Layer 1: Prompt Engineering** (14/14 topics - ✅ 100% COMPLETE):

_Basic Techniques (5/5 - ✅ COMPLETE - Restructured Dec 2025)_:

-   ✅ 1.1.1 Instruction Design - **RESTRUCTURED!** CLEAR Framework, 6 Core Principles, 4 Implementation Patterns
-   ✅ 1.1.2 Few-Shot Learning - **RESTRUCTURED!** Example Selection, Dynamic RAG, Token Optimization
-   ✅ 1.1.3 Chain-of-Thought - **RESTRUCTURED!** 50-400% gains, Self-Ask, Structured Templates
-   ✅ 1.1.4 Zero-Shot CoT - **RESTRUCTURED!** Magic Phrases, Plan-and-Solve, Chain of Draft
-   ✅ 1.1.5 Self-Consistency - **RESTRUCTURED!** Voting, USC, Multi-Model Ensemble, +7-18% accuracy

**Layer 4: Memory & State** (21/21 topics - ✅ 100% COMPLETE):

_Memory Systems Overview (1/1 - ✅ COMPLETE)_:

-   ✅ 4.0.1 Memory Systems Overview - **NEW!** Comprehensive introduction to memory in AI agents
    -   CoALA framework (Working, Semantic, Episodic, Procedural memory types)
    -   Letta/MemGPT self-editing memory architecture
    -   Mem0 production-ready implementation (26% accuracy improvement, 91% latency reduction)
    -   Hybrid storage patterns (Vector + Graph), implementation approaches

_State Persistence & Checkpointing (5/5 - ✅ COMPLETE)_:

-   ✅ 4.4.1 Why Checkpoint - **NEW!** Crash recovery, resume conversations, fault tolerance (21KB, 13+ sources)
    -   LangGraph + Restate examples, ByteCheckpoint benchmarks (529× faster saves)
    -   Real-world ROI: $1.14M/year savings, 99% recovery time improvement
-   ✅ 4.4.2 What to Save - **NEW!** State components, serialization strategies (22KB, 6 sources)
    -   Messages, execution state, working memory, subgoals, metadata
    -   Size optimization: compression, delta encoding, reference external data
-   ✅ 4.4.3 When to Checkpoint - **NEW!** Optimal timing strategies (20KB, 4 sources)
    -   √N rule, phase transitions, before expensive operations, HITL pauses
    -   Overhead analysis: 0.5-1% overhead with every 5-10 steps
-   ✅ 4.4.4 How to Resume - **NEW!** Loading and continuing execution (17KB, 3 sources)
    -   Three-phase recovery: load, reconstruct, continue
    -   Handling edge cases: missing checkpoints, corruption, external state mismatch
-   ✅ 4.4.5 Implementation - **NEW!** Database storage, JSON serialization (21KB, 3 sources)
    -   PostgreSQL, Redis, SQLite comparison with performance benchmarks
    -   Production patterns: connection pooling, batch operations, multi-backend strategy

_Long-Term Memory (5/5 - ✅ COMPLETE)_:

-   ✅ 4.3.1 Vector Databases - Comprehensive comparison of LanceDB, Pinecone, Weaviate for production (29KB, 15+ sources)
-   ✅ 4.3.2 Semantic Search - Embedding models, similarity metrics, hybrid search (25KB, 10+ sources)
-   ✅ 4.3.3 Fact Extraction & Storage - Mem0 architecture, entity recognition, knowledge graphs (27KB, 15+ sources)
-   ✅ 4.3.4 Cross-Session Retrieval - Persistent memory across conversations (24KB, 9+ sources)
-   ✅ 4.3.5 When to Use vs Working Memory - Decision framework, cost-benefit analysis, ROI calculations (22KB)

**Layer 3: Agent Architecture** (8/20 topics - 🚧 40% COMPLETE):

_What is an AI Agent?_ (3/3 - ✅ COMPLETE - Restructured Dec 2025):

-   ✅ 3.1.1 Agent Definition - **RESTRUCTURED!** Core components (Perception→Reasoning→Acting→Memory), AI SDK v6 ToolLoopAgent, research grounding
-   ✅ 3.1.2 Agent Types - **RESTRUCTURED!** Reflexive, Goal-Based, Utility-Based, Learning agents, hybrid architectures
-   ✅ 3.1.3 When to Use Agents - **RESTRUCTURED!** Decision framework (Single LLM → Workflow → Agent), cost-benefit analysis, anti-patterns

_ReAct Pattern_ (5/5 - ✅ COMPLETE - Restructured Dec 2025):

-   ✅ 3.2.1 ReAct Loop - **RESTRUCTURED!** Think→Act→Observe cycle, AI SDK v6 ToolLoopAgent, stopWhen conditions, 15-25% accuracy improvement
-   ✅ 3.2.2 Reasoning Phase - **RESTRUCTURED!** Context assessment, gap identification, tool selection, reasoning patterns
-   ✅ 3.2.3 Acting Phase - **RESTRUCTURED!** Tool execution, validation, single vs parallel actions, HITL confirmation
-   ✅ 3.2.4 Observation Phase - **RESTRUCTURED!** Result interpretation, memory updates, loop control, error recovery
-   ✅ 3.2.5 AI SDK v6 Implementation - **RESTRUCTURED!** ToolLoopAgent API, tool definition, streaming, context injection, production patterns

**Layer 2: Context Engineering** (12/12 topics - ✅ 100% COMPLETE):

_Token Optimization_ (4/4 - ✅ COMPLETE - Restructured Dec 2025):

-   ✅ 2.1.1 Compression Techniques - **RESTRUCTURED!** LLMLingua-2 (3-6× faster), LongLLMLingua (21.4% RAG), 60-90% token reduction
-   ✅ 2.1.2 Importance Scoring - **RESTRUCTURED!** RankRAG, Cross-Encoder Reranking (15-30% accuracy), Two-Stage Retrieval
-   ✅ 2.1.3 Lazy Loading - **RESTRUCTURED!** Two-Tier/Three-Tier Fetching, Hierarchical Loading, 90%+ token reduction
-   ✅ 2.1.4 Hybrid Content Fetching - **RESTRUCTURED!** Query-Adaptive Fetching, Progressive Enhancement, 75-95% savings

_Context Management Patterns_ (4/4 - ✅ COMPLETE - Restructured Dec 2025):

-   ✅ 2.2.1 Sliding Window - **RESTRUCTURED!** StreamingLLM (22.2× speedup), attention sinks, 4M token capability
-   ✅ 2.2.2 Hierarchical Memory - **RESTRUCTURED!** HiAgent (2× success rate), 10:1 compression, ACL 2025
-   ✅ 2.2.3 Context Pruning - **RESTRUCTURED!** LazyLLM, TokenSelect (23.84× speedup), AgentDiet (39.9-59.7% reduction)
-   ✅ 2.2.4 KV-Cache Optimization - **RESTRUCTURED!** RocketKV (400× compression), FastKV, EpiCache, production frameworks

_Injection Strategies_ (4/4 - ✅ COMPLETE - Restructured Dec 2025):

-   ✅ 2.3.1 Injection Location - **RESTRUCTURED!** ACE framework (+10.6%), RAT (+13-43%), system/user/assistant placement
-   ✅ 2.3.2 Injection Timing - **RESTRUCTURED!** "When to Retrieve" (95%+ accuracy), DeepRAG (+26.4%), 30-50% cost reduction
-   ✅ 2.3.3 Injection Format - **RESTRUCTURED!** XML/JSON/Markdown comparison, 15-40% performance impact, RAG formatting strategies
-   ✅ 2.3.4 Working Memory Pattern - **RESTRUCTURED!** Entity extraction, importance scoring, episodic memory, 10-25% accuracy improvement

**Layer 1: Prompt Engineering** (14/14 topics - ✅ COMPLETE - Restructured Dec 2025):

_Basic Techniques_ (5/5 - ✅ RESTRUCTURED):

-   ✅ 1.1.1 Instruction Design - CLEAR Framework, 6 Core Principles, 4 Implementation Patterns
-   ✅ 1.1.2 Few-Shot Learning - Example Selection Criteria, Dynamic RAG, Token Optimization
-   ✅ 1.1.3 Chain-of-Thought - 50-400% improvement, Self-Ask, Structured Templates
-   ✅ 1.1.4 Zero-Shot CoT - Magic Phrases, Plan-and-Solve, Chain of Draft (90% token reduction)
-   ✅ 1.1.5 Self-Consistency - Voting, USC, Multi-Model Ensemble, +7-18% accuracy

_System Prompts_ (5/5):

-   ✅ 1.2.1 Role Definition - System prompts, personas, agent analysis
-   ✅ 1.2.2 Capabilities Declaration - Tool inventory, boundaries, CMS tools
-   ✅ 1.2.3 Rules & Constraints - Guardrails, safety, quality, operational rules
-   ✅ 1.2.4 Output Format Specification - JSON Schema, structured outputs 2024-2025
-   ✅ 1.2.5 Modular Architecture - Composable prompts, versioning, production patterns

_Prompt Templates_ (4/4): **← NEWLY COMPLETED**

-   ✅ 1.3.1 Template Engines - Jinja2, Handlebars, Mustache, Liquid, PromptL (2024-2025) **← NEW**
-   ✅ 1.3.2 Conditional Sections - Control flow, adaptive prompts, context-aware logic **← NEW**
-   ✅ 1.3.3 Versioning & Caching - Langfuse, PromptLayer, 60-90% cost reduction **← NEW**
-   ✅ 1.3.4 Reserved for future expansion

**Layer 0: Foundations** (complete):

-   ✅ 0.1.1 LLM Fundamentals - Complete (transformer architecture, attention mechanism)
-   ✅ 0.1.2 Training vs Inference - Complete (cost analysis, fine-tuning, RLHF, optimization)
-   ✅ 0.1.3 Context Windows - Complete (memory patterns, hybrid fetching)
-   ✅ 0.1.4 Sampling Parameters - Complete (temperature, top-p, top-k, agent tuning)
-   ✅ 0.1.5 Model Selection Guide - Complete (GPT-4, Claude, Gemini, Llama, decision frameworks)
-   ✅ 0.2.1 Standard vs Thinking Models - Complete (o1, reasoning, benchmarks)
-   ✅ 0.2.2 Reasoning Models Deep Dive - Complete (o1/o3 architecture, RL training, thinking tokens)
-   ✅ 0.2.3 When to Use Which Model - Complete (decision frameworks, use case matrix, routing)
-   ✅ 0.2.4 Trade-offs - Complete (cost-latency-quality triangle, optimization strategies)
-   ✅ 0.3.1 Tokenization - Complete (BPE, WordPiece, SentencePiece, cost optimization)
-   ✅ 0.3.2 Embedding Models - Complete (OpenAI, SBERT, vector search, LanceDB)
-   ✅ 0.3.3 Vector Similarity - Complete (cosine, dot product, Euclidean, Manhattan)
-   ✅ 0.3.4 Dimensionality Trade-offs - Complete (384 vs 768 vs 1536, PCA, UMAP, curse)

---

## Layer Index

### Layer 0: Foundations (Prerequisites)

**Goal**: Understand LLMs, tokens, embeddings, and model selection

#### 0.1 LLM Fundamentals

-   [0.1.1 What is a Large Language Model?](./kb/0-foundations/0.1.1-llm-intro.md) ✅
    -   **Status**: Complete - Comprehensive intro to transformers, attention mechanism, training process
    -   **Length**: 600+ lines with 10+ cited sources
    -   **Includes**: Codebase integration examples, evolution timeline, practical recommendations
-   [0.1.2 Training vs Inference](./kb/0-foundations/0.1.2-training-vs-inference.md) ✅
    -   **Status**: Complete - Comprehensive guide to training vs inference economics
    -   **Length**: 700+ lines with cost analysis, real-world examples
    -   **Includes**: Pretraining, fine-tuning (SFT, LoRA, RLHF), cost optimization, codebase examples
-   [0.1.3 Context Windows & Token Limits](./kb/0-foundations/0.1.3-context-windows.md) ✅
    -   **Status**: Complete - Deep dive into context management, token optimization
    -   **Length**: 700+ lines with examples from this codebase
    -   **Includes**: Hierarchical memory, working memory, hybrid fetching patterns
-   [0.1.4 Sampling Parameters: Temperature, Top-P, Top-K](./kb/0-foundations/0.1.4-sampling-parameters.md) ✅
    -   **Status**: ✅ Complete - Restructured with 2024-2025 research (Min-P, Monte Carlo Temperature)
    -   **Length**: 1050+ lines with comprehensive template structure
    -   **Includes**: Min-p sampling (ICLR 2025), multi-temperature scaling (+7.3 points), capability-specific effects, production best practices, observability patterns
    -   **Updated**: 2025-11-21 with latest research grounding
-   [0.1.5 Model Selection Guide](./kb/0-foundations/0.1.5-model-selection.md) ✅
    -   **Status**: ✅ Complete - Restructured to template format (Nov 2025)
    -   **Length**: 1070 lines with TL;DR, Core Concept, 3 Implementation Patterns, Benchmarks
    -   **Updated**: Gemini 3 Pro (41% reasoning), GPT-5.1 ($1.25/$10), Claude 4.5 models with Nov 2025 benchmarks
    -   **Includes**: Decision matrix, agentic comparison table, framework integration (AI SDK 6), production best practices, cost-reliability analysis

#### 0.2 Thinking vs Non-Thinking Models

-   [0.2.1 Standard Models vs Thinking Models](./kb/0-foundations/0.2.1-standard-models.md) ✅
    -   **Status**: ✅ Complete - Updated with latest 2025 benchmarks (Nov 28, 2025)
    -   **Length**: 680+ lines with TL;DR, 3 Implementation Patterns, Production Best Practices
    -   **Updated**: o3-released (41-53% ARC-AGI-1, <3% ARC-AGI-2), o4-mini (21-41% ARC-AGI-1), DeepSeek-R1-0528 (91.4% AIME'24, 87.5% AIME'25, 81% GPQA), Qwen3-Thinking (92.3% AIME'25)
    -   **Includes**: AI SDK 6 integration (reasoningEffort, extractReasoningMiddleware, sendReasoning, streaming reasoning), hybrid routing pattern, cost analysis, 12 authoritative sources
    -   **Format**: Standalone knowledge base (no project-specific references)
    -   **Key Insight**: Open-source models (DeepSeek-R1-0528, Qwen3) now match commercial reasoning models on many benchmarks
-   [0.2.2 Reasoning Models Deep Dive](./kb/0-foundations/0.2.2-reasoning-models.md) ✅
    -   **Status**: ✅ Complete - Comprehensive guide to reasoning model architecture and training (Nov 28, 2025)
    -   **Length**: 740+ lines with TL;DR, 4 Implementation Patterns (RL training approaches), AI SDK 6 integration
    -   **Includes**: Process supervision vs outcome-based RL, thinking token flow diagrams, DeepSeek GRPO training, Qwen3 four-stage pipeline, distillation patterns
    -   **Research**: OpenAI o3 (10× compute scaling), DeepSeek-R1 paper, Qwen3 Technical Report, 12 authoritative sources
    -   **Key Insight**: Multiple training approaches exist—outcome-based RL (OpenAI), GRPO (DeepSeek), hybrid modes (Qwen3)—each with distinct trade-offs
-   [0.2.3 When to Use Which](./kb/0-foundations/0.2.3-when-to-use-which.md) ✅
    -   **Status**: ✅ Complete - Comprehensive model selection guide with November 2025 pricing (Nov 28, 2025)
    -   **Length**: 820+ lines with TL;DR, 4 routing patterns, decision matrices, cost analysis
    -   **Includes**: GPT-4.1/Claude 4.5/Gemini 2.5 pricing, complexity-based router, cascade pattern, custom provider abstraction, prompt caching
    -   **Research**: SWE-bench results, provider strengths comparison, 10 authoritative sources
    -   **Key Insight**: Hybrid routing saves 80-90% by using cheap models for simple tasks, premium for complex
-   [0.2.4 Trade-offs (Cost, Latency, Capabilities)](./kb/0-foundations/0.2.4-tradeoffs.md) ✅
    -   **Status**: ✅ Complete - Restructured with 2025 pricing (Dec 2025)
    -   **Length**: 370+ lines with TL;DR, Core Concept, Implementation Patterns
    -   **Includes**: Iron Triangle (cost/latency/quality), 2025 model pricing, optimization strategies, prompt caching

#### 0.3 Tokens, Embeddings, and Vector Spaces

-   [0.3.1 Tokenization (BPE, WordPiece, SentencePiece)](./kb/0-foundations/0.3.1-tokenization.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 380+ lines with TL;DR, Core Concept, Implementation Patterns
    -   **Includes**: BPE (GPT), WordPiece (BERT), SentencePiece (T5), GitHub 4× faster BPE (2024), tiktoken optimization
-   [0.3.2 Embedding Models & Vector Spaces](./kb/0-foundations/0.3.2-embedding-models.md) ✅
    -   **Status**: ✅ Complete - Restructured with 2025 MTEB findings (Dec 2025)
    -   **Length**: 460+ lines with TL;DR, 4 Implementation Patterns, hybrid search
    -   **Includes**: Voyage-3-large (MTEB #1), OpenAI text-embedding-3, Cohere, SBERT, MTEB inflation warning
-   [0.3.3 Vector Similarity Metrics](./kb/0-foundations/0.3.3-vector-similarity.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 340+ lines with TL;DR, Core Concept, Implementation Patterns
    -   **Includes**: Cosine similarity, dot product, Euclidean, Manhattan, normalization for speed (3× faster)
-   [0.3.4 Dimensionality Trade-offs](./kb/0-foundations/0.3.4-dimensionality.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 370+ lines with TL;DR, Core Concept, 3 Implementation Patterns
    -   **Includes**: 768-1536 sweet spot, curse of dimensionality, PCA, UMAP, OpenAI flexible dimensions API

---

### Layer 1: Prompt Engineering

**Goal**: Master prompting techniques from single-shot to chain-of-thought

#### 1.1 Basic Prompting Techniques

-   [1.1.1 Instruction Design](./1-prompts/1.1.1-instruction-design.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 415+ lines with TL;DR, CLEAR Framework, 4 Implementation Patterns
    -   **Includes**: 6 Core Principles, Task Decomposition, Conditional Instructions, Production Best Practices
-   [1.1.2 Few-Shot Learning](./1-prompts/1.1.2-few-shot.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 415+ lines with TL;DR, 4 Implementation Patterns, Dynamic RAG
    -   **Includes**: Example Selection Criteria, Token Optimization, Ordering Strategies
-   [1.1.3 Chain-of-Thought (CoT)](./1-prompts/1.1.3-chain-of-thought.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 375+ lines with TL;DR, 4 Implementation Patterns, Self-Ask
    -   **Includes**: 50-400% improvement benchmarks, Structured Reasoning Template, Verification Steps
-   [1.1.4 Zero-Shot CoT](./1-prompts/1.1.4-zero-shot-cot.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 380+ lines with TL;DR, 4 Implementation Patterns, Plan-and-Solve
    -   **Includes**: Magic Phrases, Two-Stage Process, Chain of Draft (90% token reduction)
-   [1.1.5 Self-Consistency](./1-prompts/1.1.5-self-consistency.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 415+ lines with TL;DR, 4 Implementation Patterns, Multi-Model Ensemble
    -   **Includes**: +7-18% accuracy, Weighted Voting, Universal Self-Consistency (USC)

#### 1.2 System Prompts & Instructions

-   [1.2.1 Role Definition (Identity)](./1-prompts/1.2.1-role-definition.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 500+ lines with TL;DR, 4 Implementation Patterns
    -   **Includes**: Expert, Specialist, Consultant, Multi-Role patterns, 20-40% accuracy improvement
-   [1.2.2 Capabilities Declaration](./1-prompts/1.2.2-capabilities.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 460+ lines with TL;DR, 4 Implementation Patterns
    -   **Includes**: Tool Inventory, Knowledge Domains, Capability Matrix, Auto-Generated, 15-30% hallucination reduction
-   [1.2.3 Rules & Constraints](./1-prompts/1.2.3-rules-constraints.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 515+ lines with TL;DR, 4 Implementation Patterns
    -   **Includes**: Layered Guardrails, Priority-Based, Context-Conditional, Escalation patterns
-   [1.2.4 Output Format Specification](./1-prompts/1.2.4-output-format.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 440+ lines with TL;DR, 4 Implementation Patterns
    -   **Includes**: Zod Schema with AI SDK v6, Prefix Markers (ReAct), Section Templates, Enum Constraints
-   [1.2.5 Modular Prompt Architecture](./1-prompts/1.2.5-modular-architecture.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 500+ lines with TL;DR, 4 Implementation Patterns
    -   **Includes**: Function-Based Modules, Tag-Based Structure, Registry Pattern, File-Based Modules
    -   **Codebase Example**: `server/prompts/react.xml`

#### 1.3 Prompt Templates & Variables

-   [1.3.1 Template Engines (Jinja2, Handlebars, Mustache)](./1-prompts/1.3.1-template-engines.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 490+ lines with TL;DR, 4 Implementation Patterns
    -   **Includes**: Jinja2 (Python), Handlebars (TypeScript), Mustache, TypeScript Template Engine Class
-   [1.3.2 Conditional Sections & Control Flow](./1-prompts/1.3.2-conditional-sections.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 520+ lines with TL;DR, 6 Implementation Patterns
    -   **Includes**: Environment-Based, Permission-Based, Model-Specific, Task Complexity, Context-Aware Examples, Graceful Degradation
-   [1.3.3 Versioning & Caching](./1-prompts/1.3.3-versioning-caching.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 540+ lines with TL;DR, 5 Implementation Patterns
    -   **Includes**: Langfuse Versioning, File-Based, Anthropic Native Caching, Redis Caching, Combined Strategy (60-90% cost reduction)

---

### Layer 2: Context Engineering

**Goal**: Optimize token usage and manage context effectively

#### 2.1 Token Optimization

-   [2.1.1 Compression Techniques](./2-context/2.1.1-compression.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 440+ lines with TL;DR, 4 Implementation Patterns, Research & Benchmarks
    -   **Includes**: LLMLingua-2 (3-6× faster), LongLLMLingua (21.4% RAG improvement), 60-90% token reduction
-   [2.1.2 Importance Scoring](./2-context/2.1.2-importance-scoring.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 515+ lines with TL;DR, 5 Implementation Patterns, Research & Benchmarks
    -   **Includes**: RankRAG, Cross-Encoder Reranking (15-30% accuracy improvement), Two-Stage Retrieval
-   [2.1.3 Lazy Loading (Fetch on Demand)](./2-context/2.1.3-lazy-loading.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 540+ lines with TL;DR, 5 Implementation Patterns, Research & Benchmarks
    -   **Includes**: Two-Tier/Three-Tier Fetching, Hierarchical Loading, 90%+ token reduction
-   [2.1.4 Hybrid Content Fetching](./2-context/2.1.4-hybrid-fetching.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Length**: 510+ lines with TL;DR, 5 Implementation Patterns, Research & Benchmarks
    -   **Includes**: Query-Adaptive Fetching, Progressive Enhancement, 75-95% token savings

#### 2.2 Context Management Patterns

-   [2.2.1 Sliding Window (Fixed Size)](./2-context/2.2.1-sliding-window.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: StreamingLLM (22.2× speedup), attention sinks, 4M token capability
-   [2.2.2 Hierarchical Memory (Subgoal-Based)](./2-context/2.2.2-hierarchical-memory.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: HiAgent (2× success rate), 10:1 compression, ACL 2025
-   [2.2.3 Context Pruning (Remove Low-Value)](./2-context/2.2.3-context-pruning.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: LazyLLM, TokenSelect (23.84× speedup), AgentDiet (39.9-59.7% reduction)
-   [2.2.4 KV-Cache Optimization](./2-context/2.2.4-kv-cache.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: RocketKV (400× compression), FastKV, EpiCache, production frameworks
-   [2.2.5 Prompt Caching & Context Compaction](./2-context/2.2.5-prompt-caching.md) ✅
    -   **Status**: ✅ Complete - NEW (Dec 2025)
    -   **Includes**: Prefix-based caching (50-90% savings), user-assistant compaction pairs, multi-provider compatibility (OpenAI, Anthropic, DeepSeek)
    -   **Research**: Anthropic Prompt Caching (2024), OpenCode production patterns, AI SDK integration

#### 2.3 Context Injection Strategies

-   [2.3.1 Where to Inject (System, User, Assistant)](./2-context/2.3.1-injection-location.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: ACE framework (+10.6%), RAT (+13-43%), system/user/assistant placement
-   [2.3.2 Timing (Always vs Conditional)](./2-context/2.3.2-injection-timing.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: "When to Retrieve" (95%+ accuracy), DeepRAG (+26.4%), 30-50% cost reduction
-   [2.3.3 Format (Structured vs Narrative)](./2-context/2.3.3-injection-format.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: XML/JSON/Markdown comparison, 15-40% performance impact
-   [2.3.4 Working Memory Pattern](./2-context/2.3.4-working-memory.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: Entity extraction, importance scoring, episodic memory, 10-25% accuracy improvement

---

### Layer 3: Agent Architecture

**Goal**: Build autonomous agents using ReAct pattern with tool calling

#### 3.1 What is an AI Agent?

-   [3.1.1 Definition & Components](./3-agents/3.1.1-agent-definition.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: Core agent components (Perception→Reasoning→Acting→Memory), AI SDK v6 ToolLoopAgent patterns
-   [3.1.2 Agent Types (Reflexive, Goal-Based, Utility-Based, Learning)](./3-agents/3.1.2-agent-types.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: Agent complexity spectrum, hybrid architectures, layered approach
-   [3.1.3 When to Use Agents vs Single LLM Calls](./3-agents/3.1.3-when-agents.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: Decision framework, cost-benefit analysis, anti-patterns to avoid

#### 3.2 ReAct Pattern (Reasoning + Acting)

-   [3.2.1 Core Loop: Think → Act → Observe → Repeat](./3-agents/3.2.1-react-loop.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: ReAct cycle, AI SDK v6 ToolLoopAgent, stopWhen conditions, 15-25% accuracy improvement
-   [3.2.2 Reasoning Phase (Plan Next Step)](./3-agents/3.2.2-reasoning-phase.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: Context assessment, gap identification, tool evaluation, reasoning patterns
-   [3.2.3 Acting Phase (Execute Tool)](./3-agents/3.2.3-acting-phase.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: Tool execution flow, validation, single vs parallel actions, HITL confirmation
-   [3.2.4 Observation Phase (Interpret Result)](./3-agents/3.2.4-observation-phase.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: Result interpretation, memory updates, loop control, error recovery patterns
-   [3.2.5 Implementation with AI SDK v6](./3-agents/3.2.5-ai-sdk-implementation.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: ToolLoopAgent API, tool definition with Zod, streaming integration, context injection

#### 3.3 Tool Calling & Execution

-   [3.3.1 Tool Definition (Zod Schemas, Descriptions)](./3-agents/3.3.1-tool-definition.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: AI SDK v6 `inputSchema` pattern, Zod schemas, 60-80% error reduction with clear schemas
    -   **Research**: Scalifiai (Oct 2025), QuotientAI (May 2025), AI SDK v6 documentation
-   [3.3.2 Tool Registry & Metadata](./3-agents/3.3.2-tool-registry.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: 79% enterprises adopting registries (2025), centralized catalog, 30-50% duplication reduction, MCP integration
    -   **Research**: Collibra (Oct 2025), LiangjunJiang (Sep 2025), Solo.io AgentRegistry (Nov 2025)
-   [3.3.3 Context Injection (experimental_context)](./3-agents/3.3.3-context-injection.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: AI SDK v6 `experimental_context`, AgentContext interface, context factory, 70-90% testability improvement
    -   **Research**: AG2 documentation (Apr 2025), MCP protocol
-   [3.3.4 Result Validation](./3-agents/3.3.4-result-validation.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: 60% of failures are silent, read-after-write verification, 85% error reduction (VeriGuard)
    -   **Research**: VeriGuard (Oct 2025), EviBound (Oct 2025 - 0% hallucination), VerifiAgent (Apr 2025)
-   [3.3.5 Tool Composition Patterns](./3-agents/3.3.5-composition.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: 2-5× speedup with parallel, sequential/parallel/map-reduce/conditional/hybrid patterns
    -   **Research**: AI SDK v6 multi-step, LightcapAI monoidal structures (Nov 2025), Skywork.ai orchestration (Sep 2025)
-   [3.3.6 Dynamic Tool Search](./3-agents/3.3.6-tool-search.md) ✅
    -   **Status**: ✅ Complete - NEW (Dec 2025)
    -   **Includes**: Anthropic Tool Search Tool, deferred loading, semantic/BM25/hybrid search, Spring AI patterns
    -   **Research**: Anthropic (Nov 2025), Spring AI Tzolov (Dec 2025), Stacklok MCP Optimizer (2025), Arcade benchmarks (2025)

#### 3.4 Loop Control & Convergence

-   [3.4.1 Max Steps Limits](./3-agents/3.4.1-max-steps.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: AI SDK v6 `stopWhen: stepCountIs()`, REFRAIN 20-55% token reduction, adaptive/progressive limits, checkpoints
    -   **Research**: REFRAIN (Oct 2025), LangChain max_iterations, AutoGen patterns
-   [3.4.2 Convergence Detection](./3-agents/3.4.2-convergence.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: 96.5% converge within 3 iterations, multi-criteria detection, explicit finish tools, goal-state verification
    -   **Research**: Plan Verification (2025), ReflAct (May 2025 - 93.3% success), HALT-CoT (Jul 2025)
-   [3.4.3 Stuck Detection](./3-agents/3.4.3-stuck-detection.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: 60% failures involve loops, exact repetition, progress-based, composite detectors, HITL recovery
    -   **Research**: Autono Framework (Apr 2025), ReflAct (May 2025), browser-use patterns
-   [3.4.4 Loop State Machine](./3-agents/3.4.4-state-machine.md) ⏳
-   [3.4.5 Early Exit Strategies](./3-agents/3.4.5-early-exit.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: 20-55% token reduction (REFRAIN), entropy-based (HALT-CoT 15-30%), progress-based, Stop-RAG (4.7× efficiency)
    -   **Research**: REFRAIN (Oct 2025), HALT-CoT (Jul 2025), S-GRPO (May 2025), Stop-RAG (Oct 2025)

---

### Layer 4: Memory & State

**Goal**: Implement memory systems for context retention and state persistence

#### 4.0 Memory Systems Overview

-   [4.0.1 Memory Systems Overview](./4-memory/4.0.1-memory-systems-overview.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: CoALA framework (Working, Semantic, Episodic, Procedural), Mem0 benchmarks (26% accuracy, 91% latency reduction)
    -   **Research**: CoALA (2024), Mem0 (2025), Letta/MemGPT, JetBrains Research (Dec 2025)

#### 4.1 Working Memory (Short-Term)

-   [4.1.1 Working Memory Concept](./4-memory/4.1.1-working-memory-concept.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: RAM analogy, 26% accuracy improvement (Mem0), 91% latency reduction, CoALA framework
    -   **Research**: Mem0 (2025), CoALA (2024), Azure OpenAI patterns, Letta/MemGPT
-   [4.1.2 Entity Extraction](./4-memory/4.1.2-entity-extraction.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: Rule-based vs LLM-based extraction, 96% memory savings, PARSE (64.7% accuracy)
    -   **Research**: PARSE/Amazon (2024), LQCA framework (2025), Triplex (2024)
-   [4.1.3 Sliding Window Management](./4-memory/4.1.3-sliding-window.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: FIFO eviction, 96% cost reduction, 5-turn Azure recommendation, turn/token/hybrid patterns
    -   **Research**: Azure OpenAI (2025), LangChain, Strands Agents SDK
-   [4.1.4 Reference Resolution](./4-memory/4.1.4-reference-resolution.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: Coreference resolution (83.3 F1-score), recency heuristics, type+distance, LLM fallback
    -   **Research**: CorefBERT (2021), LQCA framework (2025), ACL 2024 coreference research
-   [4.1.5 Universal Working Memory Implementation](./4-memory/4.1.5-universal-working-memory.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: Complete TypeScript implementation, 0.2ms lookup, 90% token reduction, AI SDK v6 integration
    -   **Research**: Mem0 (2025), AWS AgentCore, A-MEM, CoALA (2024)

#### 4.2 Subgoal Memory (Medium-Term) (5/5 - ✅ COMPLETE - Restructured Dec 2025)

-   [4.2.1 HiAgent Hierarchical Memory](./4-memory/4.2.1-hiagent-hierarchical-memory.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: 2× success rate improvement, 10:1 compression ratio, subgoal-based chunking, AI SDK v6 integration
    -   **Research**: HiAgent (ACL 2025), CoALA (2024), Context Engineering (2025)
-   [4.2.2 Compression Triggers](./4-memory/4.2.2-compression-triggers.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: 80% capacity rule, token/event/time/hybrid triggers, emergency fallbacks
    -   **Research**: LangChain Context Engineering (2025), Dynamic Memory Compression (ICML 2024)
-   [4.2.3 Subgoal Detection](./4-memory/4.2.3-subgoal-detection.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: LLM-based (95% accuracy) vs heuristic (60-70%), hybrid approach, AI SDK v6 generateObject
    -   **Research**: HiAgent (ACL 2025), ReAcTree (ICLR 2025), SelfGoal (2024)
-   [4.2.4 Summarization Strategies](./4-memory/4.2.4-summarization-strategies.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: Outcome-focused (10:1 compression), extractive/abstractive/hybrid, batch summarization
    -   **Research**: HiAgent (ACL 2025), Mem0 (2025), LangChain Context Engineering
-   [4.2.5 Compression Ratios](./4-memory/4.2.5-compression-ratios.md) ✅
    -   **Status**: ✅ Complete - Restructured to new template format (Dec 2025)
    -   **Includes**: 10:1 target ratio, multi-level compression (50:1+), adaptive compression, monitoring
    -   **Research**: HiAgent (ACL 2025), Dynamic Memory Compression (ICML 2024)

#### 4.3 Long-Term Memory (Persistent) (5/5 - ✅ COMPLETE - Restructured Dec 2025)

-   [4.3.1 Vector Databases (LanceDB, Pinecone, Weaviate)](./4-memory/4.3.1-vector-databases.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: LanceDB (embedded), Pinecone (managed), pgvector (PostgreSQL), Weaviate (hybrid), AI SDK v6 integration
    -   **Research**: Sub-50ms latency, 26% accuracy improvement (Mem0), production scaling patterns
-   [4.3.2 Semantic Search](./4-memory/4.3.2-semantic-search.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: Basic semantic, hybrid search (BM25+vector), reranking (Cohere), HyDE patterns
    -   **Research**: 40-60% improvement with hybrid, MRR benchmarks, embedding model comparison
-   [4.3.3 Fact Extraction & Storage](./4-memory/4.3.3-fact-extraction.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: LLM-based extraction, NER (spaCy), knowledge graphs (Neo4j), hybrid storage
    -   **Research**: Mem0, A-MEM, temporal facts, conflict resolution, 85%+ extraction accuracy
-   [4.3.4 Cross-Session Retrieval](./4-memory/4.3.4-cross-session-retrieval.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: Three-tier architecture, session lifecycle, recency-weighted retrieval, Redis caching
    -   **Research**: Mem0 (26% accuracy, 91% latency), LongMemEval benchmark, cross-session context
-   [4.3.5 When to Use vs Working Memory](./4-memory/4.3.5-when-to-use.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: Memory type decision framework, hybrid memory system, promotion-based patterns
    -   **Research**: Working vs Episodic vs Semantic tiers, TTL policies, cost-benefit analysis

#### 4.4 State Persistence & Checkpointing (5/5 - ✅ COMPLETE - Restructured Dec 2025)

-   [4.4.1 Why Checkpoint: Crash Recovery & Resume](./4-memory/4.4.1-why-checkpoint.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: 70-90% cost savings, 99%+ recovery time reduction, crash recovery, conversation resume, HITL
    -   **Research**: ByteCheckpoint (529× faster), LangGraph PostgresSaver, Restate durable execution
-   [4.4.2 What to Save in Checkpoints](./4-memory/4.4.2-what-to-save.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: 5 core components (messages, execution, memory, subgoals, metadata), serialization, compression
    -   **Research**: OpenAI Agents SDK sessions, Mem0 architecture, message compression (10:1 ratio)
-   [4.4.3 When to Checkpoint: Timing Strategies](./4-memory/4.4.3-when-to-checkpoint.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: √N rule, phase transitions, before expensive ops, hybrid scheduler, <5% overhead target
    -   **Research**: Mathematical checkpoint optimization, LangGraph persistence, production benchmarks
-   [4.4.4 How to Resume: Load and Continue](./4-memory/4.4.4-how-to-resume.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: Three-phase recovery (load→reconstruct→continue), idempotency, fallback recovery
    -   **Research**: LangGraph automatic resume, Restate replay, <1s resume time benchmarks
-   [4.4.5 Implementation: Storage Backends & Serialization](./4-memory/4.4.5-implementation.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: PostgreSQL (production), Redis (2-5ms), SQLite (embedded), tiered storage, gzip compression
    -   **Research**: LangGraph PostgresSaver, Couchbase checkpointer, 60-80% compression reduction

---

### Layer 5: Retrieval & RAG

**Goal**: Build retrieval-augmented generation systems with vector search

#### 5.1 Vector Search Fundamentals (5/5 - ✅ COMPLETE - Restructured Dec 2025)

-   [5.1.1 Embedding Documents](./kb/5-rag/5.1.1-embedding-documents.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: AI SDK v6 `embed`/`embedMany`, OpenAI text-embedding-3-small (80.5% MTEB), batch processing, chunking
    -   **Research**: OpenAI (2024), MTEB benchmarks, Voyage AI, production patterns
-   [5.1.2 Similarity Metrics (Cosine, Dot Product, Euclidean)](./kb/5-rag/5.1.2-similarity-metrics.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: Cosine (85% of RAG), Dot Product (2-3× faster normalized), Euclidean, AI SDK v6 `cosineSimilarity`
    -   **Research**: MTEB (2024), Google Research, database-specific optimizations
-   [5.1.3 Index Types (Flat, IVF, HNSW)](./kb/5-rag/5.1.3-index-types.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: HNSW (95%+ recall, production default), IVF (memory-efficient), Flat (prototyping), pgvector integration
    -   **Research**: Milvus benchmarks (2024), MyScale (10M vectors), ann-benchmarks, algorithm trade-offs
-   [5.1.4 Query Strategies](./kb/5-rag/5.1.4-query-strategies.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: HyDE (10-20% recall boost), Reranking with Cohere (15-30% precision), Hybrid Search (BM25+vector), Query Expansion
    -   **Research**: HyDE (Gao et al. 2023), Cohere Rerank (2024), Multi-Query RAG patterns
-   [5.1.5 Top-K Selection](./kb/5-rag/5.1.5-top-k-selection.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: Retrieve-then-rerank (100→5, 94% precision), Adaptive K, MMR for diversity, context budget optimization
    -   **Research**: LangChain patterns (2024), Microsoft RAG benchmarks, production retrieval strategies

#### 5.2 Chunking Strategies (5/5 - ✅ COMPLETE - Restructured Dec 2025)

-   [5.2.1 Fixed-Size Chunks (512 Tokens)](./kb/5-rag/5.2.1-fixed-size.md) ✅
    -   **Status**: ✅ Complete - **RESTRUCTURED!** to new template format (Dec 2025)
    -   **Includes**: Token-based chunking (512 tokens), 10-20% overlap critical, sentence-aware boundaries, tiktoken integration
    -   **Research**: OpenAI cookbook (2024), LangChain patterns, retrieval benchmarks (92% recall with overlap)
-   [5.2.2 Semantic Chunks (Paragraph, Section)](./kb/5-rag/5.2.2-semantic-chunks.md) ✅
    -   **Status**: ✅ Complete - **NEW!** (Dec 2025)
    -   **Includes**: Paragraph-based, embedding-based, hierarchical chunking, Max-Min algorithm (0.85-0.90 AMI)
    -   **Research**: Chroma Research (2024), NVIDIA (2024), semantic boundary detection
-   [5.2.3 Overlapping Windows](./kb/5-rag/5.2.3-overlapping-windows.md) ✅
    -   **Status**: ✅ Complete - **NEW!** (Dec 2025)
    -   **Includes**: 10-20% overlap optimal, NVIDIA 15% finding, stride calculation, boundary handling
    -   **Research**: NVIDIA FinanceBench (2024), LlamaIndex defaults, retrieval benchmarks
-   [5.2.4 Metadata Enrichment](./kb/5-rag/5.2.4-metadata.md) ✅
    -   **Status**: ✅ Complete - **NEW!** (Dec 2025)
    -   **Includes**: 15-30% precision improvement, hierarchical paths, entity extraction, filtered retrieval
    -   **Research**: Microsoft RAG Architecture (2024), LlamaIndex patterns, production filtering
-   [5.2.5 Chunk Size Trade-offs](./kb/5-rag/5.2.5-tradeoffs.md) ✅
    -   **Status**: ✅ Complete - **NEW!** (Dec 2025)
    -   **Includes**: 256-512 factoid, 512-1024 analytical, query-adaptive sizing, multi-resolution indexing
    -   **Research**: arXiv multi-dataset analysis (2025), content-type specific sizing

#### 5.3 Hybrid Search (5/5 - ✅ COMPLETE - Restructured Dec 2025)

-   [5.3.1 Vector Search (Semantic)](./kb/5-rag/5.3.1-vector-search.md) ✅
    -   **Status**: ✅ Complete - **NEW!** (Dec 2025)
    -   **Includes**: Basic semantic search, pgvector HNSW, filtered search, multi-vector patterns
    -   **Research**: AI SDK v6 patterns, cosine similarity optimization, production indexing
-   [5.3.2 Fuzzy Search (Typo Tolerance)](./kb/5-rag/5.3.2-fuzzy-search.md) ✅
    -   **Status**: ✅ Complete - **NEW!** (Dec 2025)
    -   **Includes**: Levenshtein/Damerau-Levenshtein, Elasticsearch AUTO fuzziness, 80% typos within 1 edit
    -   **Research**: Elasticsearch fuzzy query (2024), Fuse.js, edit distance algorithms
-   [5.3.3 BM25 (Keyword)](./kb/5-rag/5.3.3-bm25.md) ✅
    -   **Status**: ✅ Complete - **NEW!** (Dec 2025)
    -   **Includes**: k1=1.2, b=0.75 defaults, BM25S 500× speedup, hybrid BM25+vector
    -   **Research**: BM25S (2024), LlamaIndex, Elasticsearch implementations
-   [5.3.4 Reranking (Cross-Encoder)](./kb/5-rag/5.3.4-reranking.md) ✅
    -   **Status**: ✅ Complete - **NEW!** (Dec 2025)
    -   **Includes**: 20-35% precision improvement, Cohere Rerank API, batch/conditional reranking
    -   **Research**: Cohere Rerank 4 (2024), ARAGOG benchmarks, ZeroEntropy zerank-1
-   [5.3.5 Fusion Strategies (Weighted, RRF)](./kb/5-rag/5.3.5-fusion.md) ✅
    -   **Status**: ✅ Complete - **NEW!** (Dec 2025)
    -   **Includes**: RRF (k=60), weighted fusion, 8-15% improvement, multi-source hybrid search
    -   **Research**: Pinecone cascading retrieval (2024), Weaviate hybrid, score normalization

#### 5.4 RAG Patterns (5/5 - ✅ COMPLETE - Restructured Dec 2025)

-   [5.4.1 Naive RAG (Retrieve → Inject → Generate)](./kb/5-rag/5.4.1-naive-rag.md) ✅
    -   **Status**: ✅ Complete - **NEW!** (Dec 2025)
    -   **Includes**: ~25% accuracy baseline, three-stage pipeline, streaming patterns, source attribution
    -   **Research**: Modular RAG Survey (2024), Prompt Engineering Guide, production baselines
-   [5.4.2 Advanced RAG (Query Rewriting, HyDE)](./kb/5-rag/5.4.2-advanced-rag.md) ✅
    -   **Status**: ✅ Complete - **NEW!** (Dec 2025)
    -   **Includes**: HyDE (10-20% recall), query rewriting (30-40% precision), multi-query expansion, step-back
    -   **Research**: HyDE (Gao et al. 2023), Google DeepMind step-back (2024), LangChain patterns
-   [5.4.3 Agentic RAG (Iterative Retrieval, Self-Reflection)](./kb/5-rag/5.4.3-agentic-rag.md) ✅
    -   **Status**: ✅ Complete - **NEW!** (Dec 2025)
    -   **Includes**: Self-RAG (+40%), CRAG, GraphRAG (+76% summarization), multi-hop, iterative retrieval
    -   **Research**: Self-RAG (2023), CRAG (2024), GraphRAG Microsoft (2024), Modular RAG
-   [5.4.4 Context Injection Optimization](./kb/5-rag/5.4.4-context-optimization.md) ✅
    -   **Status**: ✅ Complete - **NEW!** (Dec 2025)
    -   **Includes**: Lost in the Middle mitigation, 50-70% compression, relevance ordering, MMR diversity
    -   **Research**: Stanford Lost in the Middle (2024), LongRAG (2024), RAPTOR (2024)
-   [5.4.5 Evaluation Metrics (Precision, Recall, MRR)](./kb/5-rag/5.4.5-evaluation.md) ✅
    -   **Status**: ✅ Complete - **NEW!** (Dec 2025)
    -   **Includes**: RAGAS framework, NDCG@10 >0.8 target, precision/recall/MRR, continuous monitoring
    -   **Research**: RAGAS (2024), ARAGOG (2024), BEIR benchmark, LLM-as-Judge patterns

---

### Layer 6: Planning & Orchestration

**Goal**: Implement planning patterns for complex multi-step tasks

#### 6.1 Plan-and-Execute (5/5 - ✅ COMPLETE)

-   [6.1.1 Separate Planning from Execution](./6-planning/6.1.1-separation.md) ✅
    -   **Research**: ReWOO (5× token efficiency), Plan-and-Solve (Wang 2023), LLMCompiler (Kim 2024)
-   [6.1.2 Generate Alternative Plans](./6-planning/6.1.2-alternatives.md) ✅
    -   **Research**: LangChain (2024) - 40% reduction in dead ends
-   [6.1.3 Feasibility Scoring](./6-planning/6.1.3-feasibility.md) ✅
    -   Multi-dimension validation (tool/param/resource/permission)
-   [6.1.4 Fallback Strategies](./6-planning/6.1.4-fallbacks.md) ✅
    -   Error-type registry, graceful degradation, human escalation
-   [6.1.5 Implementation Patterns](./6-planning/6.1.5-implementation.md) ✅
    -   AI SDK v6 ToolLoopAgent, Planner-Worker-Solver pattern

#### 6.2 Reflexion (Self-Critique) (5/5 - ✅ COMPLETE)

-   [6.2.1 Generate → Critique → Refine Loop](./6-planning/6.2.1-reflexion-loop.md) ✅
    -   **Research**: Reflexion (Shinn 2023) - +22% AlfWorld, +20% HotPotQA, +11% HumanEval
-   [6.2.2 Quality Scoring](./6-planning/6.2.2-quality-scoring.md) ✅
    -   LLM-as-judge, rubric-based (5-dimension), hybrid scoring
-   [6.2.3 Iteration Limits (2-3 Max)](./6-planning/6.2.3-iteration-limits.md) ✅
    -   Combined stopping criteria, diminishing returns after 3 iterations
-   [6.2.4 Adaptive Reflection (Complexity Heuristic)](./6-planning/6.2.4-adaptive.md) ✅
    -   Task complexity classification (simple/moderate/complex/critical)
-   [6.2.5 Research Findings](./6-planning/6.2.5-research.md) ✅
    -   Self-correction limits (Huang 2024), external feedback essential

#### 6.3 Tree of Thoughts (5/5 - ✅ COMPLETE)

-   [6.3.1 Multi-Path Exploration](./6-planning/6.3.1-multi-path.md) ✅
    -   **Research**: ToT (4%→74% Game of 24), LATS (92.7% HumanEval), Self-Consistency (+17.9%)
-   [6.3.2 Branching Strategies](./6-planning/6.3.2-branching.md) ✅
    -   Fixed K-way, adaptive, constrained branching (K=3-5 optimal)
-   [6.3.3 Pruning (Dead Ends)](./6-planning/6.3.3-pruning.md) ✅
    -   Score-based, depth-limited, beam pruning (60-80% reduction)
-   [6.3.4 Best-First Search](./6-planning/6.3.4-best-first.md) ✅
    -   Priority queue, A\* variant, 50% fewer nodes explored
-   [6.3.5 When to Use (Complex Problems)](./6-planning/6.3.5-when-to-use.md) ✅
    -   Decision framework: 10-50× cost for 70% improvement

#### 6.4 Preflight Validation (5/5 - ✅ COMPLETE)

-   [6.4.1 Check Before Execute](./6-planning/6.4.1-check-before-execute.md) ✅
    -   **Research**: 70-80% failure prevention, Design by Contract, SagaLLM (2024)
-   [6.4.2 Resource Existence](./6-planning/6.4.2-resource-existence.md) ✅
    -   Automatic reference extraction, fuzzy matching, cached checks
-   [6.4.3 Constraint Satisfaction](./6-planning/6.4.3-constraints.md) ✅
    -   Uniqueness, state transitions, relationships, business invariants
-   [6.4.4 Schema Compatibility](./6-planning/6.4.4-schema.md) ✅
    -   Zod validation, transformations, refinements, early return
-   [6.4.5 Validation Issues → Suggestions](./6-planning/6.4.5-suggestions.md) ✅
    -   Fuzzy matching, corrective actions, 60-70% auto-recovery

---

### Layer 7: Error Recovery & Resilience

**Goal**: Build robust agents that handle failures gracefully

**Status**: ✅ Complete (4/4 topics - Restructured Jan 2026)

_Error Classification (1/1 - ✅ COMPLETE)_:

-   [7.1 Error Classification & Taxonomy](./7-errors/7.1-error-classification.md) ✅
    -   Five-Module Taxonomy (Memory/Reflection/Planning/Action/System), Three-Source Model, MAST for multi-agent
    -   **Research**: AgentDebug (2024) - 24% higher accuracy, 87% root cause detection

_Recovery Strategies (1/1 - ✅ COMPLETE)_:

-   [7.2 Recovery Strategy Selection](./7-errors/7.2-recovery-strategies.md) ✅
    -   Retry vs. Fallback vs. Skip vs. Escalate decision tree, exponential backoff with jitter, recovery budgets
    -   **Research**: 90% failure reduction with proper retry logic, Saga pattern for compensation

_Resilience Patterns (1/1 - ✅ COMPLETE)_:

-   [7.3 Resilience Patterns](./7-errors/7.3-resilience-patterns.md) ✅
    -   Circuit breakers (Closed/Open/Half-Open), bulkheads, timeouts, per-tool isolation
    -   **Research**: Release It! (Nygard), 80% cascade prevention with circuit breakers

_Tool Validation (1/1 - ✅ COMPLETE)_:

-   [7.4 Tool Validation & Self-Healing](./7-errors/7.4-tool-validation.md) ✅
    -   Post-mutation verification, silent failure detection (drift/cycles/missing), anomaly detection, self-healing loops
    -   **Research**: "Tools Fail" (2024) - 30% accuracy improvement with distrust prompting, 98% anomaly detection

---

### Layer 8: Tool Design Patterns

**Goal**: Design safe, reliable tools with validation and metadata

**Status**: ✅ Complete (4/4 topics - Restructured Jan 2026)

_Tool Definition (1/1 - ✅ COMPLETE)_:

-   [8.1 Tool Definition & Schema](./8-tools/8.1-tool-definition.md) ✅
    -   Zod validation, naming conventions (service_resource_action), description patterns, output standardization
    -   **Research**: Anthropic "Writing Tools" (2024) - 90%+ selection accuracy with clear descriptions

_Context Injection (1/1 - ✅ COMPLETE)_:

-   [8.2 Context Injection](./8-tools/8.2-context-injection.md) ✅
    -   experimental_context, AgentContext interface, dependency injection, service container, testability
    -   **Research**: AI SDK v6 patterns, Anthropic Context Engineering (2024)

_Tool Registry (1/1 - ✅ COMPLETE)_:

-   [8.3 Tool Registry & Discovery](./8-tools/8.3-tool-registry.md) ✅
    -   Centralized catalog, metadata enrichment, semantic discovery, hierarchical selection
    -   **Research**: LangGraph Many Tools (2024) - 56% Recall@5 improvement with vector retrieval

_Tool Security (1/1 - ✅ COMPLETE)_:

-   [8.4 Tool Security & Safety](./8-tools/8.4-tool-security.md) ✅
    -   Risk classification (low/medium/high/critical), approval gates, egress control, RBAC, audit logging
    -   **Research**: OWASP Agentic AI Top 10 (2025), AWS Security Framework

---

### Layer 9: Human-in-the-Loop

**Goal**: Implement approval gates and feedback loops for safety

#### 9.1 Approval Gates (HITL)

-   [9.1.1 When: Destructive Operations, High-Risk Actions](./kb/9-hitl/9.1.1-when.md) ⏳
-   [9.1.2 How: needsApproval Flag on Tools](./kb/9-hitl/9.1.2-how.md) ⏳
    -   **Codebase Example**: `server/tools/all-tools.ts` (cms_deletePage)
-   [9.1.3 Flow: Pause → Show Modal → User Decides → Resume](./kb/9-hitl/9.1.3-flow.md) ⏳
-   [9.1.4 AI SDK v6 Streaming Pattern](./kb/9-hitl/9.1.4-streaming.md) ⏳
    -   **Codebase Example**: `server/agent/orchestrator.ts` (streamAgentWithApproval)
-   [9.1.5 Approval Queue (Promise-Based)](./kb/9-hitl/9.1.5-queue.md) ⏳
    -   **Codebase Example**: `server/services/approval-queue.ts`

#### 9.2 Feedback Loops

-   [9.2.1 User Corrections](./kb/9-hitl/9.2.1-corrections.md) ⏳
-   [9.2.2 Thumbs Up/Down](./kb/9-hitl/9.2.2-thumbs.md) ⏳
-   [9.2.3 Regeneration](./kb/9-hitl/9.2.3-regeneration.md) ⏳
-   [9.2.4 Fine-Tuning from Feedback](./kb/9-hitl/9.2.4-finetuning.md) ⏳
-   [9.2.5 RLHF Patterns](./kb/9-hitl/9.2.5-rlhf.md) ⏳

#### 9.3 Adaptive Autonomy

-   [9.3.1 Modes: Off, On-Request, Proactive](./kb/9-hitl/9.3.1-modes.md) ⏳
-   [9.3.2 When to Suggest Improvements](./kb/9-hitl/9.3.2-suggestions.md) ⏳
-   [9.3.3 Proactivity Tuning (Avoid Annoyance)](./kb/9-hitl/9.3.3-tuning.md) ⏳
-   [9.3.4 User Control](./kb/9-hitl/9.3.4-control.md) ⏳
-   [9.3.5 Context-Aware Suggestions](./kb/9-hitl/9.3.5-context-aware.md) ⏳

---

### Layer 10: Multi-Agent Systems

**Goal**: Coordinate multiple specialized agents

#### 10.1 Orchestrator Pattern

-   [10.1.1 Master Agent Delegates to Specialists](./kb/10-multi-agent/10.1.1-delegation.md) ⏳
-   [10.1.2 Intent Classification](./kb/10-multi-agent/10.1.2-intent.md) ⏳
-   [10.1.3 Context Transfer Between Agents](./kb/10-multi-agent/10.1.3-context-transfer.md) ⏳
-   [10.1.4 Response Assembly](./kb/10-multi-agent/10.1.4-assembly.md) ⏳
-   [10.1.5 When to Use (>3 Distinct Responsibilities)](./kb/10-multi-agent/10.1.5-when.md) ⏳

#### 10.2 Specialized Sub-Agents

-   [10.2.1 Architect Agent (Planning, Read-Only)](./kb/10-multi-agent/10.2.1-architect.md) ⏳
-   [10.2.2 CRUD Agent (Execution, All Tools)](./kb/10-multi-agent/10.2.2-crud.md) ⏳
-   [10.2.3 Debug Agent (Error Correction, Limited Writes)](./kb/10-multi-agent/10.2.3-debug.md) ⏳
-   [10.2.4 Ask Agent (Inspection, Read-Only)](./kb/10-multi-agent/10.2.4-ask.md) ⏳
-   [10.2.5 Sub-Agent Configuration](./kb/10-multi-agent/10.2.5-config.md) ⏳

#### 10.3 Agent Communication

-   [10.3.1 Message Passing](./kb/10-multi-agent/10.3.1-message-passing.md) ⏳
-   [10.3.2 Shared Context](./kb/10-multi-agent/10.3.2-shared-context.md) ⏳
-   [10.3.3 Event-Driven Triggers](./kb/10-multi-agent/10.3.3-events.md) ⏳
-   [10.3.4 State Synchronization](./kb/10-multi-agent/10.3.4-sync.md) ⏳
-   [10.3.5 Conflict Resolution](./kb/10-multi-agent/10.3.5-conflicts.md) ⏳

#### 10.4 Coordination Strategies

-   [10.4.1 Sequential (A → B → C)](./kb/10-multi-agent/10.4.1-sequential.md) ⏳
-   [10.4.2 Parallel (All Agents Simultaneously)](./kb/10-multi-agent/10.4.2-parallel.md) ⏳
-   [10.4.3 Hierarchical (Tree Structure)](./kb/10-multi-agent/10.4.3-hierarchical.md) ⏳
-   [10.4.4 Peer-to-Peer (Agents Negotiate)](./kb/10-multi-agent/10.4.4-p2p.md) ⏳
-   [10.4.5 LangGraph Workflows](./kb/10-multi-agent/10.4.5-langgraph.md) ⏳

---

### Layer 11: Production Engineering

**Goal**: Deploy, monitor, and optimize agents in production

#### 11.1 Logging & Observability

-   [11.1.1 Structured Logging (JSON)](./kb/11-production/11.1.1-structured-logging.md) ⏳
-   [11.1.2 Log Levels (Debug, Info, Warn, Error)](./kb/11-production/11.1.2-log-levels.md) ⏳
-   [11.1.3 Trace IDs (Track Requests)](./kb/11-production/11.1.3-trace-ids.md) ⏳
    -   **Codebase Example**: `server/agent/orchestrator.ts` (traceId)
-   [11.1.4 Step IDs (Track Agent Steps)](./kb/11-production/11.1.4-step-ids.md) ⏳
-   [11.1.5 Log Aggregation (Datadog, Splunk)](./kb/11-production/11.1.5-aggregation.md) ⏳

#### 11.2 Monitoring & Metrics

-   [11.2.1 Token Usage (Input, Output, Total)](./kb/11-production/11.2.1-token-usage.md) ⏳
-   [11.2.2 Latency (p50, p95, p99)](./kb/11-production/11.2.2-latency.md) ⏳
-   [11.2.3 Cost per Request](./kb/11-production/11.2.3-cost.md) ⏳
-   [11.2.4 Success Rate](./kb/11-production/11.2.4-success-rate.md) ⏳
-   [11.2.5 Tool Call Distribution & Circuit Breaker Status](./kb/11-production/11.2.5-distribution.md) ⏳

#### 11.3 Debugging Techniques

-   [11.3.1 Debug Panel (Real-Time Logs)](./kb/11-production/11.3.1-debug-pane.md) ⏳
    -   **Codebase Example**: `app/assistant/_components/enhanced-debug/`
-   [11.3.2 Replay from Checkpoint](./kb/11-production/11.3.2-replay.md) ⏳
-   [11.3.3 Step-by-Step Execution](./kb/11-production/11.3.3-step-by-step.md) ⏳
-   [11.3.4 LLM Call Inspection (Prompts, Responses)](./kb/11-production/11.3.4-llm-inspection.md) ⏳
-   [11.3.5 State Visualization (State Machine)](./kb/11-production/11.3.5-state-viz.md) ⏳

#### 11.4 Cost Optimization

-   [11.4.1 Token Reduction (Compression, Caching)](./kb/11-production/11.4.1-token-reduction.md) ⏳
-   [11.4.2 Model Selection (GPT-4 vs 3.5 vs Flash)](./kb/11-production/11.4.2-model-selection.md) ⏳
-   [11.4.3 Lazy Loading (Hybrid Fetching)](./kb/11-production/11.4.3-lazy-loading.md) ⏳
    -   **Codebase Example**: Sprint 15 (Hybrid Content Fetching)
-   [11.4.4 KV-Cache Optimization (60% Savings)](./kb/11-production/11.4.4-kv-cache.md) ⏳
-   [11.4.5 Rate Limiting & Budget Alerts](./kb/11-production/11.4.5-rate-limiting.md) ⏳

#### 11.5 Performance Tuning

-   [11.5.1 Concurrent Tool Execution](./kb/11-production/11.5.1-concurrent.md) ⏳
-   [11.5.2 Streaming vs Batch](./kb/11-production/11.5.2-streaming.md) ⏳
-   [11.5.3 Prompt Size Reduction](./kb/11-production/11.5.3-prompt-size.md) ⏳
-   [11.5.4 Tool Execution Time Profiling](./kb/11-production/11.5.4-profiling.md) ⏳
-   [11.5.5 Database Query Optimization](./kb/11-production/11.5.5-db-optimization.md) ⏳

---

### Layer 12: Cutting-Edge Patterns

**Goal**: Explore advanced and experimental techniques

#### 12.1 Self-Improving Agents

-   [12.1.1 Learning from Mistakes](./kb/12-advanced/12.1.1-learning.md) ⏳
-   [12.1.2 Tool Usage Optimization](./kb/12-advanced/12.1.2-tool-optimization.md) ⏳
-   [12.1.3 Prompt Evolution](./kb/12-advanced/12.1.3-prompt-evolution.md) ⏳
-   [12.1.4 Memory Management Tuning](./kb/12-advanced/12.1.4-memory-tuning.md) ⏳
-   [12.1.5 Meta-Learning](./kb/12-advanced/12.1.5-meta-learning.md) ⏳

#### 12.2 Code Generation Agents

-   [12.2.1 Cursor, v0, Claude Artifacts](./kb/12-advanced/12.2.1-platforms.md) ⏳
-   [12.2.2 Code → Test → Fix Loop](./kb/12-advanced/12.2.2-code-loop.md) ⏳
-   [12.2.3 Incremental Code Writing](./kb/12-advanced/12.2.3-incremental.md) ⏳
-   [12.2.4 Multi-File Editing](./kb/12-advanced/12.2.4-multi-file.md) ⏳
-   [12.2.5 Safety Patterns (Sandboxing)](./kb/12-advanced/12.2.5-safety.md) ⏳

#### 12.3 Agentic Workflows (LangGraph)

-   [12.3.1 Graph-Based Orchestration](./kb/12-advanced/12.3.1-graph.md) ⏳
-   [12.3.2 Conditional Edges](./kb/12-advanced/12.3.2-conditional.md) ⏳
-   [12.3.3 Subgraphs](./kb/12-advanced/12.3.3-subgraphs.md) ⏳
-   [12.3.4 Human-in-the-Loop Nodes](./kb/12-advanced/12.3.4-hitl-nodes.md) ⏳
-   [12.3.5 State Persistence](./kb/12-advanced/12.3.5-persistence.md) ⏳

#### 12.4 Multi-Modal Agents

-   [12.4.1 Vision + Language (GPT-4V, Gemini)](./kb/12-advanced/12.4.1-vision.md) ⏳
-   [12.4.2 Audio Input (Whisper)](./kb/12-advanced/12.4.2-audio.md) ⏳
-   [12.4.3 Image Generation (DALL-E)](./kb/12-advanced/12.4.3-image-gen.md) ⏳
-   [12.4.4 Document Understanding (PDFs)](./kb/12-advanced/12.4.4-documents.md) ⏳
-   [12.4.5 Unified Multi-Modal Tools](./kb/12-advanced/12.4.5-unified.md) ⏳

---

## Related Documentation

### Existing Codebase Documentation

-   [AGENTIC_PATTERNS_LIBRARY.md](./AGENTIC_PATTERNS_LIBRARY.md) - 17 production patterns with research citations
-   [DELETION_FLOW_ANALYSIS.md](./DELETION_FLOW_ANALYSIS.md) - Error recovery analysis and HITL patterns
-   [PROGRESS.md](./PROGRESS.md) - Implementation sprints and architecture decisions
-   [IMPLEMENTATION_SPRINTS.md](./IMPLEMENTATION_SPRINTS.md) - Step-by-step build guide
-   [NATIVE_AI_SDK_REFACTOR_PLAN.md](./NATIVE_AI_SDK_REFACTOR_PLAN.md) - AI SDK v6 native patterns

### Research Papers Referenced

-   HiAgent (2024) - Hierarchical Working Memory Management
-   AgentFlow (Stanford 2024) - In-the-Flow Agentic System Optimization
-   Reflexion (Shinn et al. 2023) - Language Agents with Verbal Reinforcement Learning
-   ReAct (Yao et al. 2023) - Synergizing Reasoning and Acting in Language Models
-   Mem0, A-MEM, AWS AgentCore - Working Memory Patterns
-   Anthropic, Manus.im, SuperAGI - Context Engineering & Error Recovery

### External Resources

-   [AI SDK v6 Documentation](https://sdk.vercel.ai/)
-   [LangChain Documentation](https://langchain.com/)
-   [LangGraph](https://langchain-ai.github.io/langgraph/)
-   [OpenRouter Models](https://openrouter.ai/)

---

## Contributing

To add new topics:

1. Research thoroughly (academic papers + production systems)
2. Create topic file in appropriate layer folder (`docs/kb/N-layer/`)
3. Include: Problem, Solution, Benefits, Trade-offs, When to Use, Code Examples, Research Citations
4. Update this TOC with link and mark as ✅
5. Cross-reference with existing codebase patterns

---

## Changelog

**2025-11-16**: Knowledge base scaffolding created (Option 3: Layer-Based Architecture)

---

**Next Steps**:

1. Create `docs/kb/` directory structure (0-foundations/, 1-prompts/, etc.)
2. Start writing Layer 0 topics (LLM Fundamentals)
3. Progressively fill in layers with deep research
4. Link codebase examples throughout
5. Update progress tracker as topics complete

**Estimated Completion**: 60-80 hours for all 72 topics
