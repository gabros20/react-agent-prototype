import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Handlebars from 'handlebars'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface CompositionContext {
  mode: AgentMode
  maxSteps: number
  toolsList: string[]
  toolCount: number
  complexityLevel?: 'simple' | 'complex'
  currentDate?: string
  sessionId?: string
  traceId?: string
  [key: string]: unknown
}

export type AgentMode = 'architect' | 'cms-crud' | 'debug' | 'ask'

export class PromptComposer {
  private cache = new Map<string, string>()
  private promptsDir: string
  private cacheEnabled: boolean

  constructor(promptsDir?: string, enableCache = true) {
    this.promptsDir = promptsDir || path.join(__dirname, '..')
    this.cacheEnabled = enableCache

    // Register Handlebars helpers
    this.registerHelpers()
  }

  /**
   * Register Handlebars helper functions
   */
  private registerHelpers(): void {
    // Helper: Format tool list as markdown
    Handlebars.registerHelper('formatTools', (tools: string[]) => {
      if (!Array.isArray(tools)) return ''
      return tools.map((t) => `- ${t}`).join('\n')
    })

    // Helper: Conditional rendering
    Handlebars.registerHelper('ifEquals', function (
      this: unknown,
      arg1: unknown,
      arg2: unknown,
      options: Handlebars.HelperOptions
    ) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this)
    })
  }

  /**
   * Load prompt file with caching
   */
  private load(relativePath: string): string {
    const cacheKey = relativePath

    // Check cache
    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    // Load from filesystem
    const fullPath = path.join(this.promptsDir, relativePath)

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Prompt file not found: ${fullPath}`)
    }

    const content = fs.readFileSync(fullPath, 'utf-8')

    // Cache it
    if (this.cacheEnabled) {
      this.cache.set(cacheKey, content)
    }

    return content
  }

  /**
   * Compose complete system prompt for given mode
   */
  composeSystemPrompt(context: CompositionContext): string {
    // Build list of component files
    const parts: string[] = []

    // 1. Core components (always included)
    parts.push('core/identity.xml')
    parts.push('core/capabilities.xml')
    parts.push('core/universal-rules.xml')
    parts.push('components/react-pattern.md')

    // 2. Mode-specific instructions
    parts.push(`modes/${context.mode}.xml`)

    // 3. Shared components
    parts.push('components/tool-usage.md')
    parts.push('components/output-format.md')

    // 4. Mode-specific components
    if (context.mode === 'cms-crud') {
      parts.push('components/error-handling.md')
      parts.push('components/validation.md')

      // Add examples for CRUD
      parts.push('examples/few-shot-create.xml')
      parts.push('examples/few-shot-update.xml')
    } else if (context.mode === 'architect') {
      // Architect mode uses planning tools, less verbose
    } else if (context.mode === 'debug') {
      parts.push('components/error-handling.md')
    } else if (context.mode === 'ask') {
      // Ask mode is read-only, minimal components
    }

    // 5. Complexity-based additions
    if (context.complexityLevel === 'complex') {
      // Future: Add multi-step examples
    }

    // Load all parts
    const sections = parts
      .map((p) => {
        try {
          return this.load(p)
        } catch (error) {
          console.warn(`Skipping missing prompt file: ${p}`)
          return ''
        }
      })
      .filter((s) => s.length > 0)

    // Concatenate with separators
    const template = sections.join('\n\n---\n\n')

    // Inject variables
    return this.injectVariables(template, context)
  }

  /**
   * Inject variables into template using Handlebars
   */
  private injectVariables(template: string, context: CompositionContext): string {
    // Enrich context with computed values
    const enriched = {
      ...context,
      currentDate: context.currentDate || new Date().toISOString().split('T')[0],
      toolCount: context.toolsList.length,
      toolsFormatted: context.toolsList.map((t) => `- ${t}`).join('\n')
    }

    // Compile and render
    const compiled = Handlebars.compile(template)
    return compiled(enriched)
  }

  /**
   * Clear cache (useful for development hot-reload)
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[]; enabled: boolean } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      enabled: this.cacheEnabled
    }
  }

  /**
   * Preload all prompt files (warmup cache)
   */
  async warmup(): Promise<void> {
    const allFiles = [
      'core/identity.xml',
      'core/capabilities.xml',
      'core/universal-rules.xml',
      'components/react-pattern.md',
      'components/tool-usage.md',
      'components/error-handling.md',
      'components/validation.md',
      'components/output-format.md',
      'modes/architect.xml',
      'modes/cms-crud.xml',
      'modes/debug.xml',
      'modes/ask.xml',
      'examples/few-shot-create.xml',
      'examples/few-shot-update.xml'
    ]

    for (const file of allFiles) {
      try {
        this.load(file)
      } catch (error) {
        console.warn(`Warmup: Could not load ${file}`)
      }
    }
  }
}

// Singleton instance (cached)
export const promptComposer = new PromptComposer()

// Helper to compose system prompt (convenience function)
export function getSystemPrompt(context: CompositionContext): string {
  return promptComposer.composeSystemPrompt(context)
}
