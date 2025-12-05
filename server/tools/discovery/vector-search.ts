/**
 * Vector Search for Tools
 *
 * Semantic tool search using embeddings.
 * Used as fallback when BM25 confidence is low (multilingual, semantic queries).
 *
 * Implements Phase 3 from DYNAMIC_TOOL_INJECTION_PLAN.md
 */

import type { ToolMetadata, ToolSearchResult } from "./types";
import { TOOL_INDEX } from "./tool-index";

// ============================================================================
// Module State
// ============================================================================

let toolEmbeddings: Map<string, number[]> = new Map();
let isInitialized = false;

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate embedding via OpenRouter API.
 * Same embedding model as VectorIndexService for consistency.
 */
async function embed(text: string): Promise<number[]> {
	const apiKey = process.env.OPENROUTER_API_KEY;
	const model = process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small";

	if (!apiKey) {
		console.warn("[VectorSearch] OPENROUTER_API_KEY not configured");
		return new Array(1536).fill(0);
	}

	try {
		const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "http://localhost:3000",
				"X-Title": "Tool Discovery",
			},
			body: JSON.stringify({
				model,
				input: text.slice(0, 8000),
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
		}

		const data = await response.json();
		return data.data[0].embedding;
	} catch (error: any) {
		console.error("[VectorSearch] Embedding error:", error.message);
		return new Array(1536).fill(0);
	}
}

/**
 * Build searchable text from tool metadata.
 */
function buildSearchableText(tool: ToolMetadata): string {
	return [
		tool.name.replace(/_/g, " "),
		tool.description,
		tool.phrases.join(" "),
		tool.category,
	].join(" ");
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize vector index for tools.
 * Generates embeddings for all tools (async, can take a few seconds).
 */
export async function initToolVectorIndex(
	tools?: ToolMetadata[]
): Promise<void> {
	if (isInitialized) {
		console.log("[VectorSearch] Already initialized, skipping");
		return;
	}

	const toolList = tools || Object.values(TOOL_INDEX);
	toolEmbeddings = new Map();

	console.log(
		`[VectorSearch] Initializing embeddings for ${toolList.length} tools...`
	);

	// Generate embeddings in parallel with rate limiting
	const batchSize = 10;
	for (let i = 0; i < toolList.length; i += batchSize) {
		const batch = toolList.slice(i, i + batchSize);
		await Promise.all(
			batch.map(async (tool) => {
				const text = buildSearchableText(tool);
				const embedding = await embed(text);
				toolEmbeddings.set(tool.name, embedding);
			})
		);
	}

	isInitialized = true;
	console.log(`✓ Vector search initialized: ${toolList.length} tools embedded`);
}

// ============================================================================
// Search
// ============================================================================

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) return 0;

	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
	return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Search tools using vector similarity.
 * Best for semantic queries, multilingual, and fuzzy matching.
 *
 * @param query - Search query
 * @param limit - Maximum results
 * @returns Ranked tools by similarity
 */
export async function vectorSearch(
	query: string,
	limit: number = 5
): Promise<ToolSearchResult[]> {
	if (!isInitialized || toolEmbeddings.size === 0) {
		console.warn("[VectorSearch] Not initialized");
		return [];
	}

	// Generate query embedding
	const queryEmbedding = await embed(query);

	// Calculate similarity with all tools
	const scores: Array<{ name: string; score: number }> = [];

	for (const [toolName, toolEmbedding] of toolEmbeddings) {
		const score = cosineSimilarity(queryEmbedding, toolEmbedding);
		scores.push({ name: toolName, score });
	}

	// Sort by score descending
	scores.sort((a, b) => b.score - a.score);

	// Return top results
	return scores.slice(0, limit).map(({ name, score }) => {
		const metadata = TOOL_INDEX[name];
		return {
			name: metadata.name,
			category: metadata.category,
			description: metadata.description,
			score,
			relatedTools:
				metadata.relatedTools.length > 0
					? metadata.relatedTools
					: undefined,
		};
	});
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if vector index is initialized.
 */
export function isVectorInitialized(): boolean {
	return isInitialized;
}

/**
 * Reset vector index (useful for testing).
 */
export function resetVectorIndex(): void {
	toolEmbeddings = new Map();
	isInitialized = false;
}

/**
 * Get vector index stats.
 */
export function getVectorStats(): {
	initialized: boolean;
	toolCount: number;
} {
	return {
		initialized: isInitialized,
		toolCount: toolEmbeddings.size,
	};
}
