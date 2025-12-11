/**
 * createImage Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "createImage",
	description: "Upload new image. Returns imageId after processing.",
	phrases: [
		"upload image",
		"add image",
		"create image",
		"new image",
		"upload photo",
		"add photo",
		"upload file",
		"upload picture",
	],
	relatedTools: ["getImage", "updateSection"],
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
