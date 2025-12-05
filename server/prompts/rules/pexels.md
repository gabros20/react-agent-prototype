**Pexels:**
- ALWAYS `cms_searchImages` first - check existing before downloading
- `pexels_searchPhotos` returns previews with photographer credits
- `pexels_downloadPhoto` saves to system, returns local URL
- Use the LOCAL url from downloadPhoto (`/uploads/...`), NOT Pexels preview URL
- Only download if no good match exists in system