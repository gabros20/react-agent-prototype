# Layer 7.5: Post Rendering

> Blog posts, list views, collection routing, entry templates

## Overview

Post rendering handles blog/collection content separately from pages. While pages are composed of sections, posts are individual entries with their own templates (single post, post list). The system supports multiple collections (blog, news, etc.) with collection-specific templates.

**Key Responsibilities:**
- Render single post with entry data
- Render post list for a collection
- Include header/footer in post layouts
- Support collection-specific templates
- Handle post metadata (author, date, tags)

---

## The Problem

Without proper post rendering:

```typescript
// WRONG: Posts treated like pages
renderPage(post.slug);  // Posts don't have sections

// WRONG: No collection separation
<a href="/blog/{{ post.slug }}">  // What if it's news?

// WRONG: No list view
// Can't show all posts in a collection

// WRONG: No header/footer
<article>{{ post.body }}</article>  // No navigation
```

**Our Solution:**
1. Separate renderPost() and renderPostList() methods
2. Collection-based template paths: `posts/{collection}/single.njk`
3. Header/footer injection for consistent layout
4. Post layout template: `posts/layout/post.njk`
5. Routes: `/posts/:collection` and `/posts/:collection/:slug`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    POST RENDERING FLOW                           │
│                                                                  │
│  Request: GET /posts/blog/my-article                            │
│       │                                                          │
│       ▼                                                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 Route Handler                              │  │
│  │                                                            │  │
│  │  router.get("/:collectionSlug/:postSlug", async (req) => { │  │
│  │    const collection = await getCollectionDef(collectionSlug)│  │
│  │    const entry = await getEntryBySlug(postSlug, locale);   │  │
│  │    const html = await renderer.renderPost(entry, locale,   │  │
│  │                                           collectionSlug); │  │
│  │  })                                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                        │                                         │
│                        ▼                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              renderPost(entry, locale, collectionSlug)     │  │
│  │                                                            │  │
│  │  1. Fetch global navigation items                         │  │
│  │  2. Render header (sections/header/default.njk)           │  │
│  │  3. Render footer (sections/footer/default.njk)           │  │
│  │  4. Render post content (posts/{collection}/single.njk)   │  │
│  │  5. Combine in layout (posts/layout/post.njk)             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                        │                                         │
│                        ▼                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Template Hierarchy                            │  │
│  │                                                            │  │
│  │  posts/                                                    │  │
│  │  ├── layout/                                              │  │
│  │  │   └── post.njk          # Base layout (like page.njk) │  │
│  │  └── blog/                 # Collection-specific          │  │
│  │      ├── single.njk        # Single post template        │  │
│  │      └── list.njk          # Post list template          │  │
│  │                                                            │  │
│  │  sections/                 # Reused for header/footer     │  │
│  │  ├── header/default.njk                                   │  │
│  │  └── footer/default.njk                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/renderer.ts` | renderPost(), renderPostList() |
| `server/routes/posts.ts` | Post routes |
| `server/templates/posts/layout/post.njk` | Post layout |
| `server/templates/posts/blog/single.njk` | Single post template |
| `server/templates/posts/blog/list.njk` | Post list template |

---

## Core Implementation

### renderPost Method

```typescript
// server/services/renderer.ts
async renderPost(
  entry: any,
  locale: string,
  collectionSlug: string
): Promise<string> {
  // Fetch global navigation items
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
    ...entry.content,  // Spread content fields
    locale,
    globalNavItems,
    currentYear,
  });

  // Wrap in layout
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

### renderPostList Method

```typescript
async renderPostList(
  entries: any[],
  collectionSlug: string,
  collectionName: string,
  locale: string,
  collectionDescription?: string
): Promise<string> {
  const globalNavItems = await this.siteSettingsService.getNavigationItems();
  const currentYear = new Date().getFullYear();

  // Render header/footer (same as renderPost)
  let headerHtml = "", footerHtml = "";
  // ... try/catch rendering

  // Render list content
  const listTemplatePath = `posts/${collectionSlug}/list.njk`;
  const listHtml = this.env.render(listTemplatePath, {
    posts: entries,
    collectionName,
    collectionDescription,
    locale,
    globalNavItems,
    currentYear,
  });

  // Wrap in layout
  const html = this.env.render("posts/layout/post.njk", {
    post: { title: collectionName },  // For <title> tag
    locale,
    content: listHtml,
    header: headerHtml,
    footer: footerHtml,
    globalNavItems,
    currentYear,
  });

  return html;
}
```

