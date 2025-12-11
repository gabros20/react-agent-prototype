/**
 * createEntry Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "createEntry",
	description: "Create collection entry.",
	phrases: [
		"create entry",
		"new entry",
		"add entry",
		"create collection entry",
		"add to collection",
	],
	relatedTools: ["updateEntry"],
	riskLevel: "moderate",
	requiresConfirmation: false,
	extraction: {
		path: "items",
		type: "entry",
		nameField: "title",
		idField: "id",
		isArray: true,
	},
});
