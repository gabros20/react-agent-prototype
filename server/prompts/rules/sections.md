**Sections:**
- `cms_getPageSections` to list sections on a page
- `cms_getSectionContent` to read section data
- `cms_updateSectionContent` MERGES with existing (only updates fields you provide)
- `cms_addSectionToPage` only if section doesn't exist
- `cms_getSectionFields` to see required fields before updating
- Check if section exists BEFORE adding (avoid duplicates)
- For image-text sections: layout ("image-left"/"image-right"), mobileLayout ("image-first"/"text-first")