# Layer 7: Rendering & Templates

> Nunjucks templates, section system, and page rendering

## Overview

The rendering layer transforms CMS data into HTML pages using Nunjucks templates. It implements a section-based architecture where pages are composed of reusable, configurable section types.

**Location:** `server/templates/`
**Preview Server:** Port 4000
**Service:** `server/services/renderer-service.ts`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Rendering Layer                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   RendererService                         │  │
│  │                                                           │  │
│  │  • Compile templates                                      │  │
│  │  • Inject data                                            │  │
│  │  • Apply filters                                          │  │
│  │  • Resolve assets                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐     ┌─────────────┐      ┌─────────────┐       │
│  │   Layout    │     │   Sections  │      │   Assets    │       │
│  │   Template  │     │             │      │             │       │
│  │             │     │  hero       │      │  CSS        │       │
│  │  header     │     │  features   │      │  images     │       │
│  │  content    │     │  image-text │      │  fonts      │       │
│  │  footer     │     │  posts      │      │             │       │
│  │             │     │  cta        │      │             │       │
│  └─────────────┘     └─────────────┘      └─────────────┘       │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Nunjucks Engine                        │  │
│  │                                                           │  │
│  │  Filters: markdown, truncate, date, asset, normalizeLink  │  │
│  │  Globals: site, env, page                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/renderer-service.ts` | Rendering logic |
| `server/templates/layout/page.njk` | Base page layout |
| `server/templates/sections/` | Section templates |
| `server/templates/assets/` | Static assets |
| `server/preview.ts` | Preview server |

---

## Directory Structure

```
server/templates/
├── layout/
│   └── page.njk              # Base layout
├── sections/
│   ├── hero/
│   │   ├── default.njk       # Default variant
│   │   └── centered.njk      # Centered variant
│   ├── features/
│   │   ├── default.njk
│   │   └── grid.njk
│   ├── image-text/
│   │   └── default.njk
│   ├── posts/
│   │   └── default.njk
│   ├── cta/
│   │   └── default.njk
│   └── testimonials/
│       └── default.njk
├── partials/
│   ├── header.njk
│   └── footer.njk
└── assets/
    ├── styles.css
    └── placeholders/
```

---

## RendererService

Core rendering logic:

```typescript
// server/services/renderer-service.ts
import nunjucks from 'nunjucks';
import { marked } from 'marked';

class RendererService {
  private env: nunjucks.Environment;

  constructor() {
    this.env = nunjucks.configure('server/templates', {
      autoescape: true,
      noCache: process.env.NODE_ENV === 'development'
    });

    this.registerFilters();
  }

  private registerFilters() {
    // Markdown filter
    this.env.addFilter('markdown', (str: string) => {
      if (!str) return '';
      return marked.parse(str);
    });

    // Truncate text
    this.env.addFilter('truncate', (str: string, length: number) => {
      if (!str || str.length <= length) return str;
      return str.slice(0, length) + '...';
    });

    // Date formatting
    this.env.addFilter('date', (date: Date | string, format: string) => {
      return formatDate(new Date(date), format);
    });

    // Asset URL resolution
    this.env.addFilter('asset', (path: string) => {
      return `/assets/${path}`;
    });

    // Normalize navigation links
    this.env.addFilter('normalizeLink', (url: string) => {
      if (!url) return '#';
      if (url.startsWith('http')) return url;
      return url.startsWith('/') ? url : `/${url}`;
    });
  }

  async renderPage(page: Page, siteSettings: SiteSettings): Promise<string> {
    const sections = await this.renderSections(page.sections);

    return this.env.render('layout/page.njk', {
      site: siteSettings,
      page: {
        title: page.title,
        slug: page.slug,
        metadata: page.metadata
      },
      sections,
      header: siteSettings.header,
      footer: siteSettings.footer
    });
  }

  private async renderSections(sections: SectionEntry[]): Promise<string[]> {
    return Promise.all(
      sections.map(async (section) => {
        const templatePath = `sections/${section.type}/${section.variant || 'default'}.njk`;
        return this.env.render(templatePath, section.content);
      })
    );
  }
}
```

---

## Page Layout

Base template with header, content, and footer:

```html
<!-- server/templates/layout/page.njk -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ page.title }} | {{ site.name }}</title>
  <meta name="description" content="{{ page.metadata.description }}">
  <link rel="stylesheet" href="{{ 'styles.css' | asset }}">
</head>
<body>
  {% include "partials/header.njk" %}

  <main>
    {% for section in sections %}
      {{ section | safe }}
    {% endfor %}
  </main>

  {% include "partials/footer.njk" %}
