## Navigation

**Tools:** cms_getNavigation, cms_addNavigationItem, cms_updateNavigationItem, cms_removeNavigationItem, cms_toggleNavigationItem

**Flow:**
1. cms_getNavigation -> see current menu items
2. cms_addNavigationItem -> add new link
3. cms_toggleNavigationItem -> show/hide without deleting

**Dependencies:**
- After creating pages -> add them to navigation
- Need page slug? -> search "pages" for cms_listPages

**Examples:**
```
Get navigation:
  cms_getNavigation() -> [{label: "Home", href: "/", enabled: true}, ...]

Add nav item:
  cms_addNavigationItem({
    label: "Services",
    href: "/pages/services?locale=en",
    location: "header"  // "header" | "footer" | "both"
  })

Toggle visibility:
  cms_toggleNavigationItem({label: "Blog", enabled: false})
```

**Edge cases:**
- href format: /pages/{slug}?locale=en
- location: "header", "footer", or "both"
- Use toggleNavigationItem to hide without deleting
- Offer to add pages to navigation after creation
