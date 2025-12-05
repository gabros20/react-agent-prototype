## Images

**Tools:** cms_searchImages, cms_findImage, cms_listAllImages, cms_addImageToSection, cms_updateSectionImage, cms_replaceImage, cms_deleteImage

**Flow:**
1. cms_searchImages(query) -> find images by description (DEFAULT)
2. cms_findImage(description) -> find ONE specific image
3. cms_updateSectionImage -> attach image to section field

**Dependencies:**
- Need stock photos? -> search "pexels" for pexels_searchPhotos, pexels_downloadPhoto
- Need section field names? -> search "sections" for cms_getSectionFields

**Examples:**
```
Search images:
  cms_searchImages({query: "mountain landscape"}) -> [{id, filename, description}, ...]

Find specific image:
  cms_findImage({description: "the puppy photo"}) -> {id, filename, url}

Set section image:
  cms_updateSectionImage({
    pageSectionId: "sec-123",
    imageField: "backgroundImage",
    imageId: "img-456"
  })
```

**Edge cases:**
- ALWAYS search existing images before downloading from Pexels
- Image URLs are LOCAL paths (/uploads/images/...) - use exactly as returned
- EXPAND short queries: "AI" -> "artificial intelligence robot technology"
- cms_getSectionFields first to know which image fields exist
- cms_deleteImage requires confirmed:true
