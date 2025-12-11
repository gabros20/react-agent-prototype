/**
 * updateImage Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "updateImage",
	description: "Update image metadata (description, tags).",
	phrases: [
		"update image",
		"edit image metadata",
		"change image description",
		"update image tags",
		"modify image",
	],
	relatedTools: ["getImage"],
	riskLevel: "moderate",
	requiresConfirmation: false,
	extraction: null,
});
