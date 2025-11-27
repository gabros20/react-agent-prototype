# Layer 7.4: Section Templates

> Section anatomy, content binding, variant patterns, BEM styling

## Overview

Section templates are the building blocks of pages. Each section type (hero, feature, cta, image-text, header, footer) has its own template directory with one or more variants. Templates receive content data and global context, using Nunjucks features (conditionals, loops, filters) to render HTML.

**Key Responsibilities:**
- Define HTML structure for each section type
- Bind content data to template variables
- Support multiple variants per section type
- Handle missing/optional content gracefully
- Follow consistent styling conventions (BEM)

---

## The Problem

Without proper section templates:

```html
<!-- WRONG: Hardcoded content -->
<h1>Welcome to Our Site</h1>  <!-- Not dynamic -->

<!-- WRONG: No null checks -->
<img src="{{ image.url }}">  <!-- Crashes if image is null -->

<!-- WRONG: No variants -->
<section class="hero">  <!-- Only one style possible -->

<!-- WRONG: Inconsistent classes -->
<div class="heroTitle">  <!-- Not BEM, hard to style -->
```

**Our Solution:**
1. Dynamic content binding with defaults
2. Null-safe conditionals for optional fields
3. Variant support (default, centered, etc.)
4. BEM naming convention (block__element--modifier)
5. Global context access (nav, year)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECTION TEMPLATE ANATOMY                     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Variable Defaults                            │  │
│  │                                                           │  │
│  │  {% set displayTitle = title or "Welcome" %}              │  │
│  │  {% set displayImage = image or placeholderImage %}       │  │
│  │  {% set normalizedLink = ctaLink | normalizeLink %}       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Section Wrapper                              │  │
│  │                                                           │  │
│  │  <section class="hero hero--centered">                    │  │
│  │    <div class="container">                                │  │
│  │      <!-- Section content -->                             │  │
│  │    </div>                                                 │  │
│  │  </section>                                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Content Elements                             │  │
│  │                                                           │  │
│  │  {% if displayTitle %}                                    │  │
│  │    <h1 class="hero__title">{{ displayTitle }}</h1>        │  │
│  │  {% endif %}                                              │  │
│  │                                                           │  │
│  │  {% if displayImage %}                                    │  │
│  │    <img src="{{ displayImage.url }}"                      │  │
│  │         alt="{{ displayImage.alt }}"                      │  │
│  │         class="hero__image">                              │  │
│  │  {% endif %}                                              │  │
│  │                                                           │  │
│  │  {% if normalizedLink %}                                  │  │
│  │    <a href="{{ normalizedLink.href }}"                    │  │
│  │       class="hero__cta">{{ ctaText }}</a>                 │  │
│  │  {% endif %}                                              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/templates/sections/hero/default.njk` | Hero section |
| `server/templates/sections/feature/default.njk` | Feature grid |
| `server/templates/sections/cta/default.njk` | Call-to-action |
| `server/templates/sections/image-text/default.njk` | Image + text layout |
| `server/templates/sections/header/default.njk` | Site header |
| `server/templates/sections/footer/default.njk` | Site footer |

---

## Core Implementation

### Hero Section

```html
<!-- server/templates/sections/hero/default.njk -->
{% set displayTitle = title or "Welcome to Our Site" %}
{% set displaySubtitle = subtitle or "Discover amazing experiences" %}
{% set displayImage = image or {url: '/assets/images/placeholders/hero.jpg', alt: 'Hero image'} %}
{% set displayCtaText = ctaText or "Learn More" %}
{% set displayCtaLink = ctaLink or "#" %}

<section class="hero">
  <div class="container">
    <h1 class="hero__title">{{ displayTitle }}</h1>
    <p class="hero__subtitle">{{ displaySubtitle }}</p>

    <img src="{{ displayImage.url }}"
         alt="{{ displayImage.alt or 'Hero image' }}"
         class="hero__image">

    {% set normalizedLink = displayCtaLink | normalizeLink %}
    {% if normalizedLink %}
      <a href="{{ normalizedLink.href }}" class="hero__cta">
        {{ displayCtaText }}
      </a>
    {% endif %}
  </div>
</section>
```

### Feature Section

```html
<!-- server/templates/sections/feature/default.njk -->
<section class="feature">
  <div class="container">
    {% if heading %}
      <h2 class="feature__heading">{{ heading }}</h2>
    {% endif %}

    {% if description %}
      <p class="feature__description">{{ description }}</p>
    {% endif %}

    {% if features and features.length > 0 %}
      <ul class="feature__list">
        {% for item in features %}
          <li class="feature__item">
            {% if item.icon %}
              <img src="{{ item.icon }}" alt="" class="feature__icon">
            {% endif %}
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </li>
        {% endfor %}
      </ul>
    {% endif %}
  </div>
