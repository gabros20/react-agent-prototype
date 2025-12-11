/**
 * deleteSection Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "deleteSection",
	description: "Delete section(s). Array param. Requires confirmed.",
	phrases: [
		"delete section",
		"remove section",
		"delete section from page",
		"remove section from page",
		"trash section",
		"delete sections",
		"remove all sections",
		"batch delete sections",
	],
	relatedTools: ["getSection"],
	riskLevel: "destructive",
	requiresConfirmation: true,
	extraction: null,
});
