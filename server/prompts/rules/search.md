## Search (CMS Content)

**Tools:** search_vector, cms_findResource

**Flow:**
1. cms_findResource -> find pages/sections/collections by name
2. search_vector -> semantic search across all CMS content

**Examples:**
```
Find resource by name:
  cms_findResource({query: "about", resourceType: "page"})
  -> {type: "page", id: "...", name: "About Us"}

Semantic search:
  search_vector({query: "team members with engineering background"})
  -> [{type: "entry", id: "...", snippet: "..."}, ...]
```

**Edge cases:**
- Specify resourceType for targeted search: "page", "section", "collection"
- search_vector finds semantically similar content, not exact matches
- Use cms_findResource when you know approximately what you're looking for
