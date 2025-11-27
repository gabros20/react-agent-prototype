# Layer 7.2: Template Registry

> Auto-discovery of section templates, variant resolution, fallback handling

## Overview

The Template Registry is an auto-generated catalog of available section templates and their variants. On startup, it scans the `sections/` directory, discovers template types (hero, feature, cta, etc.), and catalogs their variants (default, centered, grid, etc.). This enables runtime template resolution with graceful fallbacks.

**Key Responsibilities:**

-   Scan `sections/` directory on startup
-   Catalog template types and variants
-   Resolve template paths at render time
-   Provide fallback for missing variants
-   Expose registry for health checks

---

## The Problem

Without a template registry:

```typescript
// WRONG: Hardcoded template paths
const templatePath = `sections/${type}/default.njk`;
// No variant support, no fallback

// WRONG: Manual template list
const templates = ["hero", "feature", "cta"];
// Easy to forget new templates

// WRONG: No fallback
const path = `sections/${type}/${variant}.njk`;
// Crashes if variant doesn't exist

// WRONG: No discoverability
// Can't know what templates are available
```

**Our Solution:**

1. Auto-discover templates from filesystem
2. Build registry with types and variants
3. Resolve with fallback to `default` variant
4. Fallback to `_default.njk` for unknown types
5. Expose registry via health endpoint

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    TEMPLATE REGISTRY                             │
│                                                                  │
│  Startup: buildRegistry()                                        │
│       │                                                          │
│       ▼                                                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                 Directory Scan                             │  │
│  │                                                            │  │
│  │  sections/                                                 │  │
│  │  ├── hero/                                                 │  │
│  │  │   ├── default.njk                                       │  │
│  │  │   └── centered.njk                                      │  │
│  │  ├── feature/                                              │  │
│  │  │   └── default.njk                                       │  │
│  │  ├── cta/                                                  │  │
│  │  │   └── default.njk                                       │  │
│  │  ├── image-text/                                           │  │
│  │  │   └── default.njk                                       │  │
│  │  ├── header/                                               │  │
│  │  │   └── default.njk                                       │  │
│  │  └── footer/                                               │  │
│  │      └── default.njk                                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                        │                                         │
│                        ▼                                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                 Registry Structure                         │  │
│  │                                                            │  │
│  │  {                                                         │  │
│  │    "hero": {                                               │  │
│  │      variants: ["default", "centered"],                    │  │
│  │      path: "sections/hero"                                 │  │
│  │    },                                                      │  │
│  │    "feature": {                                            │  │
│  │      variants: ["default"],                                │  │
│  │      path: "sections/feature"                              │  │
│  │    },                                                      │  │
│  │    "cta": { ... },                                         │  │
│  │    "image-text": { ... },                                  │  │
│  │    "header": { ... },                                      │  │
│  │    "footer": { ... }                                       │  │
│  │  }                                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                        │                                         │
│                        ▼                                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │               Template Resolution                          │  │
│  │                                                            │  │
│  │  resolveTemplate("hero", "centered")                       │  │
│  │       │                                                    │  │
│  │       ├── Check registry["hero"]                           │  │
│  │       ├── Check variants.includes("centered")              │  │
│  │       └── Return "sections/hero/centered.njk"              │  │
│  │                                                            │  │
│  │  resolveTemplate("hero", "unknown")                        │  │
│  │       │                                                    │  │
│  │       ├── Variant not found                                │  │
│  │       └── Fallback to "sections/hero/default.njk"          │  │
│  │                                                            │  │
│  │  resolveTemplate("unknown-type", "default")                │  │
│  │       │                                                    │  │
│  │       ├── Type not in registry                             │  │
│  │       └── Fallback to "sections/_default.njk"              │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File                                     | Purpose                          |
| ---------------------------------------- | -------------------------------- |
| `server/services/renderer.ts`            | Registry building and resolution |
| `server/templates/sections/`             | Template directory to scan       |
| `server/templates/sections/_default.njk` | Fallback template                |

---

## Core Implementation

### Registry Interface

```typescript
// server/services/renderer.ts
export interface TemplateRegistry {
	[templateKey: string]: {
		variants: string[];
		path: string;
	};
}
```

### Building the Registry

```typescript
export class RendererService {
	private templateRegistry: TemplateRegistry = {};

	constructor(private templateDir: string) {
		// ... engine setup
		this.buildRegistry();
	}

	private buildRegistry() {
		const sectionsDir = path.join(this.templateDir, "sections");

		if (!fs.existsSync(sectionsDir)) {
			console.warn("Sections directory not found:", sectionsDir);
			return;
		}

		// Get all subdirectories (template types)
		const templateKeys = fs
			.readdirSync(sectionsDir, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => dirent.name);

		// For each type, discover variants
		for (const templateKey of templateKeys) {
			const templatePath = path.join(sectionsDir, templateKey);

			// Find all .njk files in the directory
			const variants = fs
				.readdirSync(templatePath)
				.filter((file) => file.endsWith(".njk"))
				.map((file) => file.replace(".njk", ""));

			this.templateRegistry[templateKey] = {
				variants,
				path: `sections/${templateKey}`,
			};
		}

		console.log("✅ Template registry built:", this.templateRegistry);
	}
}
```

### Template Resolution

```typescript
private resolveTemplate(templateKey: string, variant: string): string {
  const registry = this.templateRegistry[templateKey];

  // Type not found - use global fallback
  if (!registry) {
    console.warn(`Template not found: ${templateKey}, using fallback`);
    return "sections/_default.njk";
  }

  // Variant not found - use default variant
  if (!registry.variants.includes(variant)) {
    console.warn(`Variant '${variant}' not found for ${templateKey}, using default`);
    variant = "default";
  }

  return `${registry.path}/${variant}.njk`;
}
```