</body>
</html>
```

---

## Section Templates

### Hero Section

```html
<!-- server/templates/sections/hero/default.njk -->
<section class="hero">
  <div class="hero-container">
    {% if image %}
      <img src="{{ image }}" alt="{{ imageAlt }}" class="hero-image">
    {% endif %}

    <div class="hero-content">
      {% if eyebrow %}
        <span class="hero-eyebrow">{{ eyebrow }}</span>
      {% endif %}

      <h1 class="hero-title">{{ heading }}</h1>

      {% if subheading %}
        <p class="hero-subtitle">{{ subheading }}</p>
      {% endif %}

      {% if cta %}
        <a href="{{ cta.url | normalizeLink }}" class="hero-cta">
          {{ cta.text }}
        </a>
      {% endif %}
    </div>
  </div>
</section>
```

### Features Section

```html
<!-- server/templates/sections/features/grid.njk -->
<section class="features">
  <div class="features-container">
    {% if heading %}
      <h2 class="features-heading">{{ heading }}</h2>
    {% endif %}

    <div class="features-grid">
      {% for feature in features %}
        <div class="feature-card">
          {% if feature.icon %}
            <img src="{{ feature.icon }}" alt="" class="feature-icon">
          {% endif %}
          <h3 class="feature-title">{{ feature.title }}</h3>
          <p class="feature-description">{{ feature.description }}</p>
        </div>
      {% endfor %}
    </div>
  </div>
</section>
```

### Image-Text Section

```html
<!-- server/templates/sections/image-text/default.njk -->
<section class="image-text {{ 'image-text--reversed' if layout == 'image-right' }}"
         style="{% if backgroundColor %}background-color: {{ backgroundColor }};{% endif %}">
  <div class="image-text-container">
    <div class="image-text-media">
      {% if image %}
        <img src="{{ image }}" alt="{{ imageAlt }}">
      {% else %}
        <img src="{{ 'placeholders/image-text.jpg' | asset }}" alt="Placeholder">
      {% endif %}
    </div>

    <div class="image-text-content">
      {% if heading %}
        <h2>{{ heading }}</h2>
      {% endif %}

      {% if content %}
        <div class="prose">
          {{ content | markdown | safe }}
        </div>
      {% endif %}

      {% if cta %}
        <a href="{{ cta.url | normalizeLink }}" class="btn">
          {{ cta.text }}
        </a>
      {% endif %}
    </div>
  </div>
</section>
```

### Posts Section

```html
<!-- server/templates/sections/posts/default.njk -->
<section class="posts">
  <div class="posts-container">
    {% if heading %}
      <h2 class="posts-heading">{{ heading }}</h2>
    {% endif %}

    <div class="posts-grid">
      {% for post in posts %}
        <article class="post-card">
          {% if post.featuredImage %}
            <img src="{{ post.featuredImage }}" alt="{{ post.title }}">
          {% endif %}

          <div class="post-content">
            <time datetime="{{ post.publishedAt }}">
              {{ post.publishedAt | date('MMMM d, yyyy') }}
            </time>
            <h3>{{ post.title }}</h3>
            <p>{{ post.excerpt | truncate(150) }}</p>
            <a href="/blog/{{ post.slug }}">Read more</a>
          </div>
        </article>
      {% endfor %}
    </div>
  </div>
</section>
```

---

## Section Definitions

Each section type has a schema in the database:

```typescript
// Section definition structure
interface SectionDefinition {
  id: string;
  name: string;           // 'hero', 'features', etc.
  displayName: string;    // 'Hero Section'
  schema: ZodSchema;      // Content validation
  defaultContent: object; // Initial values
  variants: string[];     // ['default', 'centered', 'minimal']
}

// Example: Hero section definition
const heroDefinition = {
  name: 'hero',
  displayName: 'Hero Section',
  schema: z.object({
    heading: z.string(),
    subheading: z.string().optional(),
    eyebrow: z.string().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    cta: z.object({
      text: z.string(),
      url: z.string()
    }).optional(),
    backgroundColor: z.string().optional()
  }),
  defaultContent: {
    heading: 'Welcome to our site',
    subheading: 'We help you achieve your goals'
  },
  variants: ['default', 'centered', 'minimal', 'video']
};
```

---

## Header & Footer

### Header Template

```html
<!-- server/templates/partials/header.njk -->
<header class="site-header">
  <div class="header-container">
    <a href="/" class="logo">
      {% if site.logo %}
        <img src="{{ site.logo }}" alt="{{ site.name }}">
      {% else %}
        {{ site.name }}
      {% endif %}
    </a>

    <nav class="main-nav">
      {% for item in header.navigation %}
        <a href="{{ item.url | normalizeLink }}"
           class="{{ 'active' if page.slug == item.slug }}">
          {{ item.label }}
        </a>
      {% endfor %}
    </nav>

    {% if header.cta %}
      <a href="{{ header.cta.url | normalizeLink }}" class="header-cta">
        {{ header.cta.text }}
      </a>
    {% endif %}

    <button class="mobile-menu-toggle" aria-label="Toggle menu">
      <span></span>
    </button>
  </div>
