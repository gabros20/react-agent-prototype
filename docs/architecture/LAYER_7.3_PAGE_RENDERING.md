# Layer 7.3: Page Rendering

> Layout composition, section iteration, global context injection

## Overview

Page rendering is the process of transforming a page entity (with its sections) into a complete HTML document. The RendererService fetches page data, iterates through sections, renders each with its template, and combines them into the base layout with global context (navigation, current year, locale).

**Key Responsibilities:**
- Fetch page and section data
- Iterate sections in display order
- Render each section with its content
- Inject global context (nav, year, locale)
- Combine in base layout template

---

## The Problem

Without proper page rendering:

```typescript
// WRONG: Manual section composition
let html = '<html><body>';
for (const section of sections) {
  html += renderSection(section);  // No layout, no head
}
html += '</body></html>';

// WRONG: No global context
render('page.njk', { page });  // No nav, no footer

// WRONG: Section order not respected
sections.map(s => render(s));  // May be out of order

// WRONG: Missing metadata
<title>Page</title>  // No dynamic title
```

**Our Solution:**
1. Fetch page with sections via PageService
2. Iterate sections in order from pageSections
3. Render each section with resolved template
4. Inject global nav items from SiteSettingsService
5. Combine in `layout/page.njk` with metadata

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAGE RENDERING FLOW                           │
│                                                                  │
│  renderPage(slug, locale, pageService)                          │
│       │                                                          │
│       ▼                                                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 Fetch Page Data                            │  │
│  │                                                            │  │
│  │  const page = await pageService.getPageBySlug(             │  │
│  │    slug,                                                   │  │
│  │    includeContent: true,                                   │  │
│  │    locale                                                  │  │
│  │  );                                                        │  │
│  │                                                            │  │
│  │  page = {                                                  │  │
│  │    id, name, slug, status,                                │  │
│  │    meta: { title, description },                          │  │
│  │    pageSections: [                                        │  │
│  │      { order, content, sectionDefinition }                │  │
│  │    ]                                                      │  │
│  │  }                                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                        │                                         │
│                        ▼                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │               Fetch Global Context                         │  │
│  │                                                            │  │
│  │  const globalNavItems = await siteSettingsService          │  │
│  │    .getNavigationItems();                                  │  │
│  │                                                            │  │
│  │  const currentYear = new Date().getFullYear();             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                        │                                         │
│                        ▼                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Render Sections (Loop)                        │  │
│  │                                                            │  │
│  │  for (const pageSection of page.pageSections) {           │  │
│  │    const templateKey = sectionDef.templateKey;            │  │
│  │    const variant = sectionDef.defaultVariant || "default";│  │
│  │    const templatePath = resolveTemplate(key, variant);    │  │
│  │                                                            │  │
│  │    sectionHtml = env.render(templatePath, {               │  │
│  │      ...contentData,                                      │  │
│  │      sectionKey,                                          │  │
│  │      locale,                                              │  │
│  │      globalNavItems,                                      │  │
│  │      currentYear,                                         │  │
│  │    });                                                    │  │
│  │                                                            │  │
│  │    sectionHtmlList.push(sectionHtml);                     │  │
│  │  }                                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                        │                                         │
│                        ▼                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Render Layout                                 │  │
│  │                                                            │  │
│  │  return env.render("layout/page.njk", {                   │  │
│  │    page,                                                  │  │
│  │    locale,                                                │  │
│  │    content: sectionHtmlList.join("\n"),                   │  │
│  │    globalNavItems,                                        │  │
│  │    currentYear,                                           │  │
│  │  });                                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                        │                                         │
│                        ▼                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Final HTML Output                             │  │
│  │                                                            │  │
│  │  <!DOCTYPE html>                                          │  │
│  │  <html lang="en">                                         │  │
│  │  <head>                                                   │  │
│  │    <title>Home | Site Name</title>                        │  │
│  │    <link rel="stylesheet" href="/assets/styles.css">     │  │
│  │  </head>                                                  │  │
│  │  <body>                                                   │  │
│  │    <!-- Header section -->                                │  │
│  │    <!-- Hero section -->                                  │  │
│  │    <!-- Feature section -->                               │  │
│  │    <!-- CTA section -->                                   │  │
│  │    <!-- Footer section -->                                │  │
│  │  </body>                                                  │  │
│  │  </html>                                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/renderer.ts` | renderPage() method |
| `server/templates/layout/page.njk` | Base HTML layout |
| `server/services/cms/page-service.ts` | Page data fetching |
| `server/services/cms/site-settings-service.ts` | Global nav items |

---

## Core Implementation

### renderPage Method

```typescript
// server/services/renderer.ts
async renderPage(
  pageSlug: string,
  locale: string,
  pageService: PageService
): Promise<string> {
  // Fetch page with full content
  const page = await pageService.getPageBySlug(pageSlug, true, locale);

  if (!page) {
    throw new Error(`Page not found: ${pageSlug}`);
  }

  // Fetch global context
  const globalNavItems = await this.siteSettingsService.getNavigationItems();
  const currentYear = new Date().getFullYear();

  // Render each section
  const sectionHtmlList: string[] = [];

  if (!page.pageSections || page.pageSections.length === 0) {
    console.warn(`No sections found for page: ${pageSlug}`);
  } else {
    for (const pageSection of page.pageSections) {
      const sectionDef = pageSection.sectionDefinition;
      const templateKey = sectionDef.templateKey;
      const variant = sectionDef.defaultVariant || "default";

      // Content is directly on pageSection after hybrid fetch
      const contentData = pageSection.content || {};

      // Resolve template with fallback
      const templatePath = this.resolveTemplate(templateKey, variant);

      // Render section
      const sectionHtml = this.env.render(templatePath, {
        ...contentData,
        sectionKey: sectionDef.key,
        locale,
        globalNavItems,
        currentYear,
      });

      sectionHtmlList.push(sectionHtml);
    }
  }

  // Render final layout
  const html = this.env.render("layout/page.njk", {
    page,
    locale,
    content: sectionHtmlList.join("\n"),
    globalNavItems,
    currentYear,
  });

  return html;
}
```

### Base Layout Template

```html
<!-- server/templates/layout/page.njk -->
<!DOCTYPE html>
<html lang="{{ locale }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ page.meta.title or page.name }}</title>
  {% if page.meta.description %}
  <meta name="description" content="{{ page.meta.description }}">
  {% endif %}
  <link rel="stylesheet" href="/assets/styles.css">