### Usage in Rendering

```typescript
async renderPage(pageSlug: string, locale: string, pageService: PageService): Promise<string> {
  const page = await pageService.getPageBySlug(pageSlug, true, locale);

  const sectionHtmlList: string[] = [];

  for (const pageSection of page.pageSections) {
    const sectionDef = pageSection.sectionDefinition;
    const templateKey = sectionDef.templateKey;
    const variant = sectionDef.defaultVariant || "default";

    // Resolve template with fallback
    const templatePath = this.resolveTemplate(templateKey, variant);

    const sectionHtml = this.env.render(templatePath, {
      ...pageSection.content,
      sectionKey: sectionDef.key,
      locale,
    });

    sectionHtmlList.push(sectionHtml);
  }

  return this.env.render("layout/page.njk", { ... });
}
```

### Exposing Registry

```typescript
getTemplateRegistry(): TemplateRegistry {
  return this.templateRegistry;
}

// In preview.ts
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    templateRegistry: renderer.getTemplateRegistry(),
  });
});
```

---

## Design Decisions

### Why Auto-Discovery?

```typescript
const templateKeys = fs
	.readdirSync(sectionsDir, { withFileTypes: true })
	.filter((dirent) => dirent.isDirectory())
	.map((dirent) => dirent.name);
```

**Reasons:**

1. **Zero config** - New templates automatically available
2. **No manual updates** - Registry always in sync
3. **Less errors** - Can't forget to register templates
4. **Convention-based** - Directory structure is the API

### Why Directory-Per-Type Structure?

```
sections/
├── hero/
│   ├── default.njk
│   └── centered.njk
├── feature/
│   └── default.njk
```

**Reasons:**

1. **Organization** - Related variants grouped together
2. **Discovery** - Easy to see all variants for a type
3. **Isolation** - Type-specific assets can live alongside
4. **Consistency** - Predictable structure

### Why Fallback to Default Variant?

```typescript
if (!registry.variants.includes(variant)) {
	console.warn(`Variant not found, using default`);
	variant = "default";
}
```

**Reasons:**

1. **Graceful degradation** - Page still renders
2. **Development flexibility** - Can reference future variants
3. **Error visibility** - Warning logged, not crash
4. **Convention** - Every type must have `default.njk`

### Why Global \_default.njk Fallback?

```typescript
if (!registry) {
	return "sections/_default.njk";
}
```

**Reasons:**

1. **Never crash** - Even unknown types render something
2. **Development aid** - Shows "Section not found" message
3. **Migration support** - Old section types gracefully degrade
4. **Debugging** - Obvious when template is missing

---

## Integration Points

| Connects To                 | How                                       |
| --------------------------- | ----------------------------------------- |
| Layer 7.1 (Nunjucks Engine) | Uses env.render()                         |
| Layer 7.3 (Page Rendering)  | Provides template paths                   |
| Layer 7.6 (Preview Server)  | Exposes registry via health               |
| Database                    | Section definitions reference templateKey |

### Example Registry Output

```json
{
	"hero": {
		"variants": ["default", "centered"],
		"path": "sections/hero"
	},
	"feature": {
		"variants": ["default"],
		"path": "sections/feature"
	},
	"cta": {
		"variants": ["default"],
		"path": "sections/cta"
	},
	"image-text": {
		"variants": ["default"],
		"path": "sections/image-text"
	},
	"header": {
		"variants": ["default"],
		"path": "sections/header"
	},
	"footer": {
		"variants": ["default"],
		"path": "sections/footer"
	}
}
```

### Template Path Resolution Examples

| Input                | Output                                    |
| -------------------- | ----------------------------------------- |
| `hero`, `default`    | `sections/hero/default.njk`               |
| `hero`, `centered`   | `sections/hero/centered.njk`              |
| `hero`, `unknown`    | `sections/hero/default.njk` (fallback)    |
| `unknown`, `default` | `sections/_default.njk` (global fallback) |

---

## Common Issues / Debugging

### Template Not Found

```
// Section renders with fallback
```

**Cause:** Directory doesn't exist or not scanned.

**Debug:**

```bash
ls -la server/templates/sections/
# Check if directory exists

curl http://localhost:4000/health | jq .templateRegistry
# Check what's in registry
```

### Variant Not Applied

```
// Always renders default, not requested variant
```

**Cause:** Variant file doesn't exist or wrong name.

**Debug:**

```bash
ls server/templates/sections/hero/
# Should show: default.njk, centered.njk, etc.
```

### New Template Not Discovered

```
// Added new section type but not rendering
```

**Cause:** Server not restarted after adding directory.

**Fix:** In development, restart the preview server:

```bash
# Kill and restart
pnpm preview
```

### Registry Empty

```
// Health shows empty templateRegistry
```

**Cause:** Sections directory path wrong.

**Debug:**

```typescript
// In renderer.ts
console.log("Template dir:", this.templateDir);
console.log("Sections dir:", path.join(this.templateDir, "sections"));
```

---

## Further Reading

-   [Layer 7.1: Nunjucks Engine](./LAYER_7.1_NUNJUCKS_ENGINE.md) - Engine setup
-   [Layer 7.3: Page Rendering](./LAYER_7.3_PAGE_RENDERING.md) - Using registry
-   [Layer 7.4: Section Templates](./LAYER_7.4_SECTION_TEMPLATES.md) - Template structure
