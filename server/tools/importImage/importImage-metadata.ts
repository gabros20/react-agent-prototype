/**
 * importImage Tool Metadata
 *
 * Download external photo to local system.
 * Replaces: pexels_downloadPhoto, unsplash_downloadPhoto
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "importImage",
	description:
		"Download external photo (Pexels/Unsplash) to local. Returns local imageId and URL.",
	phrases: [
		"import image",
		"download image",
		"import photo",
		"download photo",
		"save image",
		"get from pexels",
		"get from unsplash",
		"add stock photo",
	],
	relatedTools: ["browseImages", "getImage", "updateSection"],
	riskLevel: "safe",
	requiresConfirmation: false,
	extraction: {
		path: ".",
		type: "image",
		nameField: "filename",
		idField: "imageId",
		isArray: false,
	},
});
