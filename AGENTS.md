# Agent Ground Rules

## Date and Time Awareness

**ALWAYS use local tools** to get the current date and time. Your training data cutoff may cause you to reference incorrect dates. We are currently in 2025. Use available date/time tools before making any temporal references.

## Documentation Lookup Protocol

## Documentation Lookup Protocol

**Next.js 16**: Your training data lacks Next.js 16 knowledge. Use Ref, Context7, for web search Exa mcp or web_search with relevant keywords before implementing Next.js features.
**ShadCN**: Always retrieve latest component docs via Ref, Context7, Exa mcp or web_search (`/shadcn/ui` or specific component names). Don't rely on outdated knowledge.
**AI SDK 6**: Not in your knowledge base. Use Ref, Context7, Exa mcp or web_search for all `ai` package implementations, conventions, examples, streaming patterns, tool definitions, and React hooks etc.
**AI Elements (Vercel)**: Brand new library. Mandatory Ref, Context7, Exa mcp or web_search lookup for all `@ai-sdk/ui-elements` usage - search by component name or feature.

MUST FOLLOW IN ORDER: When dealing with new libraries or frameworks, follow this **cascading search order**:

1. **First**: Use Ref MCP to retrieve targeted library documentation, for broader context use context7 mcp.
2. **If Ref and context7 MCP doesn't exhaust info, need more info, or nothing found**: Use Exa MCP following the Research Guidance section below
3. **If Exa MCP fails or errors**: Fall back to the default `web_search` tool

## Research Guidance

MUST FOLLOW IN ORDER: When user requests research, investigation, analysis, or up-to-date information, follow this **web-first research workflow**:

**Research Flow**:

1. **Use `web_search` by default** - Get results and analyze.
2. **Only use Exa mcp if web_search insufficient** - When gaps remain. You will use Exa mcp to get the most up-to-date information.
3. **Dive deeper** - Additional `web_search` calls for specific sources/angles
4. **Synthesize** - Process gathered info into final deliverable

Prioritize web_search for cost-efficiency. Only escalate to Exa mcp when insufficient.

## File Creation

**NO markdown files** unless explicitly requested by user Do not create markdown files for your summaries, for your changes, for your reports etc. We're trying to work token efficiently So we don't need this. Only do on request.

## Documentation Organization Rule

**MANDATORY**: When creating any markdown document, ALWAYS organize it into the correct folder structure in `docs/`. NEVER create docs at root level (`docs/` root). Follow this categorization strictly:

### Folder Categories

-   **`docs/architecture/`** - System design, architecture patterns, core connections, integration patterns, debugging reports, visualization indices

    -   Examples: `CORE_PATTERN_CONNECTIONS.md`, `IMAGE_ARCHITECTURE.md`, `LOGGING.md`

-   **`docs/development/`** - Implementation sprints, progress tracking, notes, plans, working memory blueprints

    -   Examples: `IMPLEMENTATION_SPRINTS.md`, `PROGRESS.md`, `WORKING_MEMORY_PLAN.md`

-   **`docs/knowledge-base/`** - Knowledge base organized by numbered categories (0-12), each with specific subcategories using decimal numbering

    -   `0-foundations/` - LLM fundamentals, model types, tokenization
    -   `1-prompts/` - Prompt engineering, instruction design, role definition
    -   `2-context/` - Context management, compression, injection strategies
    -   `3-agents/` - Agent theory, REACT loop, tool definitions
    -   `4-memory/` - Working memory, hierarchical memory, checkpointing
    -   `5-rag/` - Retrieval-augmented generation, embeddings, similarity
    -   `6-planning/` - Agent planning strategies
    -   `7-errors/` - Error handling and debugging
    -   `8-tools/` - Tool design and composition
    -   `9-hitl/` - Human-in-the-loop workflows
    -   `10-multi-agent/` - Multi-agent systems
    -   `11-production/` - Production deployment
    -   `12-advanced/` - Advanced techniques

-   **`docs/research/`** - Feasibility studies, architectural explorations, external system adaptations, research papers
    -   Examples: `AGENTIC_PATTERNS_LIBRARY.md`, `CONTENTFUL_ADAPTER_FEASIBILITY.md`

### Filing Decision Tree

1. **Is it about system design/architecture?** → `docs/architecture/`
2. **Is it about development sprints/progress?** → `docs/development/`
3. **Is it research/feasibility/exploration?** → `docs/research/`
4. **Is it foundational knowledge?** → `docs/knowledge-base/[category]/`
5. **Otherwise** → Stop and ask user what to do!!
