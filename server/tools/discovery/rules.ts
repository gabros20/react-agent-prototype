/**
 * Rules Loader
 *
 * Loads category-specific rules from markdown files.
 * Rules are injected into the system prompt alongside discovered tools.
 *
 * Implements Phase 4 from DYNAMIC_TOOL_INJECTION_PLAN.md
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { ToolCategory } from "./types";

// ============================================================================
// Configuration
// ============================================================================

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RULES_DIR = join(__dirname, "..", "..", "prompts", "rules");

// Cache loaded rules to avoid repeated file reads
const rulesCache: Map<ToolCategory, string> = new Map();

// ============================================================================
// Rules Loading
// ============================================================================

/**
 * Load rules for a specific category.
 * Returns empty string if no rules file exists.
 */
export function loadRules(category: ToolCategory): string {
	// Check cache first
	if (rulesCache.has(category)) {
		return rulesCache.get(category)!;
	}

	const filePath = join(RULES_DIR, `${category}.md`);

	if (!existsSync(filePath)) {
		rulesCache.set(category, "");
		return "";
	}

	try {
		const content = readFileSync(filePath, "utf-8").trim();
		rulesCache.set(category, content);
		return content;
	} catch (error) {
		console.warn(`[Rules] Failed to load ${category}.md:`, error);
		rulesCache.set(category, "");
		return "";
	}
}

/**
 * Get combined rules for multiple categories.
 * Deduplicates and formats for system prompt injection.
 */
export function getRules(categories: ToolCategory[]): string {
	const uniqueCategories = [...new Set(categories)];
	const rules: string[] = [];

	for (const category of uniqueCategories) {
		const categoryRules = loadRules(category);
		if (categoryRules) {
			rules.push(categoryRules);
		}
	}

	if (rules.length === 0) {
		return "";
	}

	return `<tool-rules>\n${rules.join("\n\n")}\n</tool-rules>`;
}

/**
 * Clear rules cache (useful for testing or hot reload).
 */
export function clearRulesCache(): void {
	rulesCache.clear();
}

/**
 * Get rules cache stats.
 */
export function getRulesCacheStats(): {
	cachedCategories: ToolCategory[];
	totalCached: number;
} {
	return {
		cachedCategories: [...rulesCache.keys()],
		totalCached: rulesCache.size,
	};
}

/**
 * Preload all rules into cache.
 */
export function preloadRules(): void {
	const categories: ToolCategory[] = [
		"pages",
		"sections",
		"images",
		"posts",
		"navigation",
		"entries",
		"search",
		"research",
		"pexels",
		"http",
		"site-settings",
		"planning",
	];

	for (const category of categories) {
		loadRules(category);
	}

	console.log(`✓ Rules preloaded: ${rulesCache.size} categories cached`);
}
