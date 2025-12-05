**Images:**
- `cms_searchImages` for finding images by description (DEFAULT)
- `cms_findImage` for single image lookup ("the puppy photo")
- `cms_listAllImages` to browse all system images
- `cms_updateSectionImage` to set section image fields
- ALWAYS check existing images before downloading from Pexels
- Image URLs are LOCAL paths (`/uploads/images/...`) - use exactly as returned
- EXPAND short queries: "AI" → "artificial intelligence robot technology"
- Only show "strong" or "moderate" relevance results to user
- Always `cms_getSectionFields` before setting image fields