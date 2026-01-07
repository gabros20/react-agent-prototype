# Appendix D: Changelog

> **Summary**: Version history documenting the evolution from V5 to V6 to V7.
>
> **Prerequisites**: [../00-overview.md](../00-overview.md)

## V6 → V7 Changes

| Aspect | V6 | V7 |
|--------|----|----|
| **Agent Types** | `mode: primary/general/domain` | `type: router/orchestrator/specialist` |
| **Spawning** | spawn_agent tool exposed to LLM | Internal orchestrator mechanism |
| **Routing** | Implicit in primary agent prompt | Explicit router with complexity assessment |
| **Orchestrators** | Potentially multiple | ONE domain-agnostic orchestrator |
| **Depth Limiting** | Configurable maxDepth | Fixed at 3, enforced by canSpawn: false |
| **Context Passing** | Always inherited | fresh/inherited/selective modes |
| **Feature Flags** | None | SystemConfig for incremental rollout |

### Why These Changes?

**spawn_agent tool removed**: LLMs hallucinated invalid agent IDs. Now orchestrator has a hardcoded list.

**ONE orchestrator**: Multiple orchestrators created confusion. Domain knowledge belongs in specialists.

**Fixed 3-level depth**: Prevents runaway spawning. Simple tasks: 2 levels. Complex: 3 levels.

**Context modes**: Fresh context prevents cross-contamination in wide research. Selective passes only relevant results.

**Feature flags**: Enables MVP without orchestration, gradual rollout.

---

## V5 → V6 Changes

| Aspect | V5 | V6 |
|--------|----|----|
| **Multi-Agent** | Agent catalog defined | Full orchestration with session hierarchy, depth limiting |
| **Tool Management** | Simple list | Hybrid Search + Per-folder structure |
| **Memory** | Basic compaction | Compaction + Simple Todo (OpenCode-style) |
| **Token Counting** | Not specified | Provider-anchored compaction |
| **Background Jobs** | Not specified | BullMQ + Redis in Agent Server |
| **Tool Loading** | Static | Dynamic from Adapters + Search |
| **Adapter Structure** | Conceptual | Bundled tools/prompts/2-agents/schemas |
| **Data Storage** | Not specified | Internal CMS Server stores all agent data |
| **Implementation Plan** | 4 weeks | 8 weeks (more complete) |

### Why These Changes?

**Hybrid tool search**: With 50+ tools, can't load all into context. Search finds relevant ones.

**Provider-anchored compaction**: Different models have different limits. Use actual values.

**Jobs in Agent Server**: Third-party CMSs don't allow custom workers.

**Adapter bundles**: Everything in one folder makes adapters portable.

**Internal CMS for agent data**: Single source of truth enables stateless Agent Server.

---

## Key Design Decisions

### Decision: 3-Level Fixed Depth

**Problem**: Unlimited depth leads to runaway agent spawning, hard to debug.

**Solution**: Router (L1) → Orchestrator (L2) → Specialists (L3). No exceptions.

**Trade-off**: Less flexibility, but predictable and debuggable.

---

### Decision: ONE Orchestrator

**Problem**: Multiple domain orchestrators duplicated coordination logic.

**Solution**: Single orchestrator handles all complex tasks. Domain knowledge in specialists.

**Trade-off**: Orchestrator is generic. Must rely on specialist prompts for domain expertise.

---

### Decision: Specialists Cannot Spawn

**Problem**: Deep hierarchies when specialists spawn specialists.

**Solution**: `canSpawn: false` enforced in all specialist configs.

**Trade-off**: Specialists can't delegate. Must use tools for all capabilities.

---

### Decision: Fresh Context for Parallel Items

**Problem**: "Research 5 competitors" - each researcher sees previous results, causing cross-contamination.

**Solution**: Independent parallel items get fresh context.

**Trade-off**: No shared learning between parallel specialists.

---

### Decision: Feature Flags for Rollout

**Problem**: V7 is complex. Ship all at once = high risk.

**Solution**: Feature flags enable MVP → Full → Rollback modes.

**Trade-off**: More configuration complexity. Worth it for safer rollout.

---

### Decision: Workers in Agent Server

**Problem**: Need unified processing pipeline. Contentful/Sanity don't allow custom workers.

**Solution**: All workers (media, content) run in Agent Server.

**Trade-off**: Agent Server has more responsibilities. But enables unified pipeline.

---

### Decision: Internal CMS for All Agent Data

**Problem**: If users switch CMSs, what happens to their chat history?

**Solution**: All agent data (sessions, messages, todos) stored in our Internal CMS.

**Trade-off**: Must maintain Internal CMS even for Contentful/Sanity users. But enables consistent experience.

---

## Future Considerations

These were considered but deferred:

| Feature | Status | Notes |
|---------|--------|-------|
| Visual agent builder | Deferred | Feature flag ready |
| Multi-tenancy | Implied | Database schema supports it |
| Distributed events | Not needed yet | Redis pub/sub when scaling |
| Event persistence | Not needed yet | Add audit log when required |

### Design Gaps (Stages 6-8)

These are not architectural blockers but natural concerns for later implementation:

| Area | Current State | Future Design Needed |
|------|---------------|----------------------|
| **Authentication** | Mentioned but not specified | JWT/API key flow between services, token refresh, session validation |
| **Multi-tenancy** | Implied but not detailed | Database schema for tenant isolation, workspace separation, data boundaries |
| **Rate Limiting** | Not specified | Rate limits for external API calls (LLM providers, MCP servers, third-party CMSs) |
| **Observability** | Events defined, logging mentioned | Structured logging format, distributed tracing IDs, metrics collection |
| **Error Recovery** | Retry strategy mentioned | Dead letter queue for failed jobs, manual retry UI, error state recovery flows |

---

## Related Documents

- → [../00-overview.md](../00-overview.md) - Current architecture
- → [../3-implementation/14-feature-flags.md](../3-implementation/14-feature-flags.md) - Rollout configuration
- → [../2-agents/08-agent-model.md](../2-agents/08-agent-model.md) - Agent type rationale
