/**
 * updateEntry Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "updateEntry",
	description: "Update entry content or status.",
	phrases: [
		"update entry",
		"edit entry",
		"modify entry",
		"change entry",
		"update entry content",
	],
	relatedTools: ["getEntry"],
	riskLevel: "moderate",
	requiresConfirmation: false,
	extraction: null,
});
