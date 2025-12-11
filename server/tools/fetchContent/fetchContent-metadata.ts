/**
 * fetchContent Tool Metadata
 *
 * Extract content from URLs.
 * Replaces: web_fetchContent
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "fetchContent",
	description: "Extract content from URLs. Returns markdown/text.",
	phrases: [
		"fetch url",
		"get url content",
		"read url",
		"extract content",
		"scrape page",
		"get page content",
		"read website",
		"fetch page",
	],
	relatedTools: ["searchWeb"],
	riskLevel: "safe",
	requiresConfirmation: false,
	extraction: null,
});
