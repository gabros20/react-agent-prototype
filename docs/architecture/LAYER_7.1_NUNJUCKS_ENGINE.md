# Layer 7.1: Nunjucks Engine

> Environment configuration, custom filters, autoescape, development mode

## Overview

The Nunjucks engine is the core of the rendering layer. It provides template compilation, variable interpolation, control structures, and custom filters. The engine is configured with development-friendly options (watch mode, no cache) and production-safe defaults (autoescape).

**Key Responsibilities:**
- Configure Nunjucks environment
- Register custom filters (markdown, truncate, date, asset, normalizeLink)
- Handle template compilation and caching
- Provide safe HTML escaping

---

## The Problem

Without proper engine configuration:

```typescript
// WRONG: No autoescape
nunjucks.configure('templates');
{{ userInput }}  // XSS vulnerability

// WRONG: Production caching in development
nunjucks.configure('templates', { noCache: false });
// Template changes require server restart

// WRONG: No custom filters
{{ content }}  // Can't render markdown
{{ date }}     // Can't format dates

// WRONG: Inconsistent link handling
<a href="{{ link }}">  // May be string or object
```

**Our Solution:**
1. Autoescape enabled by default
2. Development mode: watch + noCache
3. Custom filters for markdown, dates, assets
4. normalizeLink filter handles string/object links

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NUNJUCKS ENGINE                               │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Configuration                            │  │
│  │                                                            │  │
│  │  nunjucks.configure(templateDir, {                        │  │
│  │    autoescape: true,          // XSS protection           │  │
│  │    watch: isDev,              // Auto-reload templates    │  │
│  │    noCache: isDev,            // Fresh compile in dev     │  │
│  │  })                                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Custom Filters                           │  │
│  │                                                            │  │
│  │  markdown    │ str → marked.parse(str)                    │  │
│  │  truncate    │ str, len → str.slice(0, len) + '...'       │  │
│  │  date        │ date, fmt → formatted date string          │  │
│  │  asset       │ path → '/assets/' + path                   │  │
│  │  normalizeLink│ link → { href, type } object              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Template Rendering                       │  │
│  │                                                            │  │
│  │  env.render('layout/page.njk', {                          │  │
│  │    page: { ... },                                         │  │
│  │    content: sectionHtmlList.join('\n'),                   │  │
│  │    globalNavItems: [...],                                 │  │
│  │    currentYear: 2025,                                     │  │
│  │  })                                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/renderer.ts` | Engine setup and filter registration |
| `server/templates/**/*.njk` | Template files using filters |

---

## Core Implementation

### Engine Configuration

```typescript
// server/services/renderer.ts
import nunjucks from "nunjucks";
import { marked } from "marked";

export class RendererService {
  private env: nunjucks.Environment;

  constructor(private templateDir: string) {
    this.env = nunjucks.configure(templateDir, {
      autoescape: true,  // Escape HTML by default
      watch: process.env.NODE_ENV === "development",  // Auto-reload
      noCache: process.env.NODE_ENV === "development",  // Fresh compile
    });

    this.registerFilters();
  }
}
```

### Markdown Filter

```typescript
this.env.addFilter("markdown", (str: string) => {
  if (!str) return "";
  return marked.parse(str);
});

// Usage in template
{{ body | markdown | safe }}
```

### Truncate Filter

```typescript
this.env.addFilter("truncate", (str: string, length: number) => {
  if (!str || str.length <= length) return str;
  return `${str.slice(0, length)}...`;
});

