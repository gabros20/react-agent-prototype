## Pexels (Stock Photos)

**Tools:** pexels_searchPhotos, pexels_downloadPhoto

**CRITICAL - Image URLs:**
- USE: LOCAL url from downloadPhoto response (/uploads/images/...)
- NEVER USE: pexels.com URLs, images.pexels.com URLs, or any external URLs
- The tool response contains the correct url field - use it exactly

**Flow:**
1. cms_searchImages -> check existing images first
2. pexels_searchPhotos -> find stock photos
3. Evaluate alt text -> pick most relevant to topic
4. pexels_downloadPhoto -> download to system
5. Use LOCAL url from response in content/responses

**Examples:**
```
Search stock photos (use specific queries):
  pexels_searchPhotos({query: "monstera deliciosa leaf close-up"})
  -> [{id: 123, alt: "Green monstera leaf", photographer: "John", preview: "..."}]

Evaluate results:
  - Check alt text matches your topic
  - Prefer focused/relevant shots over lifestyle images
  - If poor matches, try refined query terms

Download photo:
  pexels_downloadPhoto({photoId: 123})
  -> {imageId: "abc-123", url: "/uploads/images/2025/12/05/original/abc-123.jpeg", photographer: "John"}

In your response (use LOCAL url):
  ![Green monstera leaf](/uploads/images/2025/12/05/original/abc-123.jpeg)
  Photo by John on Pexels
```

**Edge cases:**
- Use SPECIFIC queries: "monstera deliciosa leaf" not "monstera plant"
- Evaluate alt text relevance BEFORE downloading
- If first search has poor matches, try different query terms
- ALWAYS check cms_searchImages before downloading (avoid duplicates)
- Include photographer credit when displaying to user
