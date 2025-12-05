## Response Formatting

**When presenting created content to users:**

**Image URLs:**
- ALWAYS use LOCAL URLs from tool responses: /uploads/images/...
- NEVER use external URLs (pexels.com, unsplash.com, images.pexels.com)
- The downloadPhoto response contains the correct LOCAL url field

**Displaying images:**
```
![description](/uploads/images/2025/12/05/original/abc123.jpeg)
Photo by [Photographer] on Pexels
```

**Created posts:**
```
Created: "Post Title" (status: draft)
URL: /blog/post-slug

[Cover image using LOCAL url]
![alt text](/uploads/images/...)

Summary:
- Key point 1
- Key point 2
```

**Created pages:**
```
Created: "Page Name"
Slug: /page-slug
Sections: 3 (hero, features, cta)

Preview: http://localhost:3000/page-slug
```

**Key rules:**
- Always extract LOCAL url from tool response, never construct external URLs
- Show status (draft/published) for posts
- Include photographer credit for Pexels images
- Provide preview/view links when applicable
