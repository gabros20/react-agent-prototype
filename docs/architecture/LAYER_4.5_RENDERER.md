# Layer 4.5: Renderer Service

> Nunjucks templates, section composition, page/post rendering, custom filters

## Overview

The RendererService handles HTML generation from CMS content using Nunjucks templating. It maintains a template registry auto-discovered from the sections directory, provides custom filters for markdown/date/link handling, and composes pages from section templates with header/footer wrappers.

**Key Responsibilities:**
- Configure Nunjucks environment with custom filters
- Auto-discover and register section templates
- Render pages by composing sections with content
- Render blog posts and post lists
- Resolve template variants with fallbacks

---

## The Problem

Without a proper rendering layer, content display is chaotic:

```typescript
// WRONG: Hardcoded HTML
const html = `<h1>${page.title}</h1><p>${page.description}</p>`;
// No reusability, no layouts, no consistency

// WRONG: Template per page
render("about-page.html", page);
render("pricing-page.html", page);
// Duplicate code, no section reuse

// WRONG: No filter helpers
content = `<div>${entry.content}</div>`;
// Raw markdown shows as text, dates unformatted

// WRONG: Manual template discovery
const templates = fs.readdirSync("./templates");
// No variant system, no fallbacks
```

**Our Solution:**
1. Nunjucks for powerful templating with inheritance
2. Section-based composition (header + sections + footer)
3. Custom filters for markdown, dates, links
4. Auto-discovery registry with variant support

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    RENDERER SERVICE                             │
│                                                                 │
│  renderPage(pageSlug, locale, pageService)                      │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  RendererService                        │    │
│  │                                                         │    │
│  │  Nunjucks Environment:                                  │    │
│  │  ├─ autoescape: true                                    │    │
│  │  ├─ watch: dev only                                     │    │
│  │  └─ noCache: dev only                                   │    │
│  │                                                         │    │
│  │  Custom Filters:                                        │    │
│  │  ├─ markdown  → marked.parse()                          │    │
│  │  ├─ truncate  → str.slice(0, n) + "..."                 │    │
│  │  ├─ asset     → "/assets/" + path                       │    │
│  │  ├─ normalizeLink → { href, type }                      │    │
│  │  └─ date      → format(date, pattern)                   │    │
│  │                                                         │    │
│  │  Template Registry (auto-built):                        │    │
│  │  ├─ hero      → { variants: [default, centered], path } │    │
│  │  ├─ features  → { variants: [default, grid], path }     │    │
│  │  ├─ cta       → { variants: [default], path }           │    │
│  │  └─ ...                                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                        │
│                        ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                Template Directory                       │    │
│  │                                                         │    │
│  │  server/templates/                                      │    │
│  │  ├─ layout/                                             │    │
│  │  │   └─ page.njk         (main page wrapper)            │    │
│  │  ├─ sections/                                           │    │
│  │  │   ├─ hero/                                           │    │
│  │  │   │   ├─ default.njk                                 │    │
│  │  │   │   └─ centered.njk                                │    │
│  │  │   ├─ features/                                       │    │
│  │  │   │   ├─ default.njk                                 │    │
│  │  │   │   └─ grid.njk                                    │    │
│  │  │   ├─ header/                                         │    │
│  │  │   │   └─ default.njk                                 │    │
│  │  │   └─ footer/                                         │    │
│  │  │       └─ default.njk                                 │    │
│  │  └─ posts/                                              │    │
│  │      ├─ blog/                                           │    │
│  │      │   ├─ single.njk                                  │    │
│  │      │   └─ list.njk                                    │    │
│  │      └─ layout/                                         │    │
│  │          └─ post.njk                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/renderer.ts` | RendererService class |
| `server/templates/layout/page.njk` | Main page layout wrapper |
| `server/templates/sections/*` | Section templates by type |
| `server/templates/posts/*` | Blog post templates |
| `server/routes/preview.ts` | Preview route calling renderer |

---

## Core Implementation

### Nunjucks Configuration

```typescript
// server/services/renderer.ts
export class RendererService {
  private env: nunjucks.Environment;
  private templateRegistry: TemplateRegistry = {};

  constructor(private templateDir: string) {
    this.env = nunjucks.configure(templateDir, {
      autoescape: true,  // XSS protection
      watch: process.env.NODE_ENV === "development",
      noCache: process.env.NODE_ENV === "development",
    });

    // Register custom filters
    this.env.addFilter("markdown", (str: string) => {
      if (!str) return "";
      return marked.parse(str);
    });

    this.env.addFilter("truncate", (str: string, length: number) => {
      if (!str || str.length <= length) return str;
      return `${str.slice(0, length)}...`;
    });

    this.env.addFilter("asset", (assetPath: string) => {
      return `/assets/${assetPath}`;
    });

    this.env.addFilter("normalizeLink", (link: any) => {
      if (!link) return null;
      if (typeof link === "object" && link.href) return link;
      if (typeof link === "string") return { href: link, type: "url" };
      return null;
    });

    this.env.addFilter("date", (dateValue: any, format: string) => {
      if (!dateValue) return "";

      let date: Date;
      if (dateValue instanceof Date) {
        date = dateValue;
      } else if (typeof dateValue === "string" || typeof dateValue === "number") {
        date = new Date(dateValue);
      } else {
        return "";
      }

      const months = ["January", "February", ...];
      const shortMonths = ["Jan", "Feb", ...];

      if (format === "MMMM D, YYYY") {
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
      } else if (format === "MMM D, YYYY") {
        return `${shortMonths[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
      } else if (format === "YYYY-MM-DD") {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      }

      return date.toLocaleDateString();
    });

    this.buildRegistry();
  }
}
```

### Template Registry Auto-Discovery

```typescript
private buildRegistry() {
  const sectionsDir = path.join(this.templateDir, "sections");

  if (!fs.existsSync(sectionsDir)) {
    console.warn("Sections directory not found:", sectionsDir);
    return;
  }

  // Find all template directories
  const templateKeys = fs
    .readdirSync(sectionsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  // Build registry with variants
  for (const templateKey of templateKeys) {
    const templatePath = path.join(sectionsDir, templateKey);
    const variants = fs
      .readdirSync(templatePath)
      .filter((file) => file.endsWith(".njk"))
      .map((file) => file.replace(".njk", ""));

    this.templateRegistry[templateKey] = {
      variants,
      path: `sections/${templateKey}`,
    };
  }

  console.log("✅ Template registry built:", this.templateRegistry);
}
```

### Page Rendering with Section Composition

```typescript
async renderPage(
  pageSlug: string,
  locale: string,
  pageService: PageService
): Promise<string> {
  const page = await pageService.getPageBySlug(pageSlug, true, locale);

  if (!page) {
    throw new Error(`Page not found: ${pageSlug}`);
  }

  // Fetch global data
  const globalNavItems = await this.siteSettingsService.getNavigationItems();
  const currentYear = new Date().getFullYear();

  const sectionHtmlList: string[] = [];

  for (const pageSection of page.pageSections || []) {
    const sectionDef = pageSection.sectionDefinition;
    const templateKey = sectionDef.templateKey;
    const variant = sectionDef.defaultVariant || "default";

    // Content is directly on pageSection after hybrid fetching
    const contentData = pageSection.content || {};

    const templatePath = this.resolveTemplate(templateKey, variant);

    const sectionHtml = this.env.render(templatePath, {
      ...contentData,
      sectionKey: sectionDef.key,
      locale,
      globalNavItems,
      currentYear,
    });

    sectionHtmlList.push(sectionHtml);
  }

  // Wrap sections in page layout
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

### Template Resolution with Fallbacks

```typescript
private resolveTemplate(templateKey: string, variant: string): string {
  const registry = this.templateRegistry[templateKey];

  if (!registry) {
    console.warn(`Template not found: ${templateKey}, using fallback`);
    return "sections/_default.njk";
  }

  if (!registry.variants.includes(variant)) {
    console.warn(`Variant '${variant}' not found for ${templateKey}, using default`);
    variant = "default";
  }

  return `${registry.path}/${variant}.njk`;
}
```

### Post Rendering

```typescript
async renderPost(
  entry: any,
  locale: string,
  collectionSlug: string
): Promise<string> {
  const globalNavItems = await this.siteSettingsService.getNavigationItems();
  const currentYear = new Date().getFullYear();

  // Render header
  let headerHtml = "";
  try {
    headerHtml = this.env.render("sections/header/default.njk", {
      globalNavItems,
      currentYear,
      locale,
    });
  } catch (error) {
    console.warn("Header template not found, skipping");
  }

  // Render footer
  let footerHtml = "";
  try {
    footerHtml = this.env.render("sections/footer/default.njk", {
      globalNavItems,
      currentYear,
      locale,
    });
  } catch (error) {
    console.warn("Footer template not found, skipping");
  }

  // Render post content
  const postTemplatePath = `posts/${collectionSlug}/single.njk`;
  const postHtml = this.env.render(postTemplatePath, {
    ...entry,
    ...entry.content,
    locale,
    globalNavItems,
    currentYear,
  });

  // Wrap in post layout
  const html = this.env.render("posts/layout/post.njk", {
    post: entry,
    locale,
    content: postHtml,
    header: headerHtml,
    footer: footerHtml,
    globalNavItems,
    currentYear,
  });

  return html;
}
```

---

## Design Decisions

### Why Nunjucks?

```typescript
this.env = nunjucks.configure(templateDir, { autoescape: true });
```

**Reasons:**
1. **Jinja2 syntax** - Familiar to Python/Django developers
2. **Template inheritance** - `{% extends "layout.njk" %}`
3. **Macros** - Reusable component definitions
4. **Built-in filters** - `safe`, `escape`, `default`, etc.
5. **Node.js native** - No external process needed

### Why Section-Based Composition?

```typescript
for (const pageSection of page.pageSections) {
  const sectionHtml = this.env.render(templatePath, contentData);
  sectionHtmlList.push(sectionHtml);
}
```

**Reasons:**
1. **Reusability** - Same section across multiple pages
2. **Flexibility** - Add/remove/reorder sections dynamically
3. **Isolation** - Each section has its own template
4. **Agent-friendly** - Agent manipulates sections, not raw HTML

### Why Auto-Discovery Registry?

```typescript
const templateKeys = fs.readdirSync(sectionsDir, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory());
```

**Reasons:**
1. **Zero config** - Add directory = available template
2. **Variant support** - Multiple .njk files per section
3. **Fallback logic** - Default variant if specified missing
4. **Runtime inspection** - `getTemplateRegistry()` for tooling

### Why Custom Filters?

```typescript
this.env.addFilter("markdown", (str) => marked.parse(str));
this.env.addFilter("normalizeLink", (link) => ...);
```

**Reasons:**
1. **Template simplicity** - `{{ content | markdown | safe }}`
2. **Data normalization** - Handle string/object links uniformly
3. **Consistent formatting** - Same date format everywhere
4. **Asset paths** - `{{ "logo.png" | asset }}`

### Why Header/Footer Try-Catch?

```typescript
try {
  headerHtml = this.env.render("sections/header/default.njk", data);
} catch (error) {
  console.warn("Header template not found, skipping");
}
```

**Reasons:**
1. **Graceful degradation** - Page renders even without header
2. **Optional components** - Not all pages need header/footer
3. **Development friendly** - Can add header later
4. **No errors** - Missing template doesn't crash rendering

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 4.1 (CMS Services) | PageService provides page data |
| Layer 4.1 (Site Settings) | SiteSettingsService for nav items |
| Layer 7 (Rendering) | Templates live in server/templates |
| Routes | Preview route calls renderPage |

### Preview Route Integration

```typescript
// server/routes/preview.ts
router.get("/preview/:pageSlug", async (req, res) => {
  const { pageSlug } = req.params;
  const locale = req.query.locale || "en";

  try {
    const html = await renderer.renderPage(
      pageSlug,
      locale,
      services.pageService
    );
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    res.status(404).send("Page not found");
  }
});
```

### Template Usage Example

```nunjucks
{# sections/hero/default.njk #}
<section class="hero">
  <h1>{{ heading }}</h1>
  <p>{{ subheading }}</p>
  {% if ctaButton %}
    {% set link = ctaButton.link | normalizeLink %}
    <a href="{{ link.href }}" class="btn">{{ ctaButton.text }}</a>
  {% endif %}
</section>
```

---

## Common Issues / Debugging

### Template Not Found

```
Error: Template not found: custom-section
```

**Cause:** Section directory missing or not .njk file.

**Fix:** Create proper structure:

```
server/templates/sections/custom-section/default.njk
```

### Markdown Not Rendering

```
// Shows raw **bold** instead of <strong>bold</strong>
```

**Cause:** Missing `safe` filter after `markdown`.

**Fix:**

```nunjucks
{# WRONG #}
{{ content | markdown }}

{# RIGHT #}
{{ content | markdown | safe }}
```

### Variables Undefined

```
// {{ page.title }} shows nothing
```

**Debug:**

```nunjucks
{# Debug: show all available vars #}
<pre>{{ page | dump }}</pre>
```

**Cause:** Variable not passed in render context.

### Link Filter Returns Null

```
// Button link broken
```

**Cause:** Link field is neither string nor object with href.

**Debug:**

```nunjucks
<pre>Link raw: {{ ctaButton.link | dump }}</pre>
<pre>Normalized: {{ ctaButton.link | normalizeLink | dump }}</pre>
```

### Registry Empty

```
✅ Template registry built: {}
```

**Cause:** Sections directory doesn't exist or empty.

**Fix:** Check path:

```typescript
const sectionsDir = path.join(this.templateDir, "sections");
console.log("Looking for sections in:", sectionsDir);
console.log("Exists:", fs.existsSync(sectionsDir));
```

### Hot Reload Not Working

```
// Template changes not reflected
```

**Cause:** Not in development mode.

**Fix:** Set environment:

```bash
NODE_ENV=development pnpm dev:server
```

---

## Further Reading

- [Layer 7: Rendering](./LAYER_7_RENDERING.md) - Full template system overview
- [Layer 4.1: CMS Services](./LAYER_4.1_CMS_SERVICES.md) - Page/section data
- [Layer 2.3: Content Model](./LAYER_2.3_CONTENT_MODEL.md) - Content structure
- [Nunjucks Documentation](https://mozilla.github.io/nunjucks/)
- [Marked Documentation](https://marked.js.org/)
