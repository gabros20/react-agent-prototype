/**
 * getImage Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "getImage",
	description: "Get local image(s). By id, query (semantic), or all.",
	phrases: [
		"find image",
		"get image",
		"locate image",
		"the image",
		"search images",
		"find images",
		"image search",
		"look for images",
		"images of",
		"images about",
		"search photos",
		"find photos",
		"list images",
		"all images",
		"show images",
		"image library",
		"browse images",
		"view all images",
		"what images",
		"available images",
	],
	relatedTools: ["updateSection", "browseImages"],
	riskLevel: "safe",
	requiresConfirmation: false,
	extraction: {
		path: "items",
		type: "image",
		nameField: "filename",
		idField: "id",
		isArray: true,
	},
});
