# Validation Patterns

## Pre-Mutation Validation

Before EVERY mutation, validate:

### 1. Resource Existence

```
Before update/delete:
→ cms.getPage(id) to verify exists
→ If not found, inform user immediately

Before create:
→ cms.findResource({ query: slug, type: "page" }) to check uniqueness
→ If exists, suggest alternative
```

### 2. Required Fields

```
Check all required fields present:
- Pages: name, slug
- Sections: sectionDefId, pageId
- Entries: collectionId, slug, title, content
```

### 3. Constraints

```
Verify:
- Slug format: /^[a-z0-9-]{2,64}$/
- Slug uniqueness: per site+environment for pages
- Foreign keys: sectionDefId exists in section_definitions
- Locale code: exists in locales table
```

### 4. References

```
Before attaching section to page:
→ Verify sectionDefId exists
→ Verify pageId exists
→ Check sortOrder is valid (>=0)
```

## Post-Mutation Validation

After EVERY mutation, verify:

### 1. Resource Created/Updated

```
After create:
→ Verify resource exists with correct ID
→ Verify all fields match input
→ Check auto-generated fields (createdAt, updatedAt)

After update:
→ Verify changes applied
→ Check no unintended side effects
```

### 2. Side Effects

```
Check expected side effects occurred:
- Vector index updated
- Timestamps updated
- Related records updated (if applicable)
```

### 3. Constraints Still Satisfied

```
Verify no constraint violations:
- Uniqueness maintained
- Foreign keys valid
- Required fields present
```

## Validation Results

### Success

```
✅ Validation passed
→ Proceed to next step
→ Confirm to user
```

### Failure

```
❌ Validation failed
→ Treat as tool error
→ Analyze cause
→ Retry with corrections (max 2 attempts)
```

## Validation Tools

Use these for validation:

### Existence Checks
- cms.getPage(id|slug)
- cms.findResource(query, type)
- cms.listPages(), cms.listSections(), etc.

### Constraint Checks
- cms.findResource (fuzzy search for duplicates)
- Regex validation for slug format
- Type checking for required fields

### Schema Validation
- cms.validatePlan (preflight checks)
- Check elements_structure matches schema
- Verify content keys match slot keys

## Validation Failures

Common causes:

1. **Missing Required Field**
   - Ask user for information
   - Use sensible default if applicable

2. **Constraint Violation**
   - Suggest alternative value
   - Ask user to choose

3. **Invalid Reference**
   - Use fuzzy search to find valid reference
   - List available options

4. **Format Error**
   - Correct format automatically if possible
   - Otherwise, ask user for correction

## Validation Strategies

### Optimistic Validation

For low-risk operations:
```
1. Execute tool
2. Validate result
3. If fails, rollback if possible
```

### Pessimistic Validation

For high-risk operations:
```
1. Pre-validate all constraints
2. Get user confirmation
3. Execute tool
4. Post-validate result
```

### Incremental Validation

For multi-step operations:
```
1. Validate step 1 → Execute → Validate result
2. Validate step 2 → Execute → Validate result
3. Continue until complete
```
