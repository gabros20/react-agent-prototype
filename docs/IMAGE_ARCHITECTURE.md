# Image Architecture: Inline JSON Pattern

## Overview

Images in page sections use the **Inline JSON Content Pattern** - image data is stored directly in the `page_section_contents.content` JSON field, NOT in a separate junction table.

## Pattern

### ✅ Current Pattern: Inline JSON

**Storage:**
```json
// page_section_contents.content
{
  "title": "Welcome to Our CMS",
  "subtitle": "AI-powered content management",
  "image": {
    "url": "/uploads/images/2025/11/22/original/uuid.jpg",
    "alt": "Golden puppy in plaid blanket"
  },
  "ctaText": "Get Started",
  "ctaLink": { "type": "url", "href": "/contact" }
}
```

**Template Rendering:**
```njk
{% if image %}
<img src="{{ image.url }}" alt="{{ image.alt or '' }}" class="hero__image">
{% endif %}
```

**Agent Tools:**
- `cms_updateSectionImage` - Update image field in section content
- `cms_addImageToSection` - Add image to section content
- `cms_replaceImage` - Find and replace images across all sections

### ❌ Deprecated Pattern: Junction Table

The `page_section_images` table exists but is **deprecated for single image fields**.

**Reserved for future use:** Image galleries/carousels where multiple images need ordering.

## Why Inline JSON?

### Advantages
1. **Simple** - Content is self-contained
2. **Fast** - No database joins needed on render
3. **Flexible** - Easy to version and migrate content
4. **CMS Standard** - Matches WordPress, Contentful, Strapi patterns
5. **Template-Friendly** - Direct access to image data

### When NOT to Use
- Image galleries (multiple images with ordering) → Use junction table in future
- Shared images across multiple sections → Consider references

## Image URL Formats

### Uploaded Images
```json
{
  "url": "/uploads/images/2025/11/22/original/44e0e95a-796c-4714-b677-2ccbd50a46d5.jpg",
  "alt": "AI-generated description from GPT-4o-mini"
}
```

### External Images (CDN)
```json
{
  "url": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80",
  "alt": "AI and technology concept"
}
```

## Implementation Guide

### Adding Images to Sections

**Using Agent Tools:**
```typescript
// Tool: cms_updateSectionImage
{
  pageSectionId: "hero-section-uuid",
  imageField: "image",  // Field name in content JSON
  imageId: "uploaded-image-uuid",
  localeCode: "en"
}
```

**Manual Update:**
```typescript
const { SectionService } = await import("./services/cms/section-service");
const service = new SectionService(db, vectorIndex);

await service.syncPageContents({
  pageSectionId: "hero-uuid",
  localeCode: "en",
  content: {
    ...existingContent,
    image: {
      url: "/uploads/images/...",
      alt: "Description"
    }
  }
});
```

### Finding and Replacing Images

The `cms_replaceImage` tool recursively searches all section content and replaces matching image URLs:

```typescript
// Finds "puppy" image and replaces with "mountain"
{
  oldImageDescription: "puppy",
  newImageId: "mountain-image-uuid"
}
```

## Section Schema Design

When defining section structures, use the image field pattern:

```json
{
  "version": 1,
  "rows": [
    {
      "id": "row-1",
      "slots": [
        {
          "key": "image",
          "type": "image",
          "label": "Hero Image",
          "dataRules": { "required": false }
        }
      ]
    }
  ]
}
```

The `type: "image"` indicates the field expects `{url, alt}` structure.

## Database Schema

### Active Table
```sql
-- page_section_contents (stores image data)
CREATE TABLE page_section_contents (
  id TEXT PRIMARY KEY,
  page_section_id TEXT NOT NULL,
  locale_code TEXT NOT NULL,
  content TEXT NOT NULL,  -- JSON: { image: { url, alt }, ... }
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Deprecated Table
```sql
-- page_section_images (reserved for future galleries)
-- DEPRECATED for single image fields
CREATE TABLE page_section_images (
  id TEXT PRIMARY KEY,
  page_section_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  field_name TEXT NOT NULL,  -- e.g., "gallery", "carousel"
  sort_order INTEGER,        -- For ordering multiple images
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
```

## Migration Notes

If you have existing data in `page_section_images`:

1. **Export junction table data:**
   ```sql
   SELECT psi.*, i.file_path, im.description
   FROM page_section_images psi
   JOIN images i ON psi.image_id = i.id
   LEFT JOIN image_metadata im ON i.id = im.image_id;
   ```

2. **Update section content:**
   ```typescript
   for (const record of junctionTableData) {
     await service.syncPageContents({
       pageSectionId: record.pageSectionId,
       localeCode: 'en',
       content: {
         [record.fieldName]: {
           url: `/uploads/${record.file_path}`,
           alt: record.description || record.filename
         }
       }
     });
   }
   ```

3. **Verify and clean up:**
   ```sql
   -- After migration, table can be emptied
   DELETE FROM page_section_images;
   ```

## Testing

```bash
# 1. Restart server to load updated tools
pnpm dev

# 2. Test agent image update
# User: "Change the hero image to the puppy image"
# Agent should use: cms_updateSectionImage

# 3. Verify in browser
curl http://localhost:4000/pages/home?locale=en | grep "hero__image"
# Should show: <img src="/uploads/images/..." alt="Puppy...">
```

## Troubleshooting

### Image not displaying after update
1. Check uploads directory has static middleware: `app.use("/uploads", express.static(...))`
2. Verify image file exists: `ls uploads/images/2025/11/22/original/`
3. Check browser console for 404 errors
4. Verify section content: `SELECT content FROM page_section_contents WHERE page_section_id = '...'`

### Agent uses wrong tool
- Agent should use `cms_updateSectionImage` or `cms_addImageToSection`
- If using `cms_replaceImage`, it's for bulk find/replace operations

### Stale cache
```bash
# Full system reset
pnpm reset:system
pnpm dev
```

## Architecture Decision Record

**Decision:** Use inline JSON for section image fields
**Date:** 2025-11-23
**Status:** Accepted

**Context:**
- System had two conflicting patterns (junction table vs inline JSON)
- Templates expected inline JSON
- Tools used junction table
- Caused confusion and broken functionality

**Decision:**
- Standardize on inline JSON for single image fields
- Deprecate junction table for single images
- Reserve junction table for future gallery/carousel features
- Update all tools to use inline JSON pattern

**Consequences:**
- Simpler mental model for developers
- Faster page rendering (no joins)
- Easier content versioning
- Cannot easily track "where is this image used" without scanning all content
- Cannot bulk replace images across sections without content scanning (acceptable trade-off)

**Alternatives Considered:**
- Pure junction table: Too complex for CMS rendering, requires custom template helpers
- Hybrid: Led to confusion and bugs (previous state)