### Post Routes

```typescript
// server/routes/posts.ts
export function createPostsRouter(
  renderer: RendererService,
  entryService: EntryService
) {
  const router = express.Router();

  // List all posts in collection
  router.get("/:collectionSlug", async (req, res) => {
    const { collectionSlug } = req.params;
    const locale = (req.query.locale as string) || "en";

    const collection = await entryService.getCollectionDefBySlug(collectionSlug);
    if (!collection) return res.status(404).send("Collection not found");

    const entries = await entryService.listPublishedEntries(collection.id, locale);
    const html = await renderer.renderPostList(
      entries,
      collectionSlug,
      collection.name,
      locale,
      collection.description
    );

    res.send(html);
  });

  // Single post
  router.get("/:collectionSlug/:postSlug", async (req, res) => {
    const { collectionSlug, postSlug } = req.params;
    const locale = (req.query.locale as string) || "en";

    const collection = await entryService.getCollectionDefBySlug(collectionSlug);
    if (!collection) return res.status(404).send("Collection not found");

    const entry = await entryService.getEntryBySlug(postSlug, locale);
    if (!entry) return res.status(404).send("Post not found");

    // Check published status (allow draft in dev)
    if (entry.status !== "published" && process.env.NODE_ENV === "production") {
      return res.status(404).send("Post not found");
    }

    const html = await renderer.renderPost(entry, locale, collectionSlug);
    res.send(html);
  });

  return router;
}
```

### Single Post Template

```html
<!-- server/templates/posts/blog/single.njk -->
<article class="post">
  <div class="container">
    <div class="post__content">
      <!-- Header -->
      <header class="post__header">
        {% if category %}
          <div class="post__category">
            <span class="post__category-badge">{{ category }}</span>
          </div>
        {% endif %}

        <h1 class="post__title">{{ title }}</h1>

        {% if excerpt %}
          <p class="post__excerpt">{{ excerpt }}</p>
        {% endif %}

        <div class="post__meta">
          {% if author %}
            <span class="post__author">By {{ author }}</span>
          {% endif %}
          {% if publishedAt %}
            <time datetime="{{ publishedAt }}">
              {{ publishedAt | date("MMMM D, YYYY") }}
            </time>
          {% endif %}
        </div>
      </header>

      <!-- Featured Image -->
      {% if featuredImage %}
        <div class="post__featured-image">
          <img src="{{ featuredImage }}" alt="{{ title }}">
        </div>
      {% elif cover and cover.url %}
        <div class="post__featured-image">
          <img src="{{ cover.url }}" alt="{{ cover.alt or title }}">
        </div>
      {% endif %}

      <!-- Body -->
      <div class="post__body">
        {% if body %}
          {{ body | markdown | safe }}
        {% else %}
          <p>No content available.</p>
        {% endif %}
      </div>

      <!-- Tags -->
      {% if tags and tags.length > 0 %}
        <div class="post__tags">
          <h3>Tags:</h3>
          <ul class="post__tags-list">
            {% for tag in tags %}
              <li class="post__tag">{{ tag }}</li>
            {% endfor %}
          </ul>
        </div>
      {% endif %}
    </div>
  </div>
</article>
```

### Post List Template

```html
<!-- server/templates/posts/blog/list.njk -->
<section class="posts-list">
  <div class="container">
    <header class="posts-list__header">
      <h1 class="posts-list__title">{{ collectionName }}</h1>
      {% if collectionDescription %}
        <p class="posts-list__description">{{ collectionDescription }}</p>
      {% endif %}
    </header>

    {% if posts and posts.length > 0 %}
      <div class="posts-list__grid">
        {% for post in posts %}
          <article class="post-card">
            {% if post.content.featuredImage or post.content.cover %}
              <div class="post-card__image">
                <img src="{{ post.content.featuredImage or post.content.cover.url }}"
                     alt="{{ post.title }}">
              </div>
            {% endif %}

            <div class="post-card__content">
              {% if post.content.category %}
                <span class="post-card__category">{{ post.content.category }}</span>
              {% endif %}

              <h2 class="post-card__title">
                <a href="/posts/blog/{{ post.slug }}">{{ post.title }}</a>
              </h2>

              {% if post.content.excerpt %}
                <p class="post-card__excerpt">
                  {{ post.content.excerpt | truncate(150) }}
                </p>
              {% endif %}

              <div class="post-card__meta">
                {% if post.content.publishedAt %}
                  <time datetime="{{ post.content.publishedAt }}">
                    {{ post.content.publishedAt | date("MMM D, YYYY") }}
                  </time>
                {% endif %}
              </div>
            </div>
          </article>
        {% endfor %}
      </div>
    {% else %}
      <div class="posts-list__empty">
        <p>No posts found in this collection.</p>
      </div>
    {% endif %}
  </div>
</section>
```

