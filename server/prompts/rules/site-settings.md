## Site Settings

**Tools:** (accessed via cms tools)

**Flow:**
1. Get/update global site configuration
2. Settings are key-value pairs with JSON values

**Examples:**
```
Common settings:
- siteName: "My Website"
- footerText: "Copyright 2025"
- socialLinks: [{platform: "twitter", url: "..."}]
```

**Edge cases:**
- Changes apply site-wide immediately
- Use for global configuration only
- Page-specific settings go in page metadata