</section>
```

### Header Section

```html
<!-- server/templates/sections/header/default.njk -->
{% set displayCtaText = ctaText or "Get Started" %}
{% set displayCtaLink = ctaLink or "#" %}
{% set normalizedCtaLink = displayCtaLink | normalizeLink %}

<header class="header" id="main-header">
  <div class="container">
    <div class="header__inner">
      <!-- Logo -->
      <div class="header__logo">
        <a href="/" class="header__logo-link">
          {% if logo and logo.url %}
            <img src="{{ logo.url }}" alt="{{ logo.alt or 'Logo' }}">
          {% else %}
            <img src="/assets/images/default-logo.svg" alt="Logo">
          {% endif %}
        </a>
      </div>

      <!-- Desktop Navigation -->
      <nav class="header__nav header__nav--desktop">
        {% if globalNavItems and globalNavItems.length > 0 %}
          <ul class="header__nav-list">
            {% for item in globalNavItems %}
              {% if item.visible and (item.location == "header" or item.location == "both") %}
                <li class="header__nav-item">
                  <a href="{{ item.href }}" class="header__nav-link">
                    {{ item.label }}
                  </a>
                </li>
              {% endif %}
            {% endfor %}
          </ul>
        {% endif %}
      </nav>

      <!-- CTA Button -->
      <div class="header__actions">
        {% if normalizedCtaLink %}
          <a href="{{ normalizedCtaLink.href }}" class="header__cta">
            {{ displayCtaText }}
          </a>
        {% endif %}

        <!-- Mobile Hamburger -->
        <button class="header__hamburger" aria-label="Toggle menu">
          <span class="header__hamburger-line"></span>
          <span class="header__hamburger-line"></span>
          <span class="header__hamburger-line"></span>
        </button>
      </div>
    </div>
  </div>

  <!-- Mobile Panel -->
  <div class="header__mobile-panel" id="mobile-menu" aria-hidden="true">
    <!-- Mobile nav content -->
  </div>
</header>
```

### Footer Section

```html
<!-- server/templates/sections/footer/default.njk -->
<footer class="footer">
  <div class="container">
    <div class="footer__inner">
      <!-- Navigation -->
      {% if globalNavItems and globalNavItems.length > 0 %}
        <nav class="footer__nav">
          <ul class="footer__nav-list">
            {% for item in globalNavItems %}
              {% if item.visible and (item.location == "footer" or item.location == "both") %}
                <li class="footer__nav-item">
                  <a href="{{ item.href }}" class="footer__nav-link">
                    {{ item.label }}
                  </a>
                </li>
              {% endif %}
            {% endfor %}
          </ul>
        </nav>
      {% endif %}

      <!-- Legal -->
      <div class="footer__legal">
        <a href="/privacy" class="footer__legal-link">Privacy Policy</a>
        <span class="footer__separator">|</span>
        <a href="/terms" class="footer__legal-link">Terms of Service</a>
      </div>

      <!-- Copyright -->
      <div class="footer__copyright">
        <p>&copy; {{ currentYear }} {{ companyName or "Company" }}. All rights reserved.</p>
      </div>
    </div>
  </div>
</footer>
```

### Image-Text Section

```html
<!-- server/templates/sections/image-text/default.njk -->
{% set bgClass = "image-text--bg-" + (backgroundColor or "white") %}
{% set layoutClass = "image-text--" + (desktopLayout or "image-left") %}
{% set mobileClass = "image-text--mobile-" + (mobileLayout or "image-first") %}

<section class="image-text {{ bgClass }} {{ layoutClass }} {{ mobileClass }}">
  <div class="container">
    <div class="image-text__grid">
      <!-- Image -->
      <div class="image-text__image">
        {% if image and image.url %}
          <img src="{{ image.url }}" alt="{{ image.alt or '' }}">
        {% else %}
          <img src="/assets/images/placeholders/image-text.jpg" alt="Placeholder">
        {% endif %}
      </div>

      <!-- Content -->
      <div class="image-text__content">
        {% if heading %}
          <h2 class="image-text__heading">{{ heading }}</h2>
        {% endif %}

        {% if content %}
          <div class="image-text__body">
            {{ content | markdown | safe }}
          </div>
        {% endif %}

        {% set link = ctaLink | normalizeLink %}
        {% if link and ctaText %}
          <a href="{{ link.href }}" class="image-text__cta">
            {{ ctaText }}
          </a>
        {% endif %}
      </div>
    </div>
  </div>
