# Exa AI Web Research Tools - Implementation Plan

## Overview

Add web research capabilities to the agent using Exa AI's API. The agent will have two research modes:
- **Shallow Search**: Quick lookups for fresh information (weather, news, quick facts)
- **Deep Research**: Multi-source research for content generation (blog posts, comprehensive pages)

The agent should autonomously determine which mode to use based on context.

---

## API Architecture

### Exa API Endpoints

Based on research from [Exa Docs](https://docs.exa.ai/reference/search) and [Exa Research](https://docs.exa.ai/reference/exa-research):

| Endpoint | Purpose | Use Case |
|----------|---------|----------|
| `POST /search` | Quick semantic search | Shallow lookups, fact-checking |
| `POST /contents` | Fetch URL content | After search, get full text |
| `POST /research/v1` | Deep research (async) | Blog posts, comprehensive research |

### Search Types (`type` parameter)

| Type | Description | Speed | Depth |
|------|-------------|-------|-------|
| `auto` | Intelligent combination (default) | Fast | Moderate |
| `neural` | Embeddings-based semantic | Fast | Good semantic match |
| `fast` | Streamlined, quick results | Fastest | Basic |
| `deep` | Query expansion, comprehensive | Slower | Deep |

---

## Tool Design

### Tool 1: `web_quickSearch`

**Purpose**: Fast, shallow web search for quick information retrieval.

**Parameters**:
```typescript
{
  query: string           // Search query
  numResults?: number     // 1-20, default: 5
  category?: string       // news, company, research paper, pdf, github, tweet
  includeDomains?: string[]  // Limit to specific sites
  excludeDomains?: string[]  // Block specific sites
  startPublishedDate?: string  // ISO date filter (recent news)
  livecrawl?: 'always' | 'fallback' | 'never'  // Freshness control
}
```

**Response**:
```typescript
{
  results: Array<{
    title: string
    url: string
    snippet: string      // Highlight/summary
    publishedDate?: string
    author?: string
  }>
  costEstimate: number
}
```

**When Agent Should Use**:
- Quick fact lookups ("What's the weather in London?")
- Recent news ("Latest AI announcements")
- Quick verification ("Is X company still operating?")
- Finding a specific resource or link

---

### Tool 2: `web_deepResearch`

**Purpose**: Comprehensive multi-source research for content generation.

**Parameters**:
```typescript
{
  topic: string              // Research topic/question
  outputSchema?: {           // Optional structured output
    sections?: string[]      // e.g., ["overview", "key_points", "sources"]
    includeStatistics?: boolean
    citationStyle?: 'inline' | 'footnotes'
  }
  model?: 'exa-research' | 'exa-research-pro'  // Default: exa-research
  maxWaitTime?: number       // Timeout in seconds (default: 120)
}
```

**Response**:
```typescript
{
  researchId: string
  status: 'complete' | 'failed'
  report: {
    summary: string
    keyPoints: string[]
    sections?: Record<string, string>
    statistics?: string[]
    citations: Array<{
      title: string
      url: string
      relevance: string
    }>
  }
  tokensUsed: number
  costDollars: number
}
```

**When Agent Should Use**:
- Creating blog posts ("Write a blog post about sustainable fashion")
- Building comprehensive pages ("Create an about page for an AI company")
- User explicitly asks to "research" or "search the web for"
- Complex topics needing multiple sources

---

### Tool 3: `web_fetchContent`

**Purpose**: Fetch full content from specific URLs (after search or user-provided).

**Parameters**:
```typescript
{
  urls: string[]            // URLs to fetch (max 10)
  includeText?: boolean     // Get full text (default: true)
  textMaxCharacters?: number // Limit text length (default: 10000)
  includeSummary?: boolean  // AI-generated summary
  summaryQuery?: string     // Custom summary focus
}
```

**Response**:
```typescript
{
  contents: Array<{
    url: string
    title: string
    text?: string
    summary?: string
    status: 'success' | 'error'
    error?: string
  }>
}
```

**When Agent Should Use**:
- User provides a URL to reference
- Agent found good sources in quickSearch but needs full content
- Building citations for deep research

---

## Implementation Steps

### Phase 1: Core Infrastructure

1. **Add Exa API key to environment**
   - File: `.env.local`
   - Variable: `EXA_API_KEY`

2. **Create Exa service**
   - File: `server/services/ai/exa-research.service.ts`
   - Encapsulates all Exa API calls
   - Handles authentication, retries, error handling
   - Manages polling for async research jobs

3. **Create research types**
   - File: `server/types/exa.ts`
   - TypeScript interfaces for Exa request/response types

### Phase 2: Tool Implementation

4. **Create web research tools**
   - File: `server/tools/web-research-tools.ts`
   - Three tools: `web_quickSearch`, `web_deepResearch`, `web_fetchContent`
   - Zod schemas for input validation
   - Clear descriptions for agent understanding

5. **Register tools**
   - File: `server/tools/all-tools.ts`
   - Add new tools to `ALL_TOOLS` export
   - Add metadata to `TOOL_METADATA`

### Phase 3: Agent Integration

6. **Update agent prompts**
   - File: `server/prompts/react.xml`
   - Add WEB RESEARCH section with:
     - When to use shallow vs deep search
     - Examples for each tool
     - How to integrate research into content creation

7. **Add workflow examples**
   - Content creation with research: prompt → deep research → create page
   - Quick lookup: question → quick search → answer
   - URL content fetch: user provides link → fetch → use content

### Phase 4: Testing & Documentation

8. **Create test scripts**
   - `scripts/test-exa-search.ts` - Test shallow search
   - `scripts/test-exa-research.ts` - Test deep research

9. **Update documentation**
   - `README.md` - Add web research feature
   - `PROGRESS.md` - Add sprint entry

---

## Agent Decision Logic

The agent should determine search type based on:

### Use Shallow Search When:
- Query is a simple question (weather, current price, quick fact)
- User asks for "quick" or "brief" information
- Context suggests time-sensitivity (news, current events)
- Looking for a specific link/resource
- Verifying a fact

### Use Deep Research When:
- Creating substantial content (blog post, page, article)
- User explicitly mentions "research" or "search the web"
- Topic is complex and needs multiple perspectives
- Content needs to be well-sourced and cited
- Building educational or informational content

### Prompt Guidance Example:
```xml
<web-research-guidance>
CHOOSING SEARCH DEPTH:

**SHALLOW (web_quickSearch):**
- "What's the weather in Paris?" → quick search, category: news
- "Find me the React docs link" → quick search
- "Latest news on AI" → quick search, livecrawl: always

**DEEP (web_deepResearch):**
- "Create a blog post about sustainable fashion" → deep research first
- "Build an about page, search the web for industry trends" → deep research
- "Research and write about renewable energy innovations" → deep research

After deep research, use results to inform content generation.
</web-research-guidance>
```

---

## Cost Considerations

### Exa Pricing (from docs)

**Search endpoint:**
- ~$0.001-0.003 per search query
- ~$0.001 per page content fetch

**Research API:**
| Operation | exa-research | exa-research-pro |
|-----------|--------------|------------------|
| Search | $5/1k | $5/1k |
| Page read (1k tokens) | $5/1k | $10/1k |
| Reasoning | $5/1M | $5/1M |

**Example research cost**: 6 searches + 20 pages + 1k reasoning ≈ $0.135

### Cost Controls:
- Default `numResults: 5` for shallow search
- Use `exa-research` (not pro) by default
- Set reasonable `maxWaitTime` to avoid runaway costs
- Log costs in responses for visibility

---

## File Structure

```
server/
├── services/
│   └── ai/
│       └── exa-research.service.ts    # NEW - Exa API client
├── tools/
│   ├── web-research-tools.ts          # NEW - 3 research tools
│   └── all-tools.ts                   # UPDATE - register tools
├── types/
│   └── exa.ts                         # NEW - TypeScript types
└── prompts/
    └── react.xml                      # UPDATE - add research guidance
```

---

## Example Workflows

### Workflow 1: Quick Fact Lookup
```
User: "What's the current Bitcoin price?"
Agent:
1. Recognizes need for quick, fresh data
2. Calls web_quickSearch({ query: "Bitcoin current price USD", numResults: 3, livecrawl: "always" })
3. Extracts price from results
4. Responds with current price and source
```

### Workflow 2: Blog Post with Research
```
User: "Create a blog post about the future of electric vehicles, search the web for recent developments"
Agent:
1. Recognizes content creation + research request
2. Calls web_deepResearch({
     topic: "Future of electric vehicles - recent developments, trends, and innovations 2024-2025",
     outputSchema: { sections: ["overview", "key_trends", "innovations", "challenges", "outlook"] }
   })
3. Waits for research to complete
4. Uses research report to inform blog post structure
5. Calls cms_createPost with research-informed content
6. Searches for relevant images
7. Returns completed post with sources
```

### Workflow 3: URL Content Integration
```
User: "Read this article and summarize: https://example.com/article"
Agent:
1. Calls web_fetchContent({ urls: ["https://example.com/article"], includeSummary: true })
2. Returns summary to user
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| API key exposure | Environment variable, never log key |
| High costs from runaway research | maxWaitTime limits, cost logging |
| Stale results | livecrawl option, date filters |
| API rate limits | Exponential backoff, retry logic |
| Research job timeout | Poll with timeout, graceful failure |
| Irrelevant results | Category filters, domain controls |

---

## Success Criteria

1. Agent correctly chooses shallow vs deep search based on context
2. Quick searches complete in <5 seconds
3. Deep research completes in <120 seconds
4. Research results successfully inform content creation
5. Costs are logged and reasonable (<$0.50 per deep research)
6. Error handling gracefully manages API failures

---

## Implementation Order

1. ✅ Research Exa API (done)
2. ⏳ Create types (`server/types/exa.ts`)
3. ⏳ Create Exa service (`server/services/ai/exa-research.service.ts`)
4. ⏳ Create tools (`server/tools/web-research-tools.ts`)
5. ⏳ Register tools (`server/tools/all-tools.ts`)
6. ⏳ Update prompts (`server/prompts/react.xml`)
7. ⏳ Test scripts
8. ⏳ Documentation updates

---

## Questions for User

Before implementing:

1. **API Key**: Do you have an Exa API key? Need to add to `.env.local`
2. **Default model**: Use `exa-research` (faster, cheaper) or `exa-research-pro` (higher quality)?
3. **Cost limits**: Any budget constraints per query?
4. **Domain restrictions**: Any domains to always include/exclude?
