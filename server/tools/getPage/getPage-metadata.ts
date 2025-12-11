/**
 * getPage Tool Metadata
 *
 * Unified read tool for pages - by id, slug, or all.
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "getPage",
	description:
		"Get page(s). By id, slug, or all. Default lightweight; includeContent for full sections.",
	phrases: [
		"get page",
		"find page",
		"show page",
		"fetch page",
		"read page",
		"page details",
		"page content",
		"page info",
		"view page",
		"open page",
		"page by slug",
		"page by id",
		"list pages",
		"show pages",
		"all pages",
		"get pages",
		"view pages",
		"what pages",
		"see pages",
		"browse pages",
	],
	relatedTools: ["getSection", "updateSection"],
	riskLevel: "safe",
	requiresConfirmation: false,
	extraction: {
		path: "items",
		type: "page",
		nameField: "name",
		idField: "id",
		isArray: true,
	},
});
