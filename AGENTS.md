# Agent Ground Rules

## Date and Time Awareness

**ALWAYS use local tools** to get the current date and time. Your training data cutoff may cause you to reference incorrect dates. We are currently in 2025. Use available date/time tools before making any temporal references.

## Documentation Lookup Protocol

MUST FOLLOW IN ORDER: When dealing with new libraries or frameworks, follow this **cascading search order**:

1. **First**: Use Context7 MCP to retrieve library documentation
2. **If Context7 doesn't exhaust info, need more info, or nothing found**: Use Perplexity MCP tools following the Research Guidance section below
3. **If Perplexity fails or errors**: Fall back to the default `web_search` tool

**Specific Library Examples**:
**Next.js 16**: Your training data lacks Next.js 16 knowledge. Use Context7 MCP with relevant keywords before implementing Next.js features.
**ShadCN**: Always retrieve latest component docs via Context7 (`/shadcn/ui` or specific component names). Don't rely on outdated knowledge.
**AI SDK 6**: Not in your knowledge base. Use Context7 for all `ai` package implementations, conventions, examples, streaming patterns, tool definitions, and React hooks etc.
**AI Elements (Vercel)**: Brand new library. Mandatory Context7 lookup for all `@ai-sdk/ui-elements` usage - search by component name or feature.

## Research Guidance

MUST FOLLOW IN ORDER: When user requests research, investigation, analysis, or up-to-date information, follow this **multi-source research workflow**:

**Research Flow**:

1. **Use `web_search` tool first** - Get initial results and diverse perspectives, then **process the content** by creating files, documentation, or initial writing based on the findings
2. **Use Perplexity MCP tools** - Search on the topic to get curated insights and additional context:

    - **perplexity_ask**: Quick info checks, current facts, conversational queries needing web context
    - **perplexity_search**: Ranked results with titles, URLs, snippets, metadata - finding specific content
    - **perplexity_research**: Deep comprehensive analysis with citations - complex topics requiring thorough investigation
    - **perplexity_reason**: DONT USE THIS TOOL. IT IS TOO EXPENSIVE. You will reasone on your own.

    **CRITICAL - Perplexity API Rate Limits**:

    - **Compose multiple queries into one request** when possible (combine related search topics into a single query)
    - **If separate requests are needed**: Make them **sequentially, one at a time**
    - **Wait for each response** before making the next Perplexity request
    - **Never make parallel/concurrent Perplexity requests** - API rate limits require strict sequential execution
    - Example: If you need to search "React hooks" and "Next.js routing", either combine them in one query OR do: request 1 → wait for response → request 2 → wait for response

3. **Optimize initial work** - Based on Perplexity results, further optimize and refine the initial writing and documentation, incorporating new insights and correcting any gaps or inaccuracies
4. **Dive deeper into Perplexity sources** - If you need more info from any Perplexity-returned sources, use the default `web_search` tool to extract content from the provided links for points of interest
5. **Final synthesis** - Once enough context is gathered from all sources, synthesize and process the information into the final deliverable

This approach combines web search breadth with Perplexity's curated insights, allows iterative refinement of documentation, and enables deep-diving into specific sources for comprehensive research.

## File Creation

**NO markdown files** unless explicitly requested by user Do not create markdown files for your summaries, for your changes, for your reports etc. We're trying to work token efficiently So we don't need this. Only do on request.
