/**
 * deleteImage Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "deleteImage",
	description: "Delete image(s). Array param. Requires confirmed.",
	phrases: [
		"delete image",
		"remove image",
		"trash image",
		"delete photo",
		"remove photo",
	],
	relatedTools: ["getImage"],
	riskLevel: "destructive",
	requiresConfirmation: true,
	extraction: null,
});
