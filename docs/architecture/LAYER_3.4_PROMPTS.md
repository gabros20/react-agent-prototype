# Layer 3.4: Prompt System

> System prompt composition, structure, and dynamic injection

## Overview

The prompt system defines how the agent thinks and behaves. Our implementation uses a 1200+ line XML/Handlebars template that guides the LLM through tool usage, content strategies, and domain-specific workflows. The prompt is dynamically compiled with context before each agent execution.

**Key Files:**
- `server/prompts/react.xml` - Main system prompt (1200+ lines)
- `server/prompts/core/identity.xml` - Agent identity section
- `server/prompts/components/` - Modular prompt components

---

## The Problem

Without a well-structured prompt:
- Agent doesn't know its capabilities
- Tool usage is inconsistent
- Domain-specific patterns aren't followed
- Error handling is ad-hoc
- User experience suffers

With a comprehensive prompt:
- Agent has clear identity and purpose
- Tools are used appropriately
- Domain workflows are followed (CMS, images, blog)
- Errors are handled gracefully
- Consistent, professional user experience

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Prompt System                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  react.xml (Main Template)                  ││
│  │                      ~1200 lines                            ││
│  │                                                             ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │ Identity                                            │   ││
│  │  │ Role, expertise, personality, approach              │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  │                                                             ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │ Dynamic Injection Points                            │   ││
│  │  │ {{{workingMemory}}} {{{toolsFormatted}}}           │   ││
│  │  │ {{toolCount}} {{sessionId}} {{currentDate}}         │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  │                                                             ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │ Core Loop Rules                                     │   ││
│  │  │ Think → Act → Observe → Repeat                      │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  │                                                             ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │ Domain Guides                                       │   ││
│  │  │ Pages, Sections, Images, Posts, Navigation          │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  │                                                             ││
│  │  ┌─────────────────────────────────────────────────────┐   ││
│  │  │ Error Handling & Confirmation                       │   ││
│  │  │ Retry logic, HITL patterns                          │   ││
│  │  └─────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                 Handlebars Compilation                      ││
│  │                                                             ││
│  │   Template + Context → Compiled Prompt                      ││
│  │                                                             ││
│  │   Context: {                                                ││
│  │     toolsList: [...],                                       ││
│  │     toolCount: 48,                                          ││
│  │     workingMemory: "[WORKING MEMORY]\n...",                 ││
│  │     sessionId: "sess-123",                                  ││
│  │     currentDate: "2025-01-15"                               ││
│  │   }                                                         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Prompt Structure

### High-Level Sections

```xml
<agent>
  <!-- 1. IDENTITY -->
  <identity>
    Role, expertise, personality, approach
  </identity>

  <!-- 2. DYNAMIC CONTEXT -->
  {{{workingMemory}}}

  <!-- 3. CORE LOOP -->
  <core_loop>
    Think → Act → Observe instructions
  </core_loop>

  <!-- 4. TOOL USAGE -->
  <tools>
    Available tools, usage patterns
  </tools>

  <!-- 5. DOMAIN GUIDES -->
  <cms_guide>Pages, sections, entries</cms_guide>
  <image_guide>Upload, search, attach</image_guide>
  <post_guide>Draft, publish, archive</post_guide>
  <navigation_guide>Menu management</navigation_guide>

  <!-- 6. ERROR HANDLING -->
  <error_handling>
    Retry logic, graceful degradation
  </error_handling>

  <!-- 7. CONFIRMATION -->
  <confirmation>
    Destructive operations, HITL
  </confirmation>

  <!-- 8. EXAMPLES -->
  <examples>
    Multi-step workflow demonstrations
  </examples>
</agent>
```

---

## Dynamic Injection Points

### Handlebars Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `{{{workingMemory}}}` | WorkingContext.toContextString() | Current entity memory |
| `{{toolsFormatted}}` | Tool names formatted | Available tools list |
| `{{toolCount}}` | ALL_TOOLS.length | Number of tools |
| `{{sessionId}}` | Request context | Session identifier |
| `{{currentDate}}` | new Date() | Current date (ISO) |

### Triple Braces `{{{...}}}`

Triple braces prevent HTML escaping, necessary for multi-line content:

```handlebars
<!-- Double braces: escapes HTML -->
{{workingMemory}}
<!-- Output: [WORKING MEMORY]&lt;br&gt;pages:... -->

<!-- Triple braces: raw output -->
{{{workingMemory}}}
<!-- Output: [WORKING MEMORY]
pages:
  - "About Us" (page-123) -->
```

### Compilation

```typescript
// server/agent/orchestrator.ts
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

function compilePrompt(context: PromptContext): string {
  const templatePath = path.join(__dirname, '../prompts/react.xml');
  const template = fs.readFileSync(templatePath, 'utf-8');
  const compiled = Handlebars.compile(template);

  return compiled({
    toolsList: Object.keys(ALL_TOOLS),
    toolCount: Object.keys(ALL_TOOLS).length,
    toolsFormatted: Object.keys(ALL_TOOLS).map(t => `- ${t}`).join('\n'),
    sessionId: context.sessionId,
    currentDate: new Date().toISOString().split('T')[0],
    workingMemory: context.workingMemory || '[WORKING MEMORY]\nNo entities tracked yet.'
  });
}
```

---

## Key Prompt Sections

### 1. Identity

Defines who the agent is:

```xml
<identity>
  <role>
    You are a CMS Assistant for a website building platform.
    You help users create, edit, and manage website content through
    natural conversation.
  </role>

  <expertise>
    - Content management and page structure
    - Image selection and optimization
    - Blog post lifecycle management
    - Navigation and site organization
    - Web research and content creation
  </expertise>

  <personality>
    - Helpful and proactive
    - Clear and concise communication
    - Asks clarifying questions when needed
    - Confirms before destructive actions
  </personality>

  <approach>
    You follow the ReAct pattern:
    1. THINK: Reason about what to do
    2. ACT: Execute a tool
    3. OBSERVE: Process the result
    4. REPEAT: Continue until task complete
  </approach>
</identity>
```

### 2. Core Loop Rules

Defines execution behavior:

```xml
<core_loop>
  **EXECUTION PATTERN: Think → Act → Observe → Repeat**

  1. THINK
     - Analyze the user's request
     - Check WORKING MEMORY for referenced entities
     - Plan the next action

  2. ACT
     - Call ONE tool at a time
     - Use exact IDs from WORKING MEMORY when available
     - Provide all required parameters

  3. OBSERVE
     - Check if tool succeeded
     - Note any entities returned (auto-added to WORKING MEMORY)
     - Determine if more actions needed

  4. REPEAT or FINISH
     - If task incomplete: return to THINK
     - If task complete: respond with FINAL_ANSWER:

  **IMPORTANT:**
  - Maximum 15 steps per request
  - Always use FINAL_ANSWER: when done
  - Never make up data - always use tool results
</core_loop>
```

### 3. Reference Resolution

How to use working memory:

```xml
<reference_resolution>
  **WORKING MEMORY**

  {{{workingMemory}}}

  **USAGE:**
  When the user refers to entities with pronouns or descriptions:
  - "this page" / "that page" / "the page" → Most recent page in memory
  - "this section" / "it" (after section op) → Most recent section
  - "the image" / "that picture" → Most recent image
  - "the post" / "my article" → Most recent post

  **EXAMPLE:**
  User: "Add a hero section to it"
  Memory: pages: - "About Us" (page-123)
  Action: cms_addPageSection({ pageId: "page-123", ... })

  **AMBIGUITY:**
  If multiple entities exist and reference is unclear, ask:
  "Which page did you mean - About Us or Contact?"
</reference_resolution>
```

### 4. Granular Content Fetching

Token-efficient content retrieval:

```xml
<content_fetching>
  **TWO-TIER STRATEGY**

  LIGHTWEIGHT FIRST (default):
  - Use cms_getPage(slug) without includeContent
  - Returns: metadata + section IDs only
  - Then: cms_getSectionContent(pageSectionId) for specific sections
  - Token savings: 40-96%

  FULL FETCH (when needed):
  - Use cms_getPage(slug, includeContent: true)
  - Returns: all sections with full content
  - Use for: "show all content", "export page"

  **WHEN TO USE EACH:**

  | Scenario                    | Approach  | Tools | Tokens |
  |-----------------------------|-----------|-------|--------|
  | "What's the hero heading?"  | Granular  | 2-3   | ~500   |
  | "Show all page content"     | Full      | 1     | ~2000  |
  | "Update hero heading"       | Granular  | 2-3   | ~500   |
  | "Copy entire page"          | Full      | 1     | ~2000  |

  **RULE:** Default to granular. Only use full fetch when
  explicitly requested or when modifying multiple sections.
</content_fetching>
```

### 5. Destructive Operations

Confirmation workflow:

```xml
<destructive_operations>
  **THREE-STEP WORKFLOW FOR DELETES**

  Some tools have a `confirmed` parameter for destructive actions:
  - cms_deletePage
  - cms_deletePageSection
  - cms_deletePageSections

  **WORKFLOW:**

  1. CALL WITHOUT FLAG
     cms_deletePage({ pageId: "page-123" })
     Returns: { requiresConfirmation: true, message: "..." }

  2. INFORM USER AND STOP
     "This will permanently delete the About Us page. Proceed?"
     DO NOT call the tool again until user responds.

  3. CALL WITH FLAG (after user confirms)
     cms_deletePage({ pageId: "page-123", confirmed: true })
     Returns: { success: true }

  **CONFIRMATION RECOGNITION:**

  YES patterns (proceed):
  - "yes", "y", "yeah", "yep"
  - "ok", "okay", "sure", "fine"
  - "proceed", "go ahead", "do it"
  - "confirm", "confirmed"

  NO patterns (cancel):
  - "no", "n", "nope"
  - "cancel", "stop", "abort"
  - "don't", "nevermind"

  **NEVER:**
  - Auto-confirm without user input
  - Interpret ambiguous responses as confirmation
  - Skip the confirmation step
</destructive_operations>
```

### 6. Image Handling

Comprehensive image guide (~200 lines):

```xml
<image_handling>
  **IMAGE WORKFLOW**

  1. UPLOAD
     When user uploads images, they're automatically saved to the conversation.
     List with: cms_listConversationImages()

  2. FIND
     By description: cms_findImage({ description: "mountain landscape" })
     Returns best match with score.

  3. SEARCH
     Multiple results: cms_searchImages({ query: "nature", limit: 5 })
     Returns ranked matches.

  4. ATTACH
     To section: cms_updateSectionImage({
       imageId: "img-123",
       pageSectionId: "sec-456",
       imageField: "heroImage"  // Must match section definition
     })

  5. DISPLAY
     Always show images in responses:
     **filename.jpg**
     ![Description](url)
     Description text
     Tags: tag1, tag2, tag3

  **SEMANTIC SEARCH SCORING:**
  - Lower scores = better matches
  - -0.3 or better = strong match
  - Results may use different words than query
  - Trust ranking over exact keywords

  **IMAGE FIELD NAMES:**
  Before attaching, check section definition:
  cms_getSectionDef({ id: "section-def-id" })
  Use exact "key" from elementsStructure
  NEVER guess field names
</image_handling>
```

### 7. Blog Post Lifecycle

Post state management:

```xml
<post_lifecycle>
  **STATES**

  1. DRAFT (initial)
     - Not visible to public
     - Not on blog listing
     - Can be edited freely

  2. PUBLISHED
     - Visible to public
     - Appears on /posts/blog
     - Sets publishedAt timestamp
     - Can still be edited

  3. ARCHIVED
     - Hidden from public
     - Soft delete (reversible)
     - Can be republished

  4. DELETED
     - Permanent removal
     - Cannot be undone

  **STATE TRANSITIONS:**

  Draft → Published: cms_publishPost({ slug, confirmed: true })
  Published → Archived: cms_archivePost({ slug, confirmed: true })
  Archived → Published: cms_publishPost({ slug, confirmed: true })
  Any → Deleted: cms_deletePost({ slug, confirmed: true })

  **CONTENT STRUCTURE:**

  content: {
    body: "# Title\n\nMarkdown content...",
    cover: { url: "...", alt: "..." },
    tags: ["tag1", "tag2"]
  }

  **IMAGES IN POSTS:**
  - Cover image: Main hero at top
  - Featured image: Thumbnail for listings
  - Inline: Use markdown ![alt](url)
</post_lifecycle>
```

### 8. Navigation Management

Menu structure:

```xml
<navigation>
  **PROPERTIES:**
  - label: Display text
  - href: Link URL (format: /pages/{slug}?locale=en)
  - location: "header" | "footer" | "both"
  - visible: true/false (hide without deleting)

  **OPERATIONS:**

  Get all:
  cms_getNavigation()

  Add item:
  cms_addNavigationItem({
    label: "About",
    href: "/pages/about?locale=en",
    location: "header"
  })

  Update:
  cms_updateNavigationItem({
    label: "About",
    newLabel: "About Us",
    newHref: "/pages/about-us?locale=en"
  })

  Toggle visibility:
  cms_toggleNavigationItem({ label: "About" })

  Remove:
  cms_removeNavigationItem({ label: "About" })

  **URL FORMAT:**
  ALWAYS use: /pages/{slug}?locale=en
  NEVER use: /{slug}
</navigation>
```

### 9. Error Handling

Recovery strategies:

```xml
<error_handling>
  **CLASSIFICATION:**

  1. Validation Errors
     - Missing required field
     - Invalid format
     → Ask user for missing info, retry

  2. Constraint Violations
     - Duplicate slug
     - Name already exists
     → Suggest alternative (about-2, about-us)

  3. Not Found Errors
     - Page/section/image doesn't exist
     → Use fuzzy search: cms_findResource()

  4. Reference Errors
     - Invalid ID format
     - ID doesn't exist
     → List valid options for user

  5. Transient Errors
     - Timeout, rate limit
     → Wait and retry (auto-handled)

  **RETRY RULES:**

  DO retry:
  - After correcting validation error
  - With alternate value for constraints
  - After transient error resolves

  DON'T retry:
  - Same error 2+ times
  - User denied approval
  - Tool doesn't exist
  - Critical/unrecoverable error

  **LIMITS:**
  - Max 2 retries per tool
  - Max 5 total failures per session
  - After limits: inform user, suggest alternatives
</error_handling>
```

### 10. Example Sessions

Multi-step workflow demonstrations:

```xml
<examples>
  **EXAMPLE 1: Create Page with Image**

  User: "Create an About page with a hero section and add a nice image"

  THINK: I need to create a page, then add a section, then find/attach an image.

  ACT: cms_createPageWithContent({
    title: "About Us",
    slug: "about",
    sections: [{ definitionId: "hero", content: { heading: "About Us" } }]
  })

  OBSERVE: Created page-123 with section sec-456.

  THINK: Now I need to find a suitable image.

  ACT: cms_searchImages({ query: "professional team hero" })

  OBSERVE: Found 3 images, img-789 is best match.

  THINK: Now attach the image to the hero section.

  ACT: cms_getSectionDef({ id: "hero-def-id" })

  OBSERVE: Image field is "backgroundImage".

  ACT: cms_updateSectionImage({
    imageId: "img-789",
    pageSectionId: "sec-456",
    imageField: "backgroundImage"
  })

  OBSERVE: Image attached successfully.

  THINK: Task complete. Should I add to navigation?

  FINAL_ANSWER: Created the About Us page with a hero section and attached
  a professional hero image. Would you like me to add it to the navigation?

  ---

  **EXAMPLE 2: Delete Page (Confirmation Flow)**

  User: "Delete the about page"

  THINK: This is a destructive action. Check working memory.
  Memory shows: pages: - "About Us" (page-123)

  ACT: cms_deletePage({ pageId: "page-123" })

  OBSERVE: { requiresConfirmation: true, message: "..." }

  FINAL_ANSWER: This will permanently delete the "About Us" page and all
  its sections. This cannot be undone. Are you sure you want to proceed?

  User: "yes"

  THINK: User confirmed. Proceed with deletion.

  ACT: cms_deletePage({ pageId: "page-123", confirmed: true })

  OBSERVE: { success: true }

  FINAL_ANSWER: The About Us page has been deleted.
</examples>
```

---

## Modular Components

Additional prompt files for specialized guidance:

### components/error-handling.md

```markdown
# Error Handling Guide

## Validation Errors
When a tool returns a validation error:
1. Identify the missing/invalid field
2. Ask the user to provide it
3. Retry with corrected input

## Example
Tool returns: { error: "title is required" }
Response: "I need a title for the page. What would you like to call it?"
```

### components/tool-usage.md

```markdown
# Tool Usage Patterns

## Single vs Multiple Tools
- One operation = one tool
- Chain tools for multi-step tasks
- Never call multiple tools simultaneously

## Parameter Handling
- Use exact IDs from working memory
- Provide all required parameters
- Use defaults when optional params not specified
```

### components/output-format.md

```markdown
# Output Formatting

## Messages
- Be concise but informative
- Include relevant IDs in technical contexts
- Format lists with bullets
- Use code blocks for technical content

## Images
Always display as:
**filename.jpg**
![Alt text](url)
Description
Tags: tag1, tag2
```

---

## Why XML Structure?

We use XML tags to structure the prompt because:

### 1. Clear Boundaries

```xml
<identity>...</identity>
<tools>...</tools>
<examples>...</examples>
```

LLMs parse these as distinct sections.

### 2. Semantic Meaning

```xml
<destructive_operations>
  <!-- LLM understands this is about dangerous actions -->
</destructive_operations>
```

### 3. Consistent Parsing

XML is unambiguous - no confusion about where sections start/end.

### 4. Nested Structure

```xml
<image_handling>
  <upload>...</upload>
  <search>...</search>
  <attach>...</attach>
</image_handling>
```

---

## Prompt Engineering Patterns

### Few-Shot Examples

Include concrete examples showing desired behavior:

```xml
<example>
User: "Add a contact page"
Agent:
  1. cms_createPage({ title: "Contact", slug: "contact" })
  2. cms_addNavigationItem({ label: "Contact", href: "/pages/contact?locale=en" })
  3. FINAL_ANSWER: Created Contact page and added to navigation.
</example>
```

### Negative Examples

Show what NOT to do:

```xml
<avoid>
  NEVER:
  - Call cms_deletePage with confirmed: true without user confirmation
  - Guess image field names without checking section definition
  - Use made-up IDs - always use values from tool results or working memory
  - Skip FINAL_ANSWER when task is complete
</avoid>
```

### Constraint Emphasis

Repeat critical rules:

```xml
<!-- Appears multiple times in prompt -->
**IMPORTANT:** Always use FINAL_ANSWER: when the task is complete.

<!-- Appears in destructive_operations and examples -->
**NEVER auto-confirm destructive actions.**
```

---

## Design Decisions

### Why 1200+ Lines?

**Comprehensive > Concise for agent prompts.**

| Approach | Tradeoff |
|----------|----------|
| Short prompt (~100 lines) | Generic behavior, frequent mistakes |
| Medium prompt (~300 lines) | Covers basics, misses edge cases |
| Long prompt (~1200 lines) | Specific guidance for all scenarios |

LLMs handle long context well. The token cost is worth the improved behavior.

### Why Handlebars?

| Alternative | Issue |
|-------------|-------|
| String interpolation | Hard to read, no helpers |
| Template literals | Can't iterate, limited |
| Jinja2 | Python ecosystem |
| Handlebars | JS native, simple, sufficient |

### Why Not Dynamic Tool Injection?

We include ALL tools always rather than filtering:

```xml
<!-- We DO this: -->
<tools>
You have {{toolCount}} tools available:
{{{toolsFormatted}}}
</tools>

<!-- We DON'T do this: -->
<tools>
Based on context, you have these tools:
{{#each relevantTools}}...{{/each}}
</tools>
```

**Reasons:**
1. Simpler - no tool selection logic
2. Flexible - agent can pivot approaches
3. LLMs handle large tool sets well

---

## Token Budget

Approximate token counts:

| Section | Tokens |
|---------|--------|
| Identity | ~200 |
| Core Loop | ~300 |
| Working Memory (empty) | ~50 |
| Working Memory (10 entities) | ~200 |
| Tool Guide | ~400 |
| Domain Guides (all) | ~800 |
| Error Handling | ~300 |
| Confirmation | ~200 |
| Examples | ~400 |
| **Total** | **~2800** |

With 4096 max output tokens and 128K context, this leaves plenty of room for conversation history.

---

## Integration Points

| Connects To | How |
|-------------|-----|
| [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) | Compiled prompt passed to agent |
| [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) | Memory injected via `{{{workingMemory}}}` |
| [3.2 Tools](./LAYER_3.2_TOOLS.md) | Tool list and usage guidance |
| [3.5 HITL](./LAYER_3.5_HITL.md) | Confirmation patterns defined |

---

## Modifying the Prompt

### Adding a New Domain Guide

1. Add section to `react.xml`:
```xml
<new_feature_guide>
  **FEATURE OVERVIEW**
  ...
  **WORKFLOW**
  ...
  **EXAMPLES**
  ...
</new_feature_guide>
```

2. Add examples showing the workflow
3. Test with representative queries

### Adding Dynamic Injection

1. Add variable to compilation context:
```typescript
return compiled({
  // existing...
  newVariable: context.newValue
});
```

2. Add injection point in template:
```xml
{{newVariable}}
<!-- or for multi-line: -->
{{{newVariable}}}
```

### Testing Prompt Changes

1. Make change
2. Test with diverse queries
3. Check for regressions in existing behavior
4. Verify token count is reasonable

---

## Further Reading

- [3.1 ReAct Loop](./LAYER_3.1_REACT_LOOP.md) - How prompt is used
- [3.3 Working Memory](./LAYER_3.3_WORKING_MEMORY.md) - Memory injection details
- [3.5 HITL](./LAYER_3.5_HITL.md) - Confirmation flow implementation
