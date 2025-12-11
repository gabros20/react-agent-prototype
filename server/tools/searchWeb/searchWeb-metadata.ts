/**
 * searchWeb Tool Metadata
 *
 * Unified web search with mode selection (quick/deep).
 * Replaces: web_quickSearch, web_deepResearch
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "searchWeb",
	description:
		"Web search. mode: quick (facts) or deep (research with AI answer).",
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
	],
	relatedTools: ["fetchContent"],
	riskLevel: "safe",
	requiresConfirmation: false,
	extraction: null,
});
