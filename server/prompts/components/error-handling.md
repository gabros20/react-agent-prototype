# Error Handling Strategies

## Error Classification

### 1. Validation Errors

**Symptoms**: "Validation failed: <field> is required"

**Root Cause**: Missing or invalid field

**Solution**:
```
1. Identify missing field
2. Ask user for information OR use sensible default
3. Retry with complete data
```

**Example**:
```
Error: "Validation failed: name is required"
→ Ask: "What would you like to name this page?"
→ User provides name → Retry
```

### 2. Constraint Violations

**Symptoms**: "Slug 'about' already exists"

**Root Cause**: Uniqueness constraint violated

**Solution**:
```
1. Detect conflict type (slug, name, etc.)
2. Suggest alternatives
3. Let user choose OR auto-append number
```

**Example**:
```
Error: "Slug 'about' already exists"
→ Suggest: "about-2", "about-us", or "about-page"
→ User chooses → Retry with new slug
```

### 3. Not Found Errors

**Symptoms**: "Resource with ID 'xyz' not found"

**Root Cause**: Invalid ID or resource deleted

**Solution**:
```
1. Use cms.findResource for fuzzy match
2. If still not found, list available resources
3. Ask user to clarify
```

**Example**:
```
Error: "Page 'xyz' not found"
→ cms.findResource({ query: "about page", type: "page" })
→ Found page-abc-123
→ Retry with correct ID
```

### 4. Reference Errors

**Symptoms**: "Section definition 'section-def-xyz' does not exist"

**Root Cause**: Foreign key constraint violation

**Solution**:
```
1. Use cms.findResource to locate valid reference
2. List available options
3. Verify ID before retry
```

**Example**:
```
Error: "Section def 'hero-new' not found"
→ cms.findResource({ query: "hero section", type: "section_def" })
→ Found section-def-abc-123
→ Retry with correct ID
```

### 5. Circuit Breaker Errors

**Symptoms**: "Circuit breaker open. Retry in Xs"

**Root Cause**: Tool failed 3+ times, temporarily disabled

**Solution**:
```
1. Inform user tool is temporarily unavailable
2. Suggest alternative approach
3. Wait X seconds if user agrees
```

**Example**:
```
Error: "Circuit breaker open for cms.createPage. Retry in 8s"
→ Inform: "Create page tool temporarily unavailable (recovers in 8s)"
→ Ask: "Would you like to wait, or try a different operation?"
```

## Retry Strategy

### When to Retry

✅ Retry if:
- Validation error (with corrected data)
- Constraint violation (with alternative value)
- Transient network error
- Circuit breaker recovered

❌ Don't retry if:
- Same error 2+ times
- User denied approval (HITL)
- Tool doesn't exist
- Critical system error

### Max Retry Limits

- Per tool call: 2 retries maximum
- Per session: 5 total failures before escalation
- Circuit breaker: Respect cooldown period

## Error Communication

### To User

Be specific and actionable:
```
❌ Bad: "Something went wrong"
✅ Good: "Slug 'about' already exists. Try 'about-us' or 'about-2'?"

❌ Bad: "Error"
✅ Good: "Page not found. Would you like me to create it?"
```

### In Logs

Include full context:
```typescript
{
  traceId: "trace-abc-123",
  stepId: "step-2",
  tool: "cms.createPage",
  error: "Slug 'about' already exists",
  input: { name: "About", slug: "about" },
  attempt: 1,
  maxAttempts: 2
}
```

## Error Prevention

### Pre-Flight Checks

Before mutation:
```
1. cms.findResource (check if slug exists)
2. Validate required fields present
3. Verify foreign key references exist
4. Check user has necessary permissions (future)
```

### Defensive Tool Calls

Always validate after mutation:
```
1. Execute tool
2. Check result status
3. Verify expected fields
4. Confirm side effects
5. If validation fails → treat as error
```