// Usage in template
{{ excerpt | truncate(150) }}
```

### Date Filter

```typescript
this.env.addFilter("date", (dateValue: any, format: string) => {
  if (!dateValue) return "";

  let date: Date;

  // Handle different input types
  if (dateValue instanceof Date) {
    date = dateValue;
  } else if (typeof dateValue === "string") {
    date = new Date(dateValue);
  } else if (typeof dateValue === "number") {
    date = new Date(dateValue);
  } else {
    return "";
  }

  const months = ["January", "February", "March", ...];
  const shortMonths = ["Jan", "Feb", "Mar", ...];

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // Support common formats
  if (format === "MMMM D, YYYY") {
    return `${months[month]} ${day}, ${year}`;
  } else if (format === "MMM D, YYYY") {
    return `${shortMonths[month]} ${day}, ${year}`;
  } else if (format === "YYYY-MM-DD") {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return date.toLocaleDateString();
});

// Usage in template
{{ publishedAt | date("MMMM D, YYYY") }}
```

### Asset Filter

```typescript
this.env.addFilter("asset", (assetPath: string) => {
  return `/assets/${assetPath}`;
});

// Usage in template
<link rel="stylesheet" href="{{ 'styles.css' | asset }}">
<!-- Output: /assets/styles.css -->
```

### Normalize Link Filter

```typescript
this.env.addFilter("normalizeLink", (link: any) => {
  // Handle null/undefined
  if (!link) return null;

  // If already an object with href, return as-is
  if (typeof link === "object" && link.href) {
    return link;
  }

  // If string, wrap in object structure
  if (typeof link === "string") {
    return { href: link, type: "url" };
  }

  return null;
});

// Usage in template
{% set normalizedLink = ctaLink | normalizeLink %}
{% if normalizedLink %}
  <a href="{{ normalizedLink.href }}">{{ ctaText }}</a>
{% endif %}
```

---

## Design Decisions

### Why Autoescape by Default?

```typescript
autoescape: true
```

**Reasons:**
1. **XSS prevention** - User content escaped automatically
2. **Security by default** - Developers must opt-out with `| safe`
3. **Safe templates** - New templates are secure without effort
4. **Explicit trust** - Only `| safe` content is unescaped

### Why Watch Mode in Development?

```typescript
watch: process.env.NODE_ENV === "development"
```

**Reasons:**
1. **Hot reload** - Template changes apply immediately
2. **Faster iteration** - No server restart needed
3. **Production performance** - Disabled in production
4. **Resource efficient** - No file watchers in prod

### Why Custom Date Filter?

```typescript
// Instead of using date-fns or moment
this.env.addFilter("date", (date, format) => { ... });
```

**Reasons:**
1. **Minimal dependencies** - No external date library
2. **Common formats** - Only a few formats needed
3. **Extensible** - Easy to add more formats
4. **Lightweight** - No bundle bloat

### Why normalizeLink Returns Object?

```typescript
return { href: link, type: "url" };
```

**Reasons:**
1. **Consistent interface** - Templates always get object
2. **Type safety** - Can check `normalizedLink.href`
3. **Extensibility** - Add `target`, `rel`, etc. later
4. **Null safety** - Returns null for invalid input

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 7.2 (Template Registry) | Registry uses env.render() |
| Layer 7.3 (Page Rendering) | renderPage calls env.render() |
| Layer 7.4 (Section Templates) | Sections use filters |
| marked library | markdown filter |

### Filter Usage in Templates

```html
<!-- Markdown content -->
<div class="prose">
  {{ body | markdown | safe }}
</div>

<!-- Truncated excerpt -->
<p>{{ excerpt | truncate(150) }}</p>

<!-- Formatted date -->
<time datetime="{{ publishedAt }}">
  {{ publishedAt | date("MMMM D, YYYY") }}
</time>

<!-- Asset URLs -->
<link rel="stylesheet" href="{{ 'styles.css' | asset }}">

<!-- Safe link handling -->
{% set link = ctaLink | normalizeLink %}
{% if link %}
  <a href="{{ link.href }}">Click here</a>
{% endif %}
```

### Safe vs Escaped Output

```html
<!-- Escaped (default) - XSS safe -->
{{ userComment }}
<!-- Output: &lt;script&gt;alert('xss')&lt;/script&gt; -->

<!-- Unescaped - for trusted HTML -->
{{ body | markdown | safe }}
<!-- Output: <p>Hello <strong>world</strong></p> -->
```

---

## Common Issues / Debugging

### Markdown Not Rendering

```
// Raw markdown shown in output
```

**Cause:** Missing `| safe` filter.

**Fix:**

```html
{{ content | markdown | safe }}
```

### Date Filter Returns Empty

```
// Date shows nothing
```

**Cause:** Invalid date input.

**Debug:**

```html
<!-- Check the raw value -->
<p>Raw: {{ publishedAt }}</p>
<p>Formatted: {{ publishedAt | date("MMMM D, YYYY") }}</p>
```

### Links Not Working

```
// Clicking link does nothing
```

**Cause:** Link is null or undefined.

**Fix:**

```html
{% set link = ctaLink | normalizeLink %}
{% if link %}
  <a href="{{ link.href }}">...</a>
{% else %}
  <span>No link available</span>
{% endif %}
```

### Template Changes Not Reflecting

```
// Changed template, same output
```

**Cause:** Running in production mode or watch not working.

**Debug:**

```bash
echo $NODE_ENV  # Should be "development"
```

### HTML Escaped When Shouldn't Be

```
// Shows &lt;strong&gt; instead of bold
```

**Cause:** Missing `| safe` for trusted content.

**Fix:**

```html
{{ trustedHtml | safe }}
```

---

## Further Reading

- [Layer 7.2: Template Registry](./LAYER_7.2_TEMPLATE_REGISTRY.md) - Template discovery
- [Layer 7.4: Section Templates](./LAYER_7.4_SECTION_TEMPLATES.md) - Filter usage
- [Nunjucks Documentation](https://mozilla.github.io/nunjucks/)
- [marked.js Documentation](https://marked.js.org/)