</head>
<body>
  {{ content | safe }}

  <script>
    // Mobile menu toggle script
    document.addEventListener('DOMContentLoaded', function() {
      // ... mobile menu logic
    });
  </script>
</body>
</html>
```

### Global Navigation Items

```typescript
// From SiteSettingsService
const globalNavItems = [
  { label: "Home", href: "/pages/home", location: "header", visible: true },
  { label: "About", href: "/pages/about", location: "both", visible: true },
  { label: "Blog", href: "/posts/blog", location: "header", visible: true },
  { label: "Contact", href: "/pages/contact", location: "footer", visible: true },
];
```

---

## Design Decisions

### Why Pass PageService as Parameter?

```typescript
async renderPage(slug, locale, pageService: PageService)
```

**Reasons:**
1. **Dependency injection** - No tight coupling to specific instance
2. **Testability** - Can mock PageService in tests
3. **Flexibility** - Different page services for different contexts
4. **No circular deps** - Renderer doesn't import services

### Why Include Content = true?

```typescript
const page = await pageService.getPageBySlug(pageSlug, true, locale);
```

**Reasons:**
1. **Preview needs full data** - Can't render without content
2. **Hybrid fetch** - Content already on pageSection
3. **Single query** - Reduces database round trips
4. **Performance** - No N+1 queries for sections

### Why Join Sections with Newline?

```typescript
content: sectionHtmlList.join("\n")
```

**Reasons:**
1. **Readable source** - View source shows sections on new lines
2. **Debugging** - Easy to find section boundaries
3. **No side effects** - Newlines don't affect rendering
4. **Consistency** - Same output every time

### Why Global Context in Each Section?

```typescript
sectionHtml = env.render(templatePath, {
  ...contentData,
  globalNavItems,  // Available in every section
  currentYear,
});
```

**Reasons:**
1. **Header/footer need nav** - Can't render without it
2. **Consistency** - All sections have same context
3. **Flexibility** - Any section can use global data
4. **DRY** - Set once, use everywhere

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 4.1 (CMS Services) | PageService for page data |
| Layer 7.1 (Nunjucks Engine) | env.render() for templates |
| Layer 7.2 (Template Registry) | resolveTemplate() for paths |
| Layer 7.4 (Section Templates) | Individual section rendering |

### Page Data Structure

```typescript
interface Page {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published";
  meta: {
    title: string;
    description?: string;
  };
  pageSections: Array<{
    id: string;
    order: number;
    content: Record<string, any>;
    sectionDefinition: {
      key: string;
      templateKey: string;
      defaultVariant: string;
    };
  }>;
}
```

### Section Context

Each section receives:

```typescript
{
  // From content JSON
  title: "Welcome",
  subtitle: "...",
  image: { url: "...", alt: "..." },

  // From sectionDefinition
  sectionKey: "hero-1",

  // Global context
  locale: "en",
  globalNavItems: [...],
  currentYear: 2025,
}
```

---

## Common Issues / Debugging

### Page Not Found

```
Error: Page not found: about-us
```

**Cause:** Slug doesn't exist or page not published.

**Debug:**

```sql
SELECT slug, status FROM pages WHERE site_id = ?;
```

### No Sections Rendered

```
// Page renders but body is empty
```

**Cause:** No pageSections or content missing.

**Debug:**

```typescript
console.log('Page sections:', page.pageSections);
console.log('First section content:', page.pageSections[0]?.content);
```

### Sections Out of Order

```
// Footer before header
```

**Cause:** Section order not respected.

**Fix:** Ensure pageSections are ordered by `order` field:

```typescript
page.pageSections.sort((a, b) => a.order - b.order);
```

### Missing Navigation

```
// Header has no nav links
```

**Cause:** globalNavItems empty or not passed.

**Debug:**

```typescript
const globalNavItems = await siteSettingsService.getNavigationItems();
console.log('Nav items:', globalNavItems);
```

### Wrong Locale Content

```
// Shows English instead of Spanish
```

**Cause:** Locale not passed or content not localized.

**Debug:**

```typescript
console.log('Rendering with locale:', locale);
// Check content has locale-specific values
```

---

## Further Reading

- [Layer 7.2: Template Registry](./LAYER_7.2_TEMPLATE_REGISTRY.md) - Template resolution
- [Layer 7.4: Section Templates](./LAYER_7.4_SECTION_TEMPLATES.md) - Section anatomy
- [Layer 4.1: CMS Services](./LAYER_4.1_CMS_SERVICES.md) - PageService