### Post Layout

```html
<!-- server/templates/posts/layout/post.njk -->
<!DOCTYPE html>
<html lang="{{ locale }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ post.title }}</title>
  <link rel="stylesheet" href="/assets/styles.css">
</head>
<body>
  {{ header | safe }}

  <main>
    {{ content | safe }}
  </main>

  {{ footer | safe }}
</body>
</html>
```

---

## Design Decisions

### Why Separate from Page Rendering?

```typescript
renderPage()   // For section-based pages
renderPost()   // For collection entries
```

**Reasons:**
1. **Different structure** - Posts aren't composed of sections
2. **Different data model** - Entry vs Page
3. **Different templates** - Single post vs section grid
4. **Collection support** - Multiple collection types

### Why Include Header/Footer Manually?

```typescript
const headerHtml = this.env.render("sections/header/default.njk", {...});
const footerHtml = this.env.render("sections/footer/default.njk", {...});
```

**Reasons:**
1. **Reuse sections** - Same header/footer as pages
2. **Consistent navigation** - globalNavItems available
3. **Flexible layout** - Posts can have different header styles
4. **No duplication** - Single source of truth for header/footer

### Why Collection-Based Template Paths?

```typescript
const postTemplatePath = `posts/${collectionSlug}/single.njk`;
// e.g., posts/blog/single.njk, posts/news/single.njk
```

**Reasons:**
1. **Collection flexibility** - Each collection can have unique design
2. **Scalability** - Add new collections easily
3. **Convention** - Predictable template location
4. **Isolation** - Blog styling doesn't affect news

### Why Spread Entry Content?

```typescript
const postHtml = this.env.render(postTemplatePath, {
  ...entry,
  ...entry.content,  // Spread content fields to top level
  locale,
});
```

**Reasons:**
1. **Template simplicity** - Access `{{ title }}` not `{{ entry.content.title }}`
2. **Flexibility** - Both `entry.slug` and `title` accessible
3. **Consistency** - Same pattern as section content
4. **Backward compatible** - Can still access `entry.status` etc.

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 4.1 (CMS Services) | EntryService for post data |
| Layer 7.1 (Nunjucks Engine) | Filters (markdown, date, truncate) |
| Layer 7.4 (Section Templates) | Header/footer reuse |
| Layer 7.6 (Preview Server) | Mounted at /posts |

### URL Structure

```
/posts/blog           → List all blog posts
/posts/blog/my-post   → Single blog post
/posts/news           → List all news articles
/posts/news/headline  → Single news article
```

### Entry Data Structure

```typescript
interface Entry {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  content: {
    body: string;           // Markdown content
    excerpt?: string;
    author?: string;
    publishedAt?: string;
    category?: string;
    tags?: string[];
    featuredImage?: string;
    cover?: { url: string; alt: string };
  };
}
```

---

## Common Issues / Debugging

### Post Not Found

```
404 - Post not found
```

**Cause:** Entry doesn't exist or not published.

**Debug:**

```sql
SELECT slug, status FROM entries WHERE collection_def_id = ?;
```

### Collection Template Missing

```
Error: Template not found: posts/news/single.njk
```

**Cause:** Collection doesn't have templates yet.

**Fix:** Create collection templates:

```bash
mkdir -p server/templates/posts/news
cp server/templates/posts/blog/single.njk server/templates/posts/news/
cp server/templates/posts/blog/list.njk server/templates/posts/news/
```

### Markdown Not Rendering

```
// Shows raw **markdown** in post
```

**Cause:** Missing `| markdown | safe` filter.

**Fix:**

```html
{{ body | markdown | safe }}
```

### Date Not Formatting

```
// Shows ISO date string
```

**Cause:** Missing date filter.

**Fix:**

```html
{{ publishedAt | date("MMMM D, YYYY") }}
```

---

## Further Reading

- [Layer 7.3: Page Rendering](./LAYER_7.3_PAGE_RENDERING.md) - Compare with page flow
- [Layer 7.4: Section Templates](./LAYER_7.4_SECTION_TEMPLATES.md) - Header/footer templates
- [Layer 4.1: CMS Services](./LAYER_4.1_CMS_SERVICES.md) - EntryService
