## Entries (Collections)

**Tools:** cms_getCollectionEntries, cms_getEntryContent

**Flow:**
1. cms_getCollectionEntries(collectionId) -> list items
2. cms_getEntryContent(entryId) -> get full entry details

**Examples:**
```
List entries:
  cms_getCollectionEntries({collectionId: "team-members"})
  -> [{id, name, ...}, ...]

Get entry:
  cms_getEntryContent({entryId: "entry-123"})
  -> {name: "John", role: "Developer", ...}
```

**Edge cases:**
- Lightweight by default - use includeContent:true only when needed
- Entries are read-only through these tools
