## Web Research

**Tools:** web_quickSearch, web_deepResearch, web_fetchContent

**Flow:**
1. web_quickSearch -> fast search for facts, links, quick info
2. web_deepResearch -> comprehensive research (slower, 30-240s)
3. web_fetchContent -> extract content from specific URL

**Dependencies:**
- After research -> search "create post" to create content
- For images -> search "pexels" for stock photos

**Examples:**
```
Quick search:
  web_quickSearch({query: "monstera plant care tips"})
  -> {results: [{title, snippet, url}, ...]}

Deep research:
  web_deepResearch({query: "comprehensive guide to monstera care"})
  -> {report: "# Monstera Care\n\n## Watering\n...", sources: [...]}

Fetch page:
  web_fetchContent({url: "https://example.com/article"})
  -> {content: "...", title: "..."}
```

**Edge cases:**
- web_quickSearch: fast, good for specific facts (~1-2s)
- web_deepResearch: thorough but costs ~$0.10-0.20, takes 30-240s
- Use specific queries: "sustainable fashion trends 2025" not "fashion"
- Always cite sources when using research in content

**Timeout handling:**
- web_deepResearch may timeout after 120-240s
- If research times out:
  1. Inform user that deep research timed out
  2. Fall back to web_quickSearch for key facts
  3. Synthesize content using your knowledge + search snippets
  4. Offer to retry if user wants comprehensive research
- For blog posts: prefer web_deepResearch, fall back gracefully if it fails
