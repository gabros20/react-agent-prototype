/**
 * deleteEntry Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "deleteEntry",
	description: "Delete entry(s). Array param. Requires confirmed.",
	phrases: ["delete entry", "remove entry", "trash entry"],
	relatedTools: ["getEntry"],
	riskLevel: "destructive",
	requiresConfirmation: true,
	extraction: null,
});
