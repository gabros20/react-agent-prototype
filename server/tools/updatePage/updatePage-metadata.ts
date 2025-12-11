/**
 * updatePage Tool Metadata
 *
 * Update page metadata. Use updateSection for content.
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "updatePage",
	description: "Update page metadata. Use updateSection for content.",
	phrases: [
		"update page",
		"edit page",
		"change page",
		"modify page",
		"rename page",
		"update page meta",
		"change page slug",
		"edit page seo",
	],
	relatedTools: ["getPage"],
	riskLevel: "moderate",
	requiresConfirmation: false,
	extraction: {
		path: "items",
		type: "page",
		nameField: "name",
		idField: "id",
		isArray: true,
	},
});
