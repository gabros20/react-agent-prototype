/**
 * getSectionTemplate Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "getSectionTemplate",
	description: "Get section template(s). Shows fields and structure.",
	phrases: [
		"list section templates",
		"section types",
		"available sections",
		"what sections",
		"section templates",
		"section definitions",
		"hero section",
		"cta section",
		"feature section",
		"section fields",
		"section schema",
		"what fields",
		"section structure",
		"field names",
		"get section fields",
	],
	relatedTools: ["createSection", "updateSection"],
	riskLevel: "safe",
	requiresConfirmation: false,
	extraction: {
		path: "items",
		type: "section_template",
		nameField: "name",
		idField: "id",
		isArray: true,
	},
});
