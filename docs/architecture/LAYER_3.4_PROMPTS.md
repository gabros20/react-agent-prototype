# Layer 3.4: Prompt System

> Modular system prompt composition with XML modules and Handlebars injection

## Overview

The prompt system defines how the agent thinks and behaves. The implementation uses **modular XML files** that are composed at startup and compiled with Handlebars for dynamic injection. The prompt is regenerated for each agent call via the `prepareCall` hook.

**Key Files:**
- `server/agent/system-prompt.ts` - Prompt composition and compilation
- `server/prompts/core/base-rules.xml` - Identity, ReAct pattern, working memory
- `server/prompts/workflows/cms-pages.xml` - Page and section management
- `server/prompts/workflows/cms-images.xml` - Image handling and display
- `server/prompts/workflows/cms-posts.xml` - Blog post lifecycle
- `server/prompts/workflows/cms-navigation.xml` - Navigation management
- `server/prompts/workflows/web-research.xml` - Exa AI web research

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
┌───────────────────────────────────────────────────────────────────┐
│                       Modular Prompt System                       │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  server/prompts/                                                  │
│  ├── core/                                                        │
│  │   └── base-rules.xml          ← Identity, ReAct, Working Mem   │
│  └── workflows/                                                   │
│      ├── cms-pages.xml           ← Page/section CRUD              │
│      ├── cms-images.xml          ← Image handling                 │
│      ├── cms-posts.xml           ← Blog lifecycle                 │
│      ├── cms-navigation.xml      ← Navigation                     │
│      └── web-research.xml        ← Exa AI research                │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │               loadPromptModules() at startup                │  │
│  │                                                             │  │
│  │   Reads all XML files in order, concatenates into:          │  │
│  │   <agent>\n{module1}\n\n{module2}\n\n...\n</agent>          │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                               │                                   │
│                               ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Handlebars.compile() - cached                  │  │
│  │                                                             │  │
│  │   compiledTemplate = Handlebars.compile(composedXML)        │  │
│  │   (lazy-loaded once, reused across all calls)               │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                               │                                   │
│                               ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │           getSystemPrompt() in prepareCall                  │  │
│  │                                                             │  │
│  │   Context: {                                                │  │
│  │     currentDate: "2025-01-15",                              │  │
│  │     workingMemory: "[entities in context]"                  │  │
│  │   }                                                         │  │
│  │                                                             │  │
│  │   Returns: compiled prompt with working memory injected     │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## Prompt Structure

### Module Composition

```typescript
// server/agent/system-prompt.ts
const PROMPT_MODULES = [
  "core/base-rules.xml",        // Identity, ReAct loop, confirmations
  "workflows/cms-pages.xml",    // Page and section management
  "workflows/cms-images.xml",   // Image handling and display
  "workflows/cms-posts.xml",    // Blog post management
  "workflows/cms-navigation.xml", // Navigation management
  "workflows/web-research.xml",   // Exa AI web research
] as const;

function loadPromptModules(): string {
  const promptsDir = path.join(__dirname, "../prompts");

  const modules = PROMPT_MODULES.map((modulePath) => {
    const fullPath = path.join(promptsDir, modulePath);
    return fs.readFileSync(fullPath, "utf-8");
  }).filter(Boolean);

  return `<agent>\n${modules.join("\n\n")}\n</agent>`;
}
```

### Composed Structure

```xml
<agent>
  <!-- From core/base-rules.xml -->
  <base-rules>
    <identity>Role, expertise, personality</identity>
    <working-memory>{{{workingMemory}}}</working-memory>
    <react-pattern>Think → Act → Observe → Repeat</react-pattern>
    <reasoning-rules>Critical rules</reasoning-rules>
    <reference-resolution>Entity references</reference-resolution>
    <confirmation-workflow>Destructive ops</confirmation-workflow>
  </base-rules>

  <!-- From workflows/cms-pages.xml -->
  <cms-pages>Page CRUD patterns, section management</cms-pages>

  <!-- From workflows/cms-images.xml -->
  <cms-images>Image search, display rules, CRITICAL URL handling</cms-images>

  <!-- From workflows/cms-posts.xml -->
  <cms-posts>Blog lifecycle: draft → publish → archive</cms-posts>

  <!-- From workflows/cms-navigation.xml -->
  <cms-navigation>Menu structure management</cms-navigation>

  <!-- From workflows/web-research.xml -->
  <web-research>Exa AI web research patterns</web-research>
</agent>
```

---

## Dynamic Injection Points

### Handlebars Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `{{{workingMemory}}}` | WorkingContext.toContextString() | Current entity memory |
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
// server/agent/system-prompt.ts
import Handlebars from "handlebars";

export interface SystemPromptContext {
  currentDate: string;
  workingMemory?: string;
}

let compiledTemplate: ReturnType<typeof Handlebars.compile> | null = null;

export function getSystemPrompt(context: SystemPromptContext): string {
  // Lazy load and compile template once
  if (!compiledTemplate) {
    const template = loadPromptModules();
    compiledTemplate = Handlebars.compile(template);
  }

  return compiledTemplate({
    ...context,
    workingMemory: context.workingMemory || "",
  });
}
```

### Usage in prepareCall

```typescript
// server/agent/cms-agent.ts
prepareCall: ({ options, ...settings }) => {
  const dynamicInstructions = getSystemPrompt({
    currentDate: new Date().toISOString().split("T")[0],
    workingMemory: options.workingMemory || "",
  });

  return {
    ...settings,
    instructions: dynamicInstructions,
    // ...
  };
},
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
  Before attaching, check section fields:
  cms_getSectionFields({ id: "section-def-id" })
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

  ACT: cms_getSectionFields({ id: "hero-def-id" })

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

## Module Files

### core/base-rules.xml

Contains fundamental agent behavior:

```xml
<base-rules>
  <identity>
    You are an autonomous AI assistant using the ReAct pattern.
    Your expertise: Content management, data modeling, multi-step workflows
    Your personality: Confident, transparent, careful with destructive ops
  </identity>

  <CRITICAL-IMAGE-RULE>
    Image URLs from tools start with `/uploads/...` - LOCAL PATHS!
    YOU MUST USE THE PATH EXACTLY AS RETURNED. DO NOT ADD ANYTHING.
    ✅ CORRECT: `![Alt](/uploads/images/2025/12/01/original/abc.jpg)`
    ❌ WRONG: `![Alt](https://uploads/images/...)` ← BREAKS IMAGE!
  </CRITICAL-IMAGE-RULE>

  <working-memory>
    {{{workingMemory}}}
  </working-memory>

  <react-pattern>
    **THE REACT LOOP: Think → Act → Observe → Repeat**
    COMPLETION: Prefix final response with FINAL_ANSWER:
  </react-pattern>

  <confirmation-workflow>
    Destructive tools have `confirmed` parameter
    First call returns requiresConfirmation: true
    Ask user, then call with confirmed: true
  </confirmation-workflow>
</base-rules>
```

### workflows/cms-images.xml

Critical image handling rules:

```xml
<cms-images>
  <CRITICAL-IMAGE-RULE>
    Local paths ONLY. Never add https:// to /uploads/ paths.
  </CRITICAL-IMAGE-RULE>

  <image-display>
    **{filename}**
    ![{description}]({url})   ← EXACT url from tool
    {description}
    Tags: {tags}
  </image-display>

  <semantic-search>
    Lower scores = better matches
    -0.3 or better = strong match
  </semantic-search>
</cms-images>
```

### workflows/cms-posts.xml

Blog post lifecycle:

```xml
<cms-posts>
  <states>
    DRAFT → PUBLISHED → ARCHIVED → DELETED
  </states>

  <transitions>
    Draft → Published: cms_publishPost
    Published → Archived: cms_archivePost
    Any → Deleted: cms_deletePost (confirmed: true)
  </transitions>
</cms-posts>
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

### Why Modular Structure?

| Approach | Tradeoff |
|----------|----------|
| Single file (`react.xml`) | Hard to maintain, conflicts on merge |
| Modular XML files | Easy to update individual workflows |

Benefits:
1. **Separation of concerns** - Each workflow is self-contained
2. **Easier updates** - Change images.xml without touching posts.xml
3. **Team collaboration** - Less merge conflicts
4. **Testability** - Can test individual modules

### Why Lazy Compilation?

```typescript
let compiledTemplate: ReturnType<typeof Handlebars.compile> | null = null;

export function getSystemPrompt(context: SystemPromptContext): string {
  if (!compiledTemplate) {
    const template = loadPromptModules();
    compiledTemplate = Handlebars.compile(template);
  }
  return compiledTemplate(context);
}
```

1. **Performance** - Files read once at startup
2. **Hot reload** - Call `reloadPromptModules()` during dev
3. **Memory** - Single compiled template reused

### Why Handlebars?

| Alternative | Issue |
|-------------|-------|
| String interpolation | Hard to read, no helpers |
| Template literals | Can't iterate, limited |
| Jinja2 | Python ecosystem |
| Handlebars | JS native, simple, sufficient |

### Why prepareCall for Injection?

The `ToolLoopAgent` is a module-level singleton. At construction time:
- No working memory exists yet
- No session context
- Date would be fixed to server start

`prepareCall` runs per-call, allowing dynamic injection of:
- Working memory entities
- Current date
- Any call-specific context

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
