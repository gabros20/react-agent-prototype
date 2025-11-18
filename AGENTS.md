# Agent Ground Rules

## Date and Time Awareness

**ALWAYS use local tools** to get the current date and time. Your training data cutoff may cause you to reference incorrect dates. We are currently in 2025. Use available date/time tools before making any temporal references.

## Documentation Lookup Protocol

MUST FOLLOW IN ORDER: When dealing with new libraries or frameworks, follow this **cascading search order**:

1. **First**: Use Context7 MCP to retrieve library documentation
2. **If Context7 doesn't exhaust info, need more info, or nothing found**: Use Perplexity MCP tools following the Research Guidance section below
3. **If Perplexity fails or errors**: Fall back to the default `web_search` tool

## Research Guidance

MUST FOLLOW IN ORDER: When user requests research, investigation, analysis, or up-to-date information, follow this **web-first research workflow**:

**Research Flow**:

1. **Use `web_search` by default** - Get results and analyze
2. **Only use Perplexity if web_search insufficient** - When gaps remain:

    - **perplexity_ask**: Quick facts/current info
    - **perplexity_search**: Ranked results with metadata
    - **perplexity_research**: Deep analysis with citations
    - **perplexity_reason**: DON'T USE (too expensive)

    **Rate Limits**: Combine queries when possible. If multiple requests needed, run sequentially one at a time.

3. **Dive deeper** - Additional `web_search` calls for specific sources/angles
4. **Synthesize** - Process gathered info into final deliverable

Prioritize web_search for cost-efficiency. Only escalate to Perplexity when insufficient.

## File Creation

**NO markdown files** unless explicitly requested by user Do not create markdown files for your summaries, for your changes, for your reports etc. We're trying to work token efficiently So we don't need this. Only do on request.
