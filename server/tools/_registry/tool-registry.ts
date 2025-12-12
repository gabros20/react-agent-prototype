/**
 * Unified Tool Registry
 *
 * Single source of truth for tool metadata.
 * Loads from per-tool folders at startup, then provides sync access.
 *
 * REPLACES: server/services/search/tool-registry.ts (526 lines of duplicated metadata)
 *
 * Design:
 * - Async initialization: Loads all metadata from per-tool folders once at startup
 * - Sync access: After init, all lookups are O(1) synchronous operations
 * - Single source: No duplication - metadata defined in per-tool folders only
 *
 * Usage:
 *   // At startup (once)
 *   await ToolRegistry.getInstance().initialize();
 *
 *   // Anywhere after (sync)
 *   const registry = ToolRegistry.getInstance();
 *   const tool = registry.get('getPage');           // O(1) sync
 *   const allTools = registry.getAll();             // O(1) sync
 *   const names = registry.getAllNames();           // O(1) sync
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { ToolMetadata, SearchCorpusEntry } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Tool Registry
// ============================================================================

export class ToolRegistry {
  private static instance: ToolRegistry;

  // Internal storage - populated during initialize()
  private readonly toolMap: Map<string, ToolMetadata> = new Map();
  private allMetadataCache: ToolMetadata[] | null = null;
  private allNamesCache: string[] | null = null;
  private searchCorpusCache: SearchCorpusEntry[] | null = null;

  private _initialized = false;
  private readonly toolsDir: string;

  /** Core tools that are always available */
  static readonly CORE_TOOLS = ['searchTools', 'finalAnswer', 'acknowledgeRequest'] as const;

  private constructor() {
    this.toolsDir = path.join(__dirname, '..');
  }

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  // ============================================================================
  // Initialization (async - call once at startup)
  // ============================================================================

  /**
   * Initialize registry by loading all tool metadata.
   * MUST be called once at server startup before any sync access.
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      console.log('[ToolRegistry] Already initialized, skipping');
      return;
    }

    console.log('[ToolRegistry] Loading tool metadata...');
    const startTime = Date.now();

    // Get all tool folders
    const toolFolders = this.getToolFolders();

    // Load all metadata in parallel
    const loadPromises = toolFolders.map(async (folder) => {
      try {
        return await this.loadMetadata(folder);
      } catch (error) {
        console.warn(`[ToolRegistry] Failed to load ${folder}:`, (error as Error).message);
        return null;
      }
    });

    const results = await Promise.all(loadPromises);

    // Populate the map
    for (const metadata of results) {
      if (metadata) {
        this.toolMap.set(metadata.name, metadata);
      }
    }

    // Pre-compute caches
    this.allMetadataCache = Array.from(this.toolMap.values());
    this.allNamesCache = Array.from(this.toolMap.keys());
    this.searchCorpusCache = this.buildSearchCorpus();

    this._initialized = true;
    console.log(`[ToolRegistry] Loaded ${this.toolMap.size} tools in ${Date.now() - startTime}ms`);
  }

  /**
   * Check if registry is initialized
   */
  get isInitialized(): boolean {
    return this._initialized;
  }

  // ============================================================================
  // Sync Access (after initialization)
  // ============================================================================

  /**
   * Get tool metadata by name (O(1) sync)
   * @throws Error if not initialized
   */
  get(name: string): ToolMetadata | undefined {
    this.assertInitialized();
    return this.toolMap.get(name);
  }

  /**
   * Check if tool exists (O(1) sync)
   * @throws Error if not initialized
   */
  has(name: string): boolean {
    this.assertInitialized();
    return this.toolMap.has(name);
  }

  /**
   * Get all tool metadata (O(1) sync - returns cached array)
   * @throws Error if not initialized
   */
  getAll(): ToolMetadata[] {
    this.assertInitialized();
    return this.allMetadataCache!;
  }

  /**
   * Get all tool names (O(1) sync - returns cached array)
   * @throws Error if not initialized
   */
  getAllNames(): string[] {
    this.assertInitialized();
    return this.allNamesCache!;
  }

  /**
   * Get search corpus for BM25/vector search (O(1) sync)
   * @throws Error if not initialized
   */
  getSearchCorpus(): SearchCorpusEntry[] {
    this.assertInitialized();
    return this.searchCorpusCache!;
  }

  /**
   * Get tools by risk level (O(n) but cached array)
   * @throws Error if not initialized
   */
  getByRiskLevel(level: 'safe' | 'moderate' | 'destructive'): ToolMetadata[] {
    this.assertInitialized();
    return this.allMetadataCache!.filter(t => t.riskLevel === level);
  }

  /**
   * Get tools requiring confirmation
   * @throws Error if not initialized
   */
  getRequiringConfirmation(): ToolMetadata[] {
    this.assertInitialized();
    return this.allMetadataCache!.filter(t => t.requiresConfirmation);
  }

  /**
   * Get related tools for a given tool
   * @throws Error if not initialized
   */
  getRelatedTools(toolName: string): string[] {
    this.assertInitialized();
    return this.toolMap.get(toolName)?.relatedTools || [];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private assertInitialized(): void {
    if (!this._initialized) {
      throw new Error(
        '[ToolRegistry] Not initialized. Call ToolRegistry.getInstance().initialize() at startup.'
      );
    }
  }

  private getToolFolders(): string[] {
    const entries = fs.readdirSync(this.toolsDir, { withFileTypes: true });
    const folders: string[] = [];

    for (const entry of entries) {
      // Skip utility folders (start with _)
      if (!entry.isDirectory() || entry.name.startsWith('_')) {
        continue;
      }

      // Check if folder has a metadata file
      const metadataPath = path.join(this.toolsDir, entry.name, `${entry.name}-metadata.ts`);
      if (fs.existsSync(metadataPath)) {
        folders.push(entry.name);
      }
    }

    return folders;
  }

  private async loadMetadata(toolName: string): Promise<ToolMetadata | null> {
    try {
      const module = await import(`../${toolName}/${toolName}-metadata`);
      return module.default as ToolMetadata;
    } catch (error) {
      return null;
    }
  }

  private buildSearchCorpus(): SearchCorpusEntry[] {
    return this.allMetadataCache!.map(m => ({
      name: m.name,
      text: this.buildSearchText(m),
      phrases: m.phrases,
      relatedTools: m.relatedTools,
    }));
  }

  private buildSearchText(metadata: ToolMetadata): string {
    const parts: string[] = [
      metadata.name,
      ...(metadata.description ? [metadata.description] : []),
      ...metadata.phrases,
    ];
    return parts.join(' ').toLowerCase();
  }
}

