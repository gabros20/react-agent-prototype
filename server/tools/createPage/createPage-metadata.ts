/**
 * createPage Tool Metadata
 *
 * Create new empty page. Add sections with createSection.
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "createPage",
	description: "Create empty page. Add sections with createSection.",
	phrases: [
		"create page",
		"new page",
		"add page",
		"make page",
		"build page",
		"create empty page",
	],
	relatedTools: ["createSection", "updateSection"],
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
