/**
 * Tool Search Service
 *
 * Service class for tool discovery using hybrid BM25 + vector search.
 * Encapsulates all search functionality and provides clean API for consumers.
 */

import type { ToolMetadata, SmartSearchResult } from "./types";
import { ToolRegistry } from "../../tools/_registry";
import { initBM25Index, isBM25Initialized, getBM25Stats } from "./bm25-search";
import {
	initToolVectorIndex,
	isVectorInitialized,
	getVectorStats,
} from "./vector-search";
import { smartToolSearchWithConfidence, expandWithRelatedTools } from "./smart-search";

export class ToolSearchService {
	private initialized = false;
	private registry = ToolRegistry.getInstance();

	/**
	 * Initialize search indexes (call once at server startup)
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		// Initialize tool registry first (loads metadata from per-tool folders)
		await this.registry.initialize();

		// Initialize BM25 (synchronous, fast)
		initBM25Index(this.registry.getAll());

		// Initialize vector search (async, generates embeddings)
		// Run in background so service can be used immediately with BM25 fallback
		initToolVectorIndex(this.registry.getAll()).catch((err) => {
			console.warn(
				"⚠️ Vector search init failed (BM25 fallback available):",
				err.message,
			);
		});

		this.initialized = true;
		console.log("✓ ToolSearchService initialized");
	}

	/**
	 * Search for tools by query (hybrid BM25 + vector)
	 *
	 * @param query - Natural language query or action keywords
	 * @param limit - Maximum number of results (default: 8)
	 * @param options - Search options
	 * @returns Search results with confidence and source info
	 */
	async search(
		query: string,
		limit: number = 8,
		options: { expandRelated?: boolean; forceVector?: boolean } = {},
	): Promise<SmartSearchResult> {
		return smartToolSearchWithConfidence(query, limit, options);
	}

	/**
	 * Get tool metadata by name
	 *
	 * @param name - Tool name (e.g., "getPage", "cms_createPost")
	 * @returns Tool metadata or undefined if not found
	 */
	getTool(name: string): ToolMetadata | undefined {
		return this.registry.get(name);
	}

	/**
	 * List all available tools
	 *
	 * @returns Array of all tool metadata
	 */
	listTools(): ToolMetadata[] {
		return this.registry.getAll();
	}

	/**
	 * Get tool names only (lighter weight than full metadata)
	 *
	 * @returns Array of tool names
	 */
	listToolNames(): string[] {
		return this.registry.getAllNames();
	}

	/**
	 * Get related tools for a given tool
	 *
	 * @param toolName - Name of the tool
	 * @returns Array of related tool names
	 */
	getRelatedTools(toolName: string): string[] {
		return this.registry.getRelatedTools(toolName);
	}

	/**
	 * Check if a tool exists
	 *
	 * @param name - Tool name
	 * @returns True if tool exists
	 */
	toolExists(name: string): boolean {
		return this.registry.has(name);
	}

	/**
	 * Get tools by risk level
	 *
	 * @param riskLevel - Risk level to filter by
	 * @returns Tools matching the risk level
	 */
	getToolsByRiskLevel(
		riskLevel: "safe" | "moderate" | "destructive",
	): ToolMetadata[] {
		return this.registry.getByRiskLevel(riskLevel);
	}

	/**
	 * Get tools requiring confirmation
	 *
	 * @returns Tools that require user confirmation
	 */
	getToolsRequiringConfirmation(): ToolMetadata[] {
		return this.registry.getRequiringConfirmation();
	}

	/**
	 * Check initialization status
	 *
	 * @returns Status of BM25 and vector indexes
	 */
	getStatus(): {
		initialized: boolean;
		bm25: { initialized: boolean; toolCount: number };
		vector: { initialized: boolean; toolCount: number };
	} {
		return {
			initialized: this.initialized,
			bm25: getBM25Stats(),
			vector: getVectorStats(),
		};
	}

	/**
	 * Expand tool results with related tools
	 *
	 * @param toolNames - Array of tool names
	 * @param limit - Maximum total tools to return
	 * @returns Expanded list including related tools
	 */
	expandRelatedTools(toolNames: string[], limit: number = 10): string[] {
		// Convert tool names to search results format
		const results = toolNames.map((name) => {
			const tool = this.registry.get(name);
			return {
				name,
				score: 1,
				relatedTools: tool?.relatedTools,
			};
		});

		// Use the smart search expansion
		const expanded = expandWithRelatedTools(results, limit);
		return expanded.map((r) => r.name);
	}
}
