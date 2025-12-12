/**
 * Tool Prompt Injector - Loads and formats tool-specific prompts
 *
 * Responsible for:
 * - Loading tool prompts from XML files
 * - Deduplicating tool prompts (O(1) lookup)
 * - Caching loaded prompts (dev: hot-reload, prod: cached)
 * - Formatting for injection into <tool-usage-instructions>
 *
 * IMPROVEMENT: Deduplication prevents loading same prompt twice
 * when tool appears in both persisted and current discovered lists.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== 'production';

// ============================================================================
// Cache
// ============================================================================

/** Cache for loaded tool prompts (production only) */
const promptCache = new Map<string, string | null>();

/** Path to tool prompts directory */
const TOOL_PROMPTS_DIR = path.join(__dirname, '../tools');

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Load a single tool prompt from disk
 *
 * @param toolName - Name of the tool
 * @returns Prompt content or null if no file exists
 */
function loadToolPromptFromDisk(toolName: string): string | null {
  const promptPath = path.join(TOOL_PROMPTS_DIR, `${toolName}-prompt.xml`);

  if (!fs.existsSync(promptPath)) {
    return null; // Tool doesn't have a prompt file (schema + description sufficient)
  }

  return fs.readFileSync(promptPath, 'utf-8');
}

/**
 * Get tool prompt with caching
 *
 * Dev mode: Always reads from disk (hot-reload)
 * Prod mode: Caches after first load
 */
export function getToolPrompt(toolName: string): string | null {
  // Dev mode: always fresh from disk
  if (isDev) {
    return loadToolPromptFromDisk(toolName);
  }

  // Prod mode: check cache
  if (!promptCache.has(toolName)) {
    promptCache.set(toolName, loadToolPromptFromDisk(toolName));
  }

  return promptCache.get(toolName) ?? null;
}

// ============================================================================
// Tool Prompt Injector Class
// ============================================================================

export class ToolPromptInjector {
  /** Set of tool names already loaded in this injection */
  private loadedTools: Set<string> = new Set();
  /** Accumulated prompts */
  private prompts: string[] = [];

  /**
   * Add tools to be injected.
   * Deduplicates automatically - calling with same tool twice is safe.
   *
   * @param toolNames - Array of tool names to add
   * @returns this (for chaining)
   */
  addTools(toolNames: string[]): this {
    for (const name of toolNames) {
      // Skip if already loaded (deduplication)
      if (this.loadedTools.has(name)) {
        continue;
      }

      const prompt = getToolPrompt(name);
      if (prompt) {
        this.prompts.push(prompt.trim());
        this.loadedTools.add(name);
      } else {
        // Tool has no prompt file - still mark as loaded to avoid re-checking
        this.loadedTools.add(name);
      }
    }

    return this;
  }

  /**
   * Add core tools (always available tools)
   *
   * @param coreTools - Array of core tool names
   * @returns this (for chaining)
   */
  addCoreTools(coreTools: string[]): this {
    return this.addTools(coreTools);
  }

  /**
   * Add discovered tools (from searchTools results)
   *
   * @param discoveredTools - Array of discovered tool names
   * @returns this (for chaining)
   */
  addDiscoveredTools(discoveredTools: string[]): this {
    return this.addTools(discoveredTools);
  }

  /**
   * Build the combined prompt string for injection
   *
   * @returns Combined prompts separated by newlines
   */
  build(): string {
    return this.prompts.join('\n\n');
  }

  /**
   * Get list of tools that were actually loaded (had prompt files)
   */
  getLoadedTools(): string[] {
    return [...this.loadedTools].filter(name => {
      // Only return tools that actually had prompts
      return this.prompts.some(p => p.includes(`<${name}>`));
    });
  }

  /**
   * Get all tool names that were processed (including those without prompts)
   */
  getProcessedTools(): string[] {
    return [...this.loadedTools];
  }

  /**
   * Check if any prompts were loaded
   */
  hasPrompts(): boolean {
    return this.prompts.length > 0;
  }

  /**
   * Reset the injector for reuse
   */
  reset(): this {
    this.loadedTools.clear();
    this.prompts = [];
    return this;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick function to get prompts for multiple tools
 * Creates a new injector, adds tools, and returns the result.
 *
 * @param toolNames - Array of tool names
 * @returns Combined prompt string
 */
export function getToolPrompts(toolNames: string[]): string {
  return new ToolPromptInjector()
    .addTools(toolNames)
    .build();
}

/**
 * List all available tool prompt files
 */
export function listAvailableToolPrompts(): string[] {
  if (!fs.existsSync(TOOL_PROMPTS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(TOOL_PROMPTS_DIR)
    .filter(file => file.endsWith('-prompt.xml'))
    .map(file => file.replace('-prompt.xml', ''));
}

/**
 * Clear the prompt cache (useful for testing)
 */
export function clearToolPromptCache(): void {
  promptCache.clear();
}
