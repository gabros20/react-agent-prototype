#!/usr/bin/env npx tsx
/**
 * Test script for Exa AI web research tools
 *
 * Usage:
 *   pnpm tsx scripts/test-exa-search.ts [quick|deep|fetch]
 *
 * Examples:
 *   pnpm tsx scripts/test-exa-search.ts quick
 *   pnpm tsx scripts/test-exa-search.ts deep
 *   pnpm tsx scripts/test-exa-search.ts fetch https://example.com
 */

import "dotenv/config";
import { ExaResearchService } from "../server/services/ai/exa-research.service";

const exaService = new ExaResearchService();

async function testQuickSearch() {
	console.log("\n=== Testing Quick Search ===\n");

	if (!exaService.isConfigured()) {
		console.error("❌ EXA_API_KEY not configured. Set it in .env file.");
		process.exit(1);
	}

	console.log("Searching for: 'latest AI news 2025'");
	console.log("Category: news");
	console.log("Recent only: yes (last 7 days)\n");

	try {
		const result = await exaService.quickSearch("latest AI news 2025", {
			numResults: 5,
			category: "news",
			livecrawl: "fallback",
			startPublishedDate: ExaResearchService.getDateFilter(7),
		});

		console.log(`✅ Found ${result.results.length} results:\n`);

		result.results.forEach((r, i) => {
			console.log(`${i + 1}. ${r.title}`);
			console.log(`   URL: ${r.url}`);
			console.log(`   ${r.snippet.slice(0, 150)}...`);
			if (r.publishedDate) {
				console.log(`   Published: ${r.publishedDate}`);
			}
			console.log("");
		});

		if (result.costDollars != null) {
			const cost = typeof result.costDollars === 'number' ? result.costDollars : result.costDollars;
			console.log(`Cost: $${cost.toFixed(4)}`);
		}
	} catch (error) {
		console.error("❌ Search failed:", error);
	}
}

async function testDeepResearch() {
	console.log("\n=== Testing Deep Research ===\n");

	if (!exaService.isConfigured()) {
		console.error("❌ EXA_API_KEY not configured. Set it in .env file.");
		process.exit(1);
	}

	const topic = "Sustainable fashion industry trends 2025";
	console.log(`Topic: "${topic}"`);
	console.log("Sections: overview, key_trends, challenges");
	console.log("Include statistics: yes");
	console.log("Max wait time: 90 seconds\n");
	console.log("Starting research... (this may take 30-90 seconds)\n");

	try {
		const startTime = Date.now();

		const result = await exaService.deepResearch(topic, {
			outputSchema: {
				sections: ["overview", "key_trends", "challenges"],
				includeStatistics: true,
			},
			maxWaitTime: 90,
		});

		const duration = ((Date.now() - startTime) / 1000).toFixed(1);

		console.log(`✅ Research complete in ${duration}s\n`);
		console.log(`Status: ${result.status}`);
		console.log(`Research ID: ${result.researchId}`);

		if (result.report) {
			console.log("\n--- Report Summary ---");
			if (result.report.summary) {
				console.log(result.report.summary.slice(0, 300) + "...");
			}

			if (result.report.markdown) {
				console.log("\n--- Markdown Report (first 500 chars) ---");
				console.log(result.report.markdown.slice(0, 500) + "...");
			}

			if (result.report.content) {
				console.log("\n--- Structured Content ---");
				console.log(JSON.stringify(result.report.content, null, 2).slice(0, 800) + "...");
			}
		}

		if (result.citations.length > 0) {
			console.log(`\n--- Citations (${result.citations.length}) ---`);
			result.citations.slice(0, 5).forEach((c, i) => {
				console.log(`${i + 1}. ${c.title}`);
				console.log(`   ${c.url}`);
			});
		}

		if (result.usage) {
			console.log("\n--- Usage ---");
			console.log(`Searches: ${result.usage.searches}`);
			console.log(`Pages read: ${result.usage.pagesRead}`);
			console.log(`Reasoning tokens: ${result.usage.reasoningTokens}`);
		}

		if (result.costDollars != null) {
			const cost = typeof result.costDollars === 'number' ? result.costDollars : result.costDollars;
			console.log(`\nCost: $${cost.toFixed(4)}`);
		}
	} catch (error) {
		console.error("❌ Research failed:", error);
	}
}

async function testFetchContent(url?: string) {
	console.log("\n=== Testing Content Fetch ===\n");

	if (!exaService.isConfigured()) {
		console.error("❌ EXA_API_KEY not configured. Set it in .env file.");
		process.exit(1);
	}

	const targetUrl = url || "https://exa.ai";
	console.log(`Fetching: ${targetUrl}`);
	console.log("Include text: yes (max 5000 chars)");
	console.log("Include summary: yes\n");

	try {
		const result = await exaService.fetchUrlContent([targetUrl], {
			maxCharacters: 5000,
			includeSummary: true,
			summaryQuery: "Summarize the main purpose and features",
		});

		console.log(`✅ Fetched ${result.contents.length} URL(s):\n`);

		result.contents.forEach((c) => {
			console.log(`URL: ${c.url}`);
			console.log(`Status: ${c.status}`);
			if (c.title) {
				console.log(`Title: ${c.title}`);
			}
			if (c.error) {
				console.log(`Error: ${c.error}`);
			}
			if (c.summary) {
				console.log("\n--- Summary ---");
				console.log(c.summary);
			}
			if (c.text) {
				console.log("\n--- Text (first 500 chars) ---");
				console.log(c.text.slice(0, 500) + "...");
			}
			console.log("");
		});

		if (result.costDollars != null) {
			const cost = typeof result.costDollars === 'number' ? result.costDollars : result.costDollars;
			console.log(`Cost: $${cost.toFixed(4)}`);
		}
	} catch (error) {
		console.error("❌ Fetch failed:", error);
	}
}

// Main
const command = process.argv[2] || "quick";
const extraArg = process.argv[3];

console.log("Exa AI Web Research Test");
console.log("========================");
console.log(`API Key configured: ${exaService.isConfigured() ? "Yes" : "No"}`);

switch (command) {
	case "quick":
		testQuickSearch();
		break;
	case "deep":
		testDeepResearch();
		break;
	case "fetch":
		testFetchContent(extraArg);
		break;
	default:
		console.log("\nUsage: pnpm tsx scripts/test-exa-search.ts [quick|deep|fetch] [url]");
		console.log("\nCommands:");
		console.log("  quick - Test quick search (default)");
		console.log("  deep  - Test deep research (takes 30-90s)");
		console.log("  fetch - Test URL content fetch (optional: provide URL)");
}
