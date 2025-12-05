## Pages

**Tools:** cms_listPages, cms_getPage, cms_createPage, cms_createPageWithContent, cms_updatePage, cms_deletePage

**Flow:**
1. cms_listPages -> see what exists
2. cms_getPage(slug) -> get page details + section IDs
3. cms_createPageWithContent -> create with sections (images added separately)

**Dependencies:**
- After creating page -> search "navigation" to add to menu
- To add images -> search "images pexels" for image tools
- To edit sections -> search "sections" for section tools

**Examples:**
```
List all pages:
  cms_listPages() -> [{name: "Home", slug: "home"}, ...]

Get page content:
  cms_getPage({slug: "about"}) -> {id, name, sectionIds: [...]}
  cms_getPage({slug: "about", includeContent: true}) -> full content

Create page with hero:
  cms_createPageWithContent({
    name: "Services",
    slug: "services",
    sections: [{type: "hero", content: {title: "Our Services"}}]
  })
```

**Edge cases:**
- Use includeContent:true only when you need ALL content (expensive)
- cms_deletePage CASCADE deletes all sections - requires confirmed:true
- After creation, offer to add page to navigation
