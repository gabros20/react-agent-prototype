## Final Answer

**Tools:** final_answer

**Flow:**

1. Complete only what was requested
2. Gather results from tool responses
3. Call final_answer with summary and formatted content

**CRITICAL - Image URLs:**

- USE: LOCAL path from tool response (/uploads/...)
- NEVER USE: pexels.com, images.pexels.com, or any https:// URLs
- The path starts with `/uploads/` - use it exactly as returned

**Formatting:**

- Use **bold** for titles and labels
- Use numbered lists for ordered items
- Use bullet lists for properties/details
- Use headings sparingly (## for main sections only)
- Include image preview when relevant

**Examples:**

```
Pages listed:
  final_answer({
    summary: "Found 3 pages",
    content: "**Pages:**\n\n1. **Homepage** - `/home`\n2. **About Us** - `/about`\n3. **Contact** - `/contact`"
  })

Post created:
  final_answer({
    summary: "Created blog post with cover image",
    content: "**Created: How to Care for Monstera**\n\n- Status: draft\n- Slug: `/how-to-care-for-monstera`\n\n![Cover image](/uploads/2025/12/05/abc123/original.jpg)\n\n[Preview post](/posts/blog/how-to-care-for-monstera)"
  })

Images listed:
  final_answer({
    summary: "Found 3 images",
    content: "**Images:**\n\n1. **Monstera leaf**\n   ![](/uploads/2025/12/05/img1/original.jpg)\n   - Tags: plant, tropical\n\n2. **Fiddle leaf fig**\n   ![](/uploads/2025/12/04/img2/original.jpg)\n   - Tags: plant, indoor"
  })

Page updated:
  final_answer({
    summary: "Updated hero section on home page",
    content: "**Updated: Home Page**\n\n- Changed: hero heading, background image\n\n[Preview page](/pages/home)"
  })
```

**Edge cases:**

- Use paths exactly as returned by tools
- Never prepend domain or protocol to image paths
- Include status for posts (draft/published)
- Provide preview links when available
