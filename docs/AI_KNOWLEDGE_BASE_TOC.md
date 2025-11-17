# AI Engineering Knowledge Base - Table of Contents

**Purpose**: Comprehensive educational reference for building production-grade AI agents  
**Organization**: 12 layers (Foundation → Advanced) with 72 topics total  
**Grounding**: Research papers, production systems, proven implementations from this codebase

**Last Updated**: 2025-11-16  
**Status**: 🚧 In Progress

---

## Quick Navigation

-   [How to Use This Knowledge Base](#how-to-use-this-knowledge-base)
-   [Learning Paths](#learning-paths)
-   [Progress Tracker](#progress-tracker)
-   [Layer Index](#layer-index)
-   [Related Documentation](#related-documentation)

---

## How to Use This Knowledge Base

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

**Completion**: 40/72 topics (56%)

| Layer                                | Topics | Status         | Completion   |
| ------------------------------------ | ------ | -------------- | ------------ |
| Layer 0: Foundations                 | 3      | ✅ Complete    | 13/13 (100%) |
| Layer 1: Prompt Engineering          | 3      | ✅ Complete    | 14/14 (100%) |
| Layer 2: Context Engineering         | 3      | ✅ Complete    | 12/12 (100%) |
| Layer 3: Agent Architecture          | 4      | 🚧 In Progress | 2/20 (10%)   |
| Layer 4: Memory & State              | 4      | ⏳ Pending     | 0/20         |
| Layer 5: Retrieval & RAG             | 4      | ⏳ Pending     | 0/20         |
| Layer 6: Planning & Orchestration    | 4      | ⏳ Pending     | 0/20         |
| Layer 7: Error Recovery & Resilience | 5      | ⏳ Pending     | 0/20         |
| Layer 8: Tool Design Patterns        | 4      | ⏳ Pending     | 0/20         |
| Layer 9: Human-in-the-Loop           | 3      | ⏳ Pending     | 0/15         |
| Layer 10: Multi-Agent Systems        | 4      | ⏳ Pending     | 0/20         |
| Layer 11: Production Engineering     | 5      | ⏳ Pending     | 0/25         |
| Layer 12: Cutting-Edge Patterns      | 4      | ⏳ Pending     | 0/20         |

**Latest Updates** (2025-11-17):

**Layer 3: Agent Architecture** (2/20 topics - 🚧 10% COMPLETE):

_Core Patterns_ (2/5):
- ✅ 3.1.1 ReAct Pattern - Analysis of your `server/prompts/react.xml`, Think→Act→Observe loop, 2024-2025 research (ReSpAct, A3T, Plan-and-Execute), 5 enhancement recommendations
- ✅ 3.1.2 Tool Design Patterns - **NEW!** Deep analysis of your `server/tools/all-tools.ts` (20+ CMS tools), schema design, parameter validation, error handling, HITL confirmations, granular fetching (40-96% savings), 4-phase enhancement roadmap

**Layer 2: Context Engineering** (12/12 topics - ✅ 100% COMPLETE):

_Token Optimization_ (4/4 - ✅ COMPLETE):
- ✅ 2.1.1 Compression Techniques - LongLLMLingua, LLMLingua-2, 60-90% reduction maintaining 95%+ accuracy
- ✅ 2.1.2 Importance Scoring - RankRAG (+18% accuracy), 5 scoring strategies, production integration
- ✅ 2.1.3 Lazy Loading - Your `cms_getPage(fetchMode)` validated, 90%+ token reduction
- ✅ 2.1.4 Hybrid Content Fetching - Deep analysis of your CMS pattern, three-tier enhancement

_Context Management Patterns_ (4/4 - ✅ COMPLETE):
- ✅ 2.2.1 Sliding Window - StreamingLLM (22.2× speedup), attention sinks, 4M token capability
- ✅ 2.2.2 Hierarchical Memory - HiAgent (2× success rate), 10:1 compression, ACL 2025
- ✅ 2.2.3 Context Pruning - LazyLLM, TokenSelect (23.84× speedup), AgentDiet (39.9-59.7% reduction)
- ✅ 2.2.4 KV-Cache Optimization - RocketKV (400× compression), FastKV, EpiCache, production frameworks

_Injection Strategies_ (3/4 - 🚧 IN PROGRESS):
- ✅ 2.3.1 Injection Location - ACE framework (+10.6%), RAT (+13-43%), system/user/assistant placement
- ✅ 2.3.2 Injection Timing - "When to Retrieve" (95%+ accuracy), DeepRAG (+26.4%), 30-50% cost reduction
- ✅ 2.3.3 Injection Format - **NEW!** XML/JSON/Markdown comparison, 15-40% performance impact, RAG formatting strategies
- ✅ 2.3.4 Working Memory Pattern - **NEW!** Analysis of your `server/services/working-memory/` implementation, enhancement recommendations

**Layer 1: Prompt Engineering** (14/14 topics - ✅ COMPLETE):

_Basic Techniques_ (5/5):

-   ✅ 1.1.1 Instruction Design - CLEAR framework, principles, templates
-   ✅ 1.1.2 Few-Shot Learning - Example selection, ordering, RAG integration
-   ✅ 1.1.3 Chain-of-Thought - CoT variants, ReAct connection, self-consistency
-   ✅ 1.1.4 Zero-Shot CoT - Magic phrases, Plan-and-Solve, Chain of Draft
-   ✅ 1.1.5 Self-Consistency - Voting mechanisms, weighted voting, USC

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
-   [0.1.4 Temperature, Top-P, and Sampling](./kb/0-foundations/0.1.4-sampling-parameters.md) ✅
    -   **Status**: Complete - Master guide to controlling LLM output
    -   **Length**: 650+ lines with API examples, debugging tips
    -   **Includes**: Temperature, top-p, top-k, greedy decoding, penalties, agent configuration
-   [0.1.5 Model Selection Guide](./kb/0-foundations/0.1.5-model-selection.md) ✅
    -   **Status**: Complete - Comprehensive model comparison and decision frameworks
    -   **Length**: 1100+ lines with benchmarks, pricing, practical recommendations
    -   **Includes**: GPT-4/Claude/Gemini/Llama comparison, cost-performance analysis, your GPT-4o-mini validation, decision matrices

#### 0.2 Thinking vs Non-Thinking Models

-   [0.2.1 Standard Models vs Thinking Models](./kb/0-foundations/0.2.1-standard-models.md) ✅
    -   **Status**: Complete - Comprehensive comparison of standard vs reasoning models
    -   **Length**: 600+ lines with benchmarks, cost analysis, use case recommendations
    -   **Includes**: o1 architecture, chain-of-thought comparison, practical examples
-   [0.2.2 Reasoning Models Deep Dive](./kb/0-foundations/0.2.2-reasoning-models.md) ⏳
-   [0.2.3 When to Use Which](./kb/0-foundations/0.2.3-model-comparison.md) ⏳
-   [0.2.4 Trade-offs (Cost, Latency, Capabilities)](./kb/0-foundations/0.2.4-tradeoffs.md) ⏳

#### 0.3 Tokens, Embeddings, and Vector Spaces

-   [0.3.1 Tokenization (BPE, WordPiece, SentencePiece)](./kb/0-foundations/0.3.1-tokenization.md) ✅
    -   **Status**: Complete - Comprehensive guide to subword tokenization algorithms
    -   **Length**: 750+ lines with algorithm comparisons, real-world examples
    -   **Includes**: BPE (GPT), WordPiece (BERT), SentencePiece (T5), cost optimization, codebase integration
-   [0.3.2 Embedding Models & Vector Spaces](./kb/0-foundations/0.3.2-embedding-models.md) ✅
    -   **Status**: Complete - Deep dive into semantic embeddings for search and RAG
    -   **Length**: 700+ lines with model comparisons, implementation examples
    -   **Includes**: OpenAI text-embedding-3, SBERT, BGE, vector search in your codebase (LanceDB)
-   [0.3.3 Vector Similarity Metrics](./kb/0-foundations/0.3.3-vector-similarity.md) ✅
    -   **Status**: Complete - Comprehensive guide to measuring embedding similarity
    -   **Length**: 900+ lines with formulas, visualizations, implementations
    -   **Includes**: Cosine similarity, dot product, Euclidean, Manhattan, normalization, LanceDB integration
-   [0.3.4 Dimensionality Trade-offs](./kb/0-foundations/0.3.4-dimensionality.md) ✅
    -   **Status**: Complete - Deep dive into embedding dimensions and optimization
    -   **Length**: 1000+ lines with comparisons, benchmarks, reduction techniques
    -   **Includes**: 384/768/1536/3072 dims comparison, curse of dimensionality, PCA, UMAP, OpenAI flexible dimensions

---

### Layer 1: Prompt Engineering

**Goal**: Master prompting techniques from single-shot to chain-of-thought

#### 1.1 Basic Prompting Techniques

-   [1.1.1 Single-Shot Prompting](./kb/1-prompts/1.1.1-single-shot.md) ⏳
-   [1.1.2 Few-Shot Learning](./kb/1-prompts/1.1.2-few-shot.md) ⏳
-   [1.1.3 Chain-of-Thought (CoT)](./kb/1-prompts/1.1.3-chain-of-thought.md) ⏳
-   [1.1.4 Zero-Shot CoT](./kb/1-prompts/1.1.4-zero-shot-cot.md) ⏳
-   [1.1.5 Self-Consistency](./kb/1-prompts/1.1.5-self-consistency.md) ⏳

#### 1.2 System Prompts & Instructions

-   [1.2.1 Role Definition (Identity)](./kb/1-prompts/1.2.1-role-definition.md) ⏳
-   [1.2.2 Capabilities Declaration](./kb/1-prompts/1.2.2-capabilities.md) ⏳
-   [1.2.3 Rules & Constraints](./kb/1-prompts/1.2.3-rules-constraints.md) ⏳
-   [1.2.4 Output Format Specification](./kb/1-prompts/1.2.4-output-format.md) ⏳
-   [1.2.5 Modular Prompt Architecture](./kb/1-prompts/1.2.5-modular-architecture.md) ⏳
    -   **Codebase Example**: `server/prompts/react.xml`

#### 1.3 Prompt Templates & Variables

-   [1.3.1 Template Engines (Handlebars, Mustache)](./kb/1-prompts/1.3.1-template-engines.md) ⏳
-   [1.3.2 Variable Injection](./kb/1-prompts/1.3.2-variable-injection.md) ⏳
-   [1.3.3 Conditional Sections](./kb/1-prompts/1.3.3-conditional-sections.md) ⏳
-   [1.3.4 Prompt Versioning & Caching](./kb/1-prompts/1.3.4-versioning-caching.md) ⏳

---

### Layer 2: Context Engineering

**Goal**: Optimize token usage and manage context effectively

#### 2.1 Token Optimization

-   [2.1.1 Compression Techniques (Summarization)](./kb/2-context/2.1.1-compression.md) ⏳
-   [2.1.2 Importance Scoring](./kb/2-context/2.1.2-importance-scoring.md) ⏳
-   [2.1.3 Lazy Loading (Fetch on Demand)](./kb/2-context/2.1.3-lazy-loading.md) ⏳
-   [2.1.4 Hybrid Content Fetching](./kb/2-context/2.1.4-hybrid-fetching.md) ⏳
    -   **Codebase Example**: `server/tools/all-tools.ts` (cms_getPage with includeContent flag)

#### 2.2 Context Management Patterns

-   [2.2.1 Sliding Window (Fixed Size)](./kb/2-context/2.2.1-sliding-window.md) ⏳
-   [2.2.2 Hierarchical Memory (Subgoal-Based)](./kb/2-context/2.2.2-hierarchical-memory.md) ⏳
    -   **Research**: HiAgent (2024)
-   [2.2.3 Context Pruning (Remove Low-Value)](./kb/2-context/2.2.3-context-pruning.md) ⏳
-   [2.2.4 KV-Cache Optimization](./kb/2-context/2.2.4-kv-cache.md) ⏳
    -   **Research**: Manus.im (2024)

#### 2.3 Context Injection Strategies

-   [2.3.1 Where to Inject (System, User, Assistant)](./kb/2-context/2.3.1-injection-location.md) ⏳
-   [2.3.2 Timing (Always vs Conditional)](./kb/2-context/2.3.2-injection-timing.md) ⏳
-   [2.3.3 Format (Structured vs Narrative)](./kb/2-context/2.3.3-injection-format.md) ⏳
-   [2.3.4 Working Memory Pattern](./kb/2-context/2.3.4-working-memory.md) ⏳
    -   **Codebase Example**: `server/services/working-memory/`

---

### Layer 3: Agent Architecture

**Goal**: Build autonomous agents using ReAct pattern with tool calling

#### 3.1 What is an AI Agent?

-   [3.1.1 Definition & Components](./kb/3-agents/3.1.1-agent-definition.md) ⏳
-   [3.1.2 Agent Types (Reflexive, Goal-Based, Utility-Based)](./kb/3-agents/3.1.2-agent-types.md) ⏳
-   [3.1.3 When to Use Agents vs Single LLM Calls](./kb/3-agents/3.1.3-when-agents.md) ⏳

#### 3.2 ReAct Pattern (Reasoning + Acting)

-   [3.2.1 Core Loop: Think → Act → Observe → Repeat](./kb/3-agents/3.2.1-react-loop.md) ⏳
    -   **Codebase Example**: `server/prompts/react.xml`
-   [3.2.2 Reasoning Phase (Plan Next Step)](./kb/3-agents/3.2.2-reasoning-phase.md) ⏳
-   [3.2.3 Acting Phase (Execute Tool)](./kb/3-agents/3.2.3-acting-phase.md) ⏳
-   [3.2.4 Observation Phase (Interpret Result)](./kb/3-agents/3.2.4-observation-phase.md) ⏳
-   [3.2.5 Implementation with AI SDK v6](./kb/3-agents/3.2.5-ai-sdk-implementation.md) ⏳
    -   **Codebase Example**: `server/agent/orchestrator.ts`

#### 3.3 Tool Calling & Execution

-   [3.3.1 Tool Definition (Zod Schemas, Descriptions)](./kb/3-agents/3.3.1-tool-definition.md) ⏳
-   [3.3.2 Tool Registry & Metadata](./kb/3-agents/3.3.2-tool-registry.md) ⏳
    -   **Codebase Example**: `server/tools/all-tools.ts` (TOOL_METADATA)
-   [3.3.3 Context Injection (experimental_context)](./kb/3-agents/3.3.3-context-injection.md) ⏳
-   [3.3.4 Result Validation](./kb/3-agents/3.3.4-result-validation.md) ⏳
-   [3.3.5 Tool Composition Patterns](./kb/3-agents/3.3.5-composition.md) ⏳

#### 3.4 Loop Control & Convergence

-   [3.4.1 Max Steps Limits](./kb/3-agents/3.4.1-max-steps.md) ⏳
-   [3.4.2 Convergence Detection](./kb/3-agents/3.4.2-convergence.md) ⏳
    -   **Research**: AgentFlow (Stanford 2024)
-   [3.4.3 Stuck Detection](./kb/3-agents/3.4.3-stuck-detection.md) ⏳
-   [3.4.4 Loop State Machine](./kb/3-agents/3.4.4-state-machine.md) ⏳
-   [3.4.5 Early Exit Strategies](./kb/3-agents/3.4.5-early-exit.md) ⏳

---

### Layer 4: Memory & State

**Goal**: Implement memory systems for context retention and state persistence

#### 4.1 Working Memory (Short-Term)

-   [4.1.1 Working Memory Concept (RAM Analogy)](./kb/4-memory/4.1.1-working-memory-concept.md) ⏳
-   [4.1.2 Entity Extraction from Tool Results](./kb/4-memory/4.1.2-entity-extraction.md) ⏳
    -   **Codebase Example**: `server/services/working-memory/entity-extractor.ts`
-   [4.1.3 Sliding Window (Recent N Entities)](./kb/4-memory/4.1.3-sliding-window.md) ⏳
-   [4.1.4 Reference Resolution ("this page", "that entry")](./kb/4-memory/4.1.4-reference-resolution.md) ⏳
-   [4.1.5 Implementation: Universal Working Memory](./kb/4-memory/4.1.5-universal-implementation.md) ⏳
    -   **Research**: Mem0, A-MEM, AWS AgentCore

#### 4.2 Subgoal Memory (Medium-Term)

-   [4.2.1 HiAgent Hierarchical Memory](./kb/4-memory/4.2.1-hiagent.md) ⏳
    -   **Research**: HiAgent (2024) - 2x success rate, 3.8 fewer steps
-   [4.2.2 Compression Triggers (80% Context Capacity)](./kb/4-memory/4.2.2-compression-triggers.md) ⏳
-   [4.2.3 Subgoal Detection Patterns](./kb/4-memory/4.2.3-subgoal-detection.md) ⏳
-   [4.2.4 Summarization Strategies](./kb/4-memory/4.2.4-summarization.md) ⏳
-   [4.2.5 10:1 Compression Ratios](./kb/4-memory/4.2.5-compression-ratios.md) ⏳

#### 4.3 Long-Term Memory (Persistent)

-   [4.3.1 Vector Databases (LanceDB, Pinecone, Weaviate)](./kb/4-memory/4.3.1-vector-databases.md) ⏳
    -   **Codebase Example**: `server/services/vector-index.ts`
-   [4.3.2 Semantic Search](./kb/4-memory/4.3.2-semantic-search.md) ⏳
-   [4.3.3 Fact Extraction & Storage](./kb/4-memory/4.3.3-fact-extraction.md) ⏳
-   [4.3.4 Cross-Session Retrieval](./kb/4-memory/4.3.4-cross-session.md) ⏳
-   [4.3.5 When to Use vs Working Memory](./kb/4-memory/4.3.5-when-to-use.md) ⏳

#### 4.4 State Persistence & Checkpointing

-   [4.4.1 Why: Crash Recovery, Resume Conversations](./kb/4-memory/4.4.1-why-checkpoint.md) ⏳
-   [4.4.2 What to Save (Messages, Phase, Subgoals, Memory)](./kb/4-memory/4.4.2-what-to-save.md) ⏳
-   [4.4.3 When to Checkpoint (Every 3 Steps, Phase Transitions, Errors)](./kb/4-memory/4.4.3-when-to-checkpoint.md) ⏳
    -   **Codebase Example**: `server/agent/orchestrator.ts` (prepareStep)
-   [4.4.4 How to Resume (Load Checkpoint, Continue Execution)](./kb/4-memory/4.4.4-how-to-resume.md) ⏳
-   [4.4.5 Implementation: JSON Serialization, DB Storage](./kb/4-memory/4.4.5-implementation.md) ⏳

---

### Layer 5: Retrieval & RAG

**Goal**: Build retrieval-augmented generation systems with vector search

#### 5.1 Vector Search Fundamentals

-   [5.1.1 Embedding Documents](./kb/5-rag/5.1.1-embedding-documents.md) ⏳
-   [5.1.2 Similarity Metrics (Cosine, Dot Product, Euclidean)](./kb/5-rag/5.1.2-similarity-metrics.md) ⏳
-   [5.1.3 Index Types (Flat, IVF, HNSW)](./kb/5-rag/5.1.3-index-types.md) ⏳
-   [5.1.4 Query Strategies](./kb/5-rag/5.1.4-query-strategies.md) ⏳
-   [5.1.5 Top-K Selection](./kb/5-rag/5.1.5-top-k-selection.md) ⏳

#### 5.2 Chunking Strategies

-   [5.2.1 Fixed-Size Chunks (512 Tokens)](./kb/5-rag/5.2.1-fixed-size.md) ⏳
-   [5.2.2 Semantic Chunks (Paragraph, Section)](./kb/5-rag/5.2.2-semantic-chunks.md) ⏳
-   [5.2.3 Overlapping Windows](./kb/5-rag/5.2.3-overlapping-windows.md) ⏳
-   [5.2.4 Metadata Enrichment](./kb/5-rag/5.2.4-metadata.md) ⏳
-   [5.2.5 Chunk Size Trade-offs](./kb/5-rag/5.2.5-tradeoffs.md) ⏳

#### 5.3 Hybrid Search

-   [5.3.1 Vector Search (Semantic)](./kb/5-rag/5.3.1-vector-search.md) ⏳
-   [5.3.2 Fuzzy Search (Typo Tolerance)](./kb/5-rag/5.3.2-fuzzy-search.md) ⏳
    -   **Codebase Example**: `server/tools/all-tools.ts` (cms_findResource)
-   [5.3.3 BM25 (Keyword)](./kb/5-rag/5.3.3-bm25.md) ⏳
-   [5.3.4 Reranking (Cross-Encoder)](./kb/5-rag/5.3.4-reranking.md) ⏳
-   [5.3.5 Fusion Strategies (Weighted, RRF)](./kb/5-rag/5.3.5-fusion.md) ⏳

#### 5.4 RAG Patterns

-   [5.4.1 Naive RAG (Retrieve → Inject → Generate)](./kb/5-rag/5.4.1-naive-rag.md) ⏳
-   [5.4.2 Advanced RAG (Query Rewriting, HyDE)](./kb/5-rag/5.4.2-advanced-rag.md) ⏳
-   [5.4.3 Agentic RAG (Iterative Retrieval, Self-Reflection)](./kb/5-rag/5.4.3-agentic-rag.md) ⏳
-   [5.4.4 Context Injection Optimization](./kb/5-rag/5.4.4-context-optimization.md) ⏳
-   [5.4.5 Evaluation Metrics (Precision, Recall, MRR)](./kb/5-rag/5.4.5-evaluation.md) ⏳

---

### Layer 6: Planning & Orchestration

**Goal**: Implement planning patterns for complex multi-step tasks

#### 6.1 Plan-and-Execute

-   [6.1.1 Separate Planning from Execution](./kb/6-planning/6.1.1-separation.md) ⏳
-   [6.1.2 Generate Alternative Plans](./kb/6-planning/6.1.2-alternatives.md) ⏳
    -   **Research**: LangChain (2024) - 40% reduction in dead ends
-   [6.1.3 Feasibility Scoring](./kb/6-planning/6.1.3-feasibility.md) ⏳
-   [6.1.4 Fallback Strategies](./kb/6-planning/6.1.4-fallbacks.md) ⏳
-   [6.1.5 Implementation Patterns](./kb/6-planning/6.1.5-implementation.md) ⏳

#### 6.2 Reflexion (Self-Critique)

-   [6.2.1 Generate → Critique → Refine Loop](./kb/6-planning/6.2.1-reflexion-loop.md) ⏳
    -   **Research**: Reflexion (Shinn et al. 2023) - 20% accuracy improvement
-   [6.2.2 Quality Scoring](./kb/6-planning/6.2.2-quality-scoring.md) ⏳
-   [6.2.3 Iteration Limits (2-3 Max)](./kb/6-planning/6.2.3-iteration-limits.md) ⏳
-   [6.2.4 Adaptive Reflection (Complexity Heuristic)](./kb/6-planning/6.2.4-adaptive.md) ⏳
-   [6.2.5 Research Findings](./kb/6-planning/6.2.5-research.md) ⏳

#### 6.3 Tree of Thoughts

-   [6.3.1 Multi-Path Exploration](./kb/6-planning/6.3.1-multi-path.md) ⏳
-   [6.3.2 Branching Strategies](./kb/6-planning/6.3.2-branching.md) ⏳
-   [6.3.3 Pruning (Dead Ends)](./kb/6-planning/6.3.3-pruning.md) ⏳
-   [6.3.4 Best-First Search](./kb/6-planning/6.3.4-best-first.md) ⏳
-   [6.3.5 When to Use (Complex Problems)](./kb/6-planning/6.3.5-when-to-use.md) ⏳

#### 6.4 Preflight Validation

-   [6.4.1 Check Before Execute](./kb/6-planning/6.4.1-check-before-execute.md) ⏳
-   [6.4.2 Resource Existence](./kb/6-planning/6.4.2-resource-existence.md) ⏳
-   [6.4.3 Constraint Satisfaction](./kb/6-planning/6.4.3-constraints.md) ⏳
-   [6.4.4 Schema Compatibility](./kb/6-planning/6.4.4-schema.md) ⏳
-   [6.4.5 Validation Issues → Suggestions](./kb/6-planning/6.4.5-suggestions.md) ⏳

---

### Layer 7: Error Recovery & Resilience

**Goal**: Build robust agents that handle failures gracefully

#### 7.1 Error Classification

-   [7.1.1 7 Error Types (Validation, Constraint, Not Found, etc.)](./kb/7-errors/7.1.1-error-types.md) ⏳
    -   **Research**: SuperAGI (2024) - 40% reduction in dead-end failures
-   [7.1.2 Pattern Matching (SQLite Errors, HTTP Codes)](./kb/7-errors/7.1.2-pattern-matching.md) ⏳
-   [7.1.3 LLM-Based Classification (Ambiguous Errors)](./kb/7-errors/7.1.3-llm-classification.md) ⏳
-   [7.1.4 Agent-Friendly Observations](./kb/7-errors/7.1.4-observations.md) ⏳

#### 7.2 Recovery Strategies

-   [7.2.1 Retry (Transient Errors)](./kb/7-errors/7.2.1-retry.md) ⏳
-   [7.2.2 Fallback (Not Found → Create Instead)](./kb/7-errors/7.2.2-fallback.md) ⏳
-   [7.2.3 Skip (Wait for Recovery)](./kb/7-errors/7.2.3-skip.md) ⏳
-   [7.2.4 Escalate (Unrecoverable)](./kb/7-errors/7.2.4-escalate.md) ⏳
-   [7.2.5 Strategy Selection by Error Type](./kb/7-errors/7.2.5-selection.md) ⏳

#### 7.3 Circuit Breaker Pattern

-   [7.3.1 States: Closed, Open, Half-Open](./kb/7-errors/7.3.1-states.md) ⏳
    -   **Research**: Michael T. Nygard - Release It!
-   [7.3.2 Failure Threshold (3 Consecutive)](./kb/7-errors/7.3.2-threshold.md) ⏳
-   [7.3.3 Timeout Duration (30s)](./kb/7-errors/7.3.3-timeout.md) ⏳
-   [7.3.4 Test Call (Half-Open)](./kb/7-errors/7.3.4-test-call.md) ⏳
-   [7.3.5 Per-Tool Circuit Breakers](./kb/7-errors/7.3.5-per-tool.md) ⏳

#### 7.4 Retry Strategies

-   [7.4.1 Exponential Backoff (1s, 2s, 4s, 8s)](./kb/7-errors/7.4.1-exponential-backoff.md) ⏳
    -   **Codebase Example**: `server/agent/orchestrator.ts` (retry logic with jitter)
-   [7.4.2 Jitter (Avoid Thundering Herd)](./kb/7-errors/7.4.2-jitter.md) ⏳
-   [7.4.3 Max Retries (3-5)](./kb/7-errors/7.4.3-max-retries.md) ⏳
-   [7.4.4 Budget Tracking](./kb/7-errors/7.4.4-budget.md) ⏳
-   [7.4.5 When to Give Up](./kb/7-errors/7.4.5-when-give-up.md) ⏳

#### 7.5 Tool Result Validation

-   [7.5.1 Post-Mutation Verification](./kb/7-errors/7.5.1-post-mutation.md) ⏳
-   [7.5.2 Expected State Checks](./kb/7-errors/7.5.2-state-checks.md) ⏳
-   [7.5.3 Silent Failure Detection (60% of Issues)](./kb/7-errors/7.5.3-silent-failures.md) ⏳
-   [7.5.4 Auto-Correction (Retry with Fix)](./kb/7-errors/7.5.4-auto-correction.md) ⏳
-   [7.5.5 Validation Cost (~50-100ms per Mutation)](./kb/7-errors/7.5.5-cost.md) ⏳

---

### Layer 8: Tool Design Patterns

**Goal**: Design safe, reliable tools with validation and metadata

#### 8.1 Tool Registry & Metadata

-   [8.1.1 Centralized Tool Catalog](./kb/8-tools/8.1.1-catalog.md) ⏳
    -   **Codebase Example**: `server/tools/all-tools.ts` (ALL_TOOLS, TOOL_METADATA)
-   [8.1.2 Metadata: Category, Risk Level, Approval Flag, Tags](./kb/8-tools/8.1.2-metadata.md) ⏳
-   [8.1.3 Dynamic Discovery (Query by Metadata)](./kb/8-tools/8.1.3-discovery.md) ⏳
-   [8.1.4 Type-Safe Registry (TypeScript)](./kb/8-tools/8.1.4-type-safety.md) ⏳

#### 8.2 Input Validation

-   [8.2.1 Zod Schemas (inputSchema)](./kb/8-tools/8.2.1-zod-schemas.md) ⏳
-   [8.2.2 Runtime Validation](./kb/8-tools/8.2.2-runtime.md) ⏳
-   [8.2.3 Error Messages](./kb/8-tools/8.2.3-error-messages.md) ⏳
-   [8.2.4 Schema Evolution](./kb/8-tools/8.2.4-evolution.md) ⏳
-   [8.2.5 AI SDK v6 Integration](./kb/8-tools/8.2.5-ai-sdk.md) ⏳

#### 8.3 Context Injection

-   [8.3.1 experimental_context Parameter (Native AI SDK)](./kb/8-tools/8.3.1-experimental-context.md) ⏳
    -   **Codebase Example**: All tools in `server/tools/all-tools.ts`
-   [8.3.2 AgentContext Interface](./kb/8-tools/8.3.2-agent-context.md) ⏳
-   [8.3.3 Service Access (DB, APIs, etc.)](./kb/8-tools/8.3.3-service-access.md) ⏳
-   [8.3.4 Avoid Closures (Anti-Pattern)](./kb/8-tools/8.3.4-avoid-closures.md) ⏳
-   [8.3.5 Framework-Native Approach](./kb/8-tools/8.3.5-framework-native.md) ⏳

#### 8.4 HTTP Client Tools

-   [8.4.1 Allowlist Pattern (Security)](./kb/8-tools/8.4.1-allowlist.md) ⏳
    -   **Codebase Example**: `server/tools/all-tools.ts` (http_get, http_post)
-   [8.4.2 GET vs POST Separation](./kb/8-tools/8.4.2-get-post.md) ⏳
-   [8.4.3 Header Management](./kb/8-tools/8.4.3-headers.md) ⏳
-   [8.4.4 Timeout Configuration](./kb/8-tools/8.4.4-timeout.md) ⏳
-   [8.4.5 Error Handling & Result Validation](./kb/8-tools/8.4.5-error-handling.md) ⏳

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

-   [11.3.1 Debug Pane (Real-Time Logs)](./kb/11-production/11.3.1-debug-pane.md) ⏳
    -   **Codebase Example**: `app/assistant/_components/debug-pane.tsx`
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
