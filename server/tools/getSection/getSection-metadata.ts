/**
 * getSection Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "getSection",
	description: "Get section(s) on page. By pageSectionId or pageId.",
	phrases: [
		"get sections",
		"list sections",
		"page sections",
		"show sections",
		"sections on page",
		"what sections",
		"view sections",
		"get page sections",
		"get section content",
		"section content",
		"read section",
		"fetch section",
		"section data",
		"view section content",
	],
	relatedTools: ["updateSection", "getSectionTemplate"],
	riskLevel: "safe",
	requiresConfirmation: false,
	extraction: {
		path: "items",
		type: "page_section",
		nameField: "sectionKey",
		idField: "id",
		isArray: true,
	},
});
