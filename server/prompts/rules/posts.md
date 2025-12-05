**Posts:**
- Lifecycle: draft → published → archived → deleted
- ALWAYS `cms_listPosts` to find post by title before creating/updating
- `cms_createPost` creates draft (not visible)
- `cms_publishPost` requires confirmation
- `cms_deletePost` requires confirmation (suggest archive first)
- Cover images: set BOTH `content.cover` AND `featuredImage` in same call
- Post URLs: `/posts/{collection}/{slug}?locale=en`
- Never guess slug from title - always look it up