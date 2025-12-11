/**
 * getEntry Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "getEntry",
	description: "Get collection entry(s). By id, slug, or collectionId.",
	phrases: [
		"get entry",
		"get collection entries",
		"list entries",
		"collection items",
		"show entries",
		"entries in collection",
		"get entry content",
		"entry details",
		"read entry",
		"fetch entry",
		"entry data",
	],
	relatedTools: ["updateEntry"],
	riskLevel: "safe",
	requiresConfirmation: false,
	extraction: {
		path: "items",
		type: "entry",
		nameField: "title",
		idField: "id",
		isArray: true,
	},
});
