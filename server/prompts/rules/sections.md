## Sections

**Tools:** cms_listSectionTemplates, cms_getSectionFields, cms_getPageSections, cms_getSectionContent, cms_addSectionToPage, cms_updateSectionContent, cms_deletePageSection, cms_deletePageSections

**Flow:**
1. cms_getPageSections(pageId) -> list sections on page
2. cms_getSectionContent(pageSectionId) -> get specific section data
3. cms_updateSectionContent -> update fields (MERGES, not replaces)

**Dependencies:**
- To set images in sections -> search "images" for cms_updateSectionImage
- To know field names -> cms_getSectionFields(sectionDefId)

**Examples:**
```
Get sections on page:
  cms_getPageSections({pageId: "..."}) -> [{id, sectionKey, sectionDefId}, ...]

Get section content:
  cms_getSectionContent({pageSectionId: "sec-123"}) -> {title: "...", body: "..."}

Update section (MERGES):
  cms_updateSectionContent({
    pageSectionId: "sec-123",
    content: {title: "New Title"}  // only updates title, keeps other fields
  })

Add section to page:
  cms_addSectionToPage({
    pageId: "...",
    sectionDefId: "hero",
    content: {title: "Welcome"}
  }) -> {pageSectionId: "new-id"}
```

**Edge cases:**
- updateSectionContent MERGES - only send fields you want to change
- Check section exists before adding (avoid duplicates)
- image-text sections: layout="image-left"|"image-right", mobileLayout="image-first"|"text-first"
- deletePageSection requires confirmed:true
