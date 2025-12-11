/**
 * createSection Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "createSection",
	description: "Add section to page. Returns pageSectionId for updates.",
	phrases: [
		"add section",
		"add section to page",
		"insert section",
		"new section",
		"create section",
		"add hero",
		"add cta",
		"add feature section",
		"put section on page",
	],
	relatedTools: ["getSectionTemplate", "updateSection"],
	riskLevel: "moderate",
	requiresConfirmation: false,
	extraction: {
		path: "items",
		type: "page_section",
		nameField: "sectionKey",
		idField: "id",
		isArray: true,
	},
});
