# Tool Usage Guidelines

## Tool Selection Strategy

### 1. Use Fuzzy Search First

When user provides natural language descriptions (not IDs):
```
User: "update the home page"
→ cms.findResource({ query: "home page", type: "page" })
→ Get exact ID → Use in mutation
```

### 2. Validate Before Mutation

Before creating/updating/deleting:
```
1. Check existence: cms.getPage(id) or cms.findResource(query)
2. Verify constraints (slug uniqueness, required fields)
3. Confirm with user if ambiguous
```

### 3. One Tool at a Time

Execute tools sequentially:
```
✅ Good:
Step 1: cms.findResource(...)
Step 2: cms.createPage(...)
Step 3: cms.addSectionToPage(...)

❌ Bad:
Step 1: Call 3 tools simultaneously
```

## Tool Arguments

### Required vs Optional

Always provide required fields:
```typescript
// Required: name, slug
cms.createPage({
  name: "About",        // required
  slug: "about",        // required
  indexing: true,       // optional, but good practice
  meta: { title: "..." } // optional
})
```

### ID vs Slug

Some tools accept both:
```typescript
// By ID (preferred for updates)
cms.getPage({ id: "page-abc-123" })

// By slug (convenient for user queries)
cms.getPage({ slug: "home" })
```

## Tool Result Validation

After EVERY mutation, verify success:
```
1. Check tool result status
2. Verify expected fields present (id, name, slug)
3. Confirm side effects (vector index updated)
4. If validation fails, report error immediately
```

## Error Handling

When tool fails:
```
1. Read error message carefully
2. Identify error type (validation, not_found, conflict, etc.)
3. Adjust strategy based on error
4. Retry with corrections (max 2 attempts)
5. If still fails, escalate to user with clear explanation
```

## Tool Categories

### Read-Only Tools (Safe)
- cms.getPage, cms.listPages
- cms.listSections, cms.listCollections
- cms.findResource
- cms.previewPage

### Mutation Tools (Validate First)
- cms.createPage, cms.updatePage
- cms.createSectionDef, cms.updateSectionDef
- cms.addSectionToPage
- cms.syncPageContents
- cms.upsertEntry

### High-Risk Tools (HITL Approval Required)
- cms.syncSectionElements (schema changes)
- cms.syncCollectionElements (schema changes)
- Any future delete tools

## Tool Call Format

Be explicit:
```
Tool: cms.createPage
Arguments:
  name: "About Us"
  slug: "about-us"
  indexing: true
Reason: User requested new page creation
Expected: Page object with ID
```
