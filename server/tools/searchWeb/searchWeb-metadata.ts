/**
 * searchWeb Tool Metadata
 *
 * Unified web search with dual-provider fallback (Tavily + Exa).
 * Uses both providers by default for resilience.
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "searchWeb",
	description:
		"Web search with fallback. Uses Tavily+Exa for resilience. mode: quick/deep, provider: tavily/exa/both",
	phrases: [
		"search web",
		"web search",
		"search online",
		"look up",
		"find online",
		"google",
		"search internet",
		"research",
		"find information",
		"look for",
		"search for",
		"what is",
		"who is",
		"when did",
		"how to",
		"tavily search",
		"exa search",
	],
	relatedTools: ["fetchContent"],
	riskLevel: "safe",
	requiresConfirmation: false,
	extraction: null,
});