</section>
```

---

## Design Decisions

### Why Variable Defaults at Top?

```html
{% set displayTitle = title or "Welcome" %}
```

**Reasons:**
1. **Single source of truth** - Defaults defined once
2. **Readable** - Easy to see what defaults are
3. **Consistent** - Same pattern across all sections
4. **Maintainable** - Change default in one place

### Why BEM Naming Convention?

```html
<section class="hero">
  <h1 class="hero__title">...</h1>
  <a class="hero__cta hero__cta--primary">...</a>
</section>
```

**Reasons:**
1. **Scoped styles** - `.hero__title` doesn't conflict with `.feature__title`
2. **Self-documenting** - Class name shows structure
3. **Predictable** - Easy to find in CSS
4. **Modifier support** - `--primary`, `--centered`, etc.

### Why Conditional Rendering?

```html
{% if heading %}
  <h2>{{ heading }}</h2>
{% endif %}
```

**Reasons:**
1. **Clean output** - No empty elements
2. **Graceful degradation** - Missing data doesn't break layout
3. **Flexible content** - Some fields optional
4. **Better accessibility** - No empty landmarks

### Why normalizeLink Filter?

```html
{% set link = ctaLink | normalizeLink %}
{% if link %}
  <a href="{{ link.href }}">...</a>
{% endif %}
```

**Reasons:**
1. **String or object** - Content may be either format
2. **Null safety** - Returns null for invalid input
3. **Consistent interface** - Always access `.href`
4. **Future-proof** - Can add `target`, `rel` later

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 7.1 (Nunjucks Engine) | Uses filters (markdown, normalizeLink) |
| Layer 7.3 (Page Rendering) | Rendered by renderPage() |
| Layer 2.3 (Content Model) | Content JSON structure |
| CSS | BEM class naming |

### Content JSON Examples

**Hero Content:**
```json
{
  "title": "Welcome to Our Platform",
  "subtitle": "Build amazing things",
  "image": { "url": "/uploads/hero.jpg", "alt": "Hero image" },
  "ctaText": "Get Started",
  "ctaLink": "/pages/signup"
}
```

**Feature Content:**
```json
{
  "heading": "Our Features",
  "description": "What makes us different",
  "features": [
    { "title": "Fast", "description": "Lightning speed", "icon": "/assets/icons/fast.svg" },
    { "title": "Secure", "description": "Bank-level security", "icon": "/assets/icons/secure.svg" }
  ]
}
```

**Image-Text Content:**
```json
{
  "heading": "About Us",
  "content": "We are a **passionate** team...",
  "image": { "url": "/uploads/team.jpg", "alt": "Our team" },
  "desktopLayout": "image-right",
  "mobileLayout": "text-first",
  "backgroundColor": "gray",
  "ctaText": "Learn More",
  "ctaLink": "/pages/about"
}
```

---

## Common Issues / Debugging

### Content Not Rendering

```
// Template shows nothing
```

**Cause:** Content key doesn't match template variable.

**Debug:**

```html
<!-- Add debug output -->
<pre>{{ content | dump }}</pre>
```

### Image Broken

```
// Shows placeholder or broken image
```

**Cause:** Image URL wrong or image object structure different.

**Fix:**

```html
{% if image and image.url %}
  <img src="{{ image.url }}">
{% elif image %}
  <!-- Image is string, not object -->
  <img src="{{ image }}">
{% endif %}
```

### Link Not Working

```
// CTA button does nothing
```

**Cause:** Link not normalized or href missing.

**Debug:**

```html
<pre>Link: {{ ctaLink | dump }}</pre>
<pre>Normalized: {{ ctaLink | normalizeLink | dump }}</pre>
```

### BEM Class Not Applying

```
// Styles not working
```

**Cause:** Typo in class name or CSS not loaded.

**Debug:**

```html
<!-- Check exact class name -->
<div class="hero__title">  <!-- Not heroTitle or hero-title -->
```

---

## Further Reading

- [Layer 7.1: Nunjucks Engine](./LAYER_7.1_NUNJUCKS_ENGINE.md) - Custom filters
- [Layer 7.2: Template Registry](./LAYER_7.2_TEMPLATE_REGISTRY.md) - Variant discovery
- [Layer 7.3: Page Rendering](./LAYER_7.3_PAGE_RENDERING.md) - Section iteration
- [BEM Methodology](https://getbem.com/)