// ============================================================================
// Convenience Exports
// ============================================================================

/** Get the singleton registry instance */
export function getToolRegistry(): ToolRegistry {
  return ToolRegistry.getInstance();
}

/** Get all tool names (convenience - must call initialize() first) */
export function getAllToolNames(): string[] {
  return ToolRegistry.getInstance().getAllNames();
}

// ============================================================================
// Legacy Compatibility Layer
// ============================================================================

/**
 * TOOL_REGISTRY constant for backward compatibility with search services.
 *
 * @deprecated Use ToolRegistry.getInstance() instead.
 *
 * NOTE: This creates a Proxy that delegates to the singleton registry.
 * The registry MUST be initialized before accessing this constant.
 */
export const TOOL_REGISTRY: Record<string, ToolMetadata> = new Proxy(
  {} as Record<string, ToolMetadata>,
  {
    get(_, prop: string) {
      if (prop === 'then') return undefined; // Not a Promise
      const registry = ToolRegistry.getInstance();
      if (!registry.isInitialized) {
        throw new Error(
          '[TOOL_REGISTRY] Registry not initialized. Call ToolRegistry.getInstance().initialize() first.'
        );
      }
      return registry.get(prop);
    },
    has(_, prop: string) {
      const registry = ToolRegistry.getInstance();
      return registry.isInitialized && registry.has(prop);
    },
    ownKeys() {
      const registry = ToolRegistry.getInstance();
      return registry.isInitialized ? registry.getAllNames() : [];
    },
    getOwnPropertyDescriptor(_, prop: string) {
      const registry = ToolRegistry.getInstance();
      if (registry.isInitialized && registry.has(prop)) {
        return {
          enumerable: true,
          configurable: true,
          value: registry.get(prop),
        };
      }
      return undefined;
    },
  }
);

/**
 * ALL_TOOL_NAMES for backward compatibility.
 * @deprecated Use ToolRegistry.getInstance().getAllNames() instead.
 */
export const ALL_TOOL_NAMES: string[] = new Proxy([] as string[], {
  get(_, prop) {
    const registry = ToolRegistry.getInstance();
    if (!registry.isInitialized) return [];

    const names = registry.getAllNames();

    // Handle array methods and properties
    if (prop === 'length') return names.length;
    if (prop === Symbol.iterator) return names[Symbol.iterator].bind(names);
    if (typeof prop === 'string' && !isNaN(Number(prop))) {
      return names[Number(prop)];
    }
    if (typeof prop === 'string' && prop in Array.prototype) {
      return (names as any)[prop].bind(names);
    }
    return undefined;
  },
});
