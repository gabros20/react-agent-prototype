/**
 * deletePage Tool Metadata
 *
 * Delete page(s) and all sections. Array param. Requires confirmed.
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "deletePage",
	description:
		"Delete page(s) and all sections. Array param. Requires confirmed.",
	phrases: [
		"delete page",
		"remove page",
		"trash page",
		"destroy page",
		"delete website page",
	],
	relatedTools: ["deleteNavItem"],
	riskLevel: "destructive",
	requiresConfirmation: true,
	extraction: null,
});