</header>
```

### Footer Template

```html
<!-- server/templates/partials/footer.njk -->
<footer class="site-footer">
  <div class="footer-container">
    <div class="footer-info">
      <h4>{{ site.name }}</h4>
      {% if footer.description %}
        <p>{{ footer.description }}</p>
      {% endif %}
    </div>

    {% for column in footer.linkColumns %}
      <div class="footer-links">
        <h5>{{ column.title }}</h5>
        <ul>
          {% for link in column.links %}
            <li>
              <a href="{{ link.url | normalizeLink }}">{{ link.label }}</a>
            </li>
          {% endfor %}
        </ul>
      </div>
    {% endfor %}

    {% if footer.social %}
      <div class="footer-social">
        {% for social in footer.social %}
          <a href="{{ social.url }}" aria-label="{{ social.platform }}">
            {% include "icons/" + social.platform + ".svg" %}
          </a>
        {% endfor %}
      </div>
    {% endif %}

    <div class="footer-copyright">
      <p>© {{ "now" | date("yyyy") }} {{ site.name }}. {{ footer.copyright }}</p>
    </div>
  </div>
</footer>
```

---

## Preview Server

Hot-reloading preview:

```typescript
// server/preview.ts
import express from 'express';
import { watch } from 'chokidar';

const app = express();
const renderer = new RendererService();

// Serve rendered pages
app.get('/:slug?', async (req, res) => {
  const slug = req.params.slug || 'home';
  const page = await pageService.getBySlug(slug);
  const settings = await siteSettingsService.getAll(siteId);

  const html = await renderer.renderPage(page, settings);
  res.send(html);
});

// Static assets
app.use('/assets', express.static('server/templates/assets'));
app.use('/uploads', express.static('uploads'));

// Watch for template changes (dev only)
if (process.env.NODE_ENV === 'development') {
  watch('server/templates/**/*.njk').on('change', () => {
    console.log('Template changed, refresh browser');
  });
}

app.listen(4000, () => {
  console.log('Preview server running on http://localhost:4000');
});
```

---

## Asset Pipeline

### CSS Structure

```css
/* server/templates/assets/styles.css */

/* Base */
:root {
  --color-primary: #3b82f6;
  --color-text: #1f2937;
  --spacing-unit: 1rem;
}

/* Layout */
.site-header { ... }
.site-footer { ... }

/* Sections */
.hero { ... }
.features { ... }
.image-text { ... }
.posts { ... }
.cta { ... }

/* Utilities */
.prose { ... }
.btn { ... }
```

### Image Handling

```html
<!-- Responsive images with variants -->
<picture>
  <source
    srcset="/uploads/2025/01/15/variants/image-sm.avif 640w,
            /uploads/2025/01/15/variants/image-md.avif 1024w,
            /uploads/2025/01/15/variants/image-lg.avif 1920w"
    type="image/avif">
  <source
    srcset="/uploads/2025/01/15/variants/image-sm.webp 640w,
            /uploads/2025/01/15/variants/image-md.webp 1024w,
            /uploads/2025/01/15/variants/image-lg.webp 1920w"
    type="image/webp">
  <img
    src="/uploads/2025/01/15/original/image.jpg"
    alt="Description"
    loading="lazy">
</picture>
```

---

## Rendering Flow

```
Page Request
     ↓
RendererService.renderPage(page, settings)
     ↓
Load section entries for page
     ↓
For each section:
  - Get template: sections/{type}/{variant}.njk
  - Render with content data
     ↓
Combine in layout/page.njk
  - Inject header, sections, footer
  - Apply filters (markdown, dates, etc.)
     ↓
Return HTML string
```

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 2 (Database) | Load page/section data |
| Layer 4 (Services) | SiteSettingsService |
| Layer 5 (Background) | Image variants |

---

## Deep Dive Topics

- Custom Nunjucks extensions
- Template inheritance patterns
- CSS architecture (BEM, utility classes)
- Image optimization strategies
- SEO meta generation
- Static site generation (SSG)
