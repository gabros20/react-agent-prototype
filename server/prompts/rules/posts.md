## Posts

**Tools:** cms_listPosts, cms_getPost, cms_createPost, cms_updatePost, cms_publishPost, cms_archivePost, cms_deletePost

**Flow:**
1. cms_listPosts() -> find existing posts
2. cms_createPost -> creates DRAFT (not visible)
3. cms_publishPost -> makes live (requires confirmation)

**Dependencies:**
- Need content? -> search "web search" for web_quickSearch, web_deepResearch
- Need cover image? -> search "images pexels" for image tools

**Content Quality:**
- Blog posts should be substantial (500+ words for guides/tutorials)
- Structure: intro paragraph, 3+ sections with subheadings, conclusion
- If web_deepResearch fails or times out:
  1. Inform user that research timed out
  2. Use web_quickSearch results as reference points
  3. Synthesize comprehensive content from your knowledge
  4. Cite sources where snippets were used
- Never create placeholder content

**Examples:**
```
Create post:
  cms_createPost({
    title: "Monstera Care Guide",
    content: "# How to Care for Monstera\n\n...",
    featuredImage: "img-123",
    tags: ["plants", "care"]
  }) -> {post: {id, slug, status: "draft"}}

Publish post (confirmation flow):
  1. cms_publishPost({postSlug: "..."}) -> {requiresConfirmation: true}
  2. ASK user with final_answer: "Do you want me to publish 'Post Title'?"
  3. On user confirmation -> cms_publishPost({postSlug: "...", confirmed: true})

Update post with cover:
  cms_updatePost({
    postSlug: "...",
    featuredImage: "img-456",
    content: {..., cover: "img-456"}
  })
```

**Edge cases:**
- Lifecycle: draft -> published -> archived -> deleted
- ALWAYS cms_listPosts first to check if post exists before creating
- Cover images: set BOTH featuredImage AND content.cover in same call
- cms_publishPost and cms_deletePost require confirmed:true
- Never guess slug - always look it up with cms_getPost
