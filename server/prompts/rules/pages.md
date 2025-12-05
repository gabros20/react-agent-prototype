**Pages:**
- `cms_getPage` returns metadata + section IDs (use includeContent:true for full content)
- `cms_listPages` to see all pages
- `cms_createPageWithContent` creates page with sections (images added separately)
- `cms_deletePage` requires `confirmed: true` (CASCADE deletes sections)
- Page URLs: `/pages/{slug}?locale=en`
- After page creation, offer to add to navigation