/**
 * deleteNavItem Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "deleteNavItem",
	description: "Remove navigation item(s). Array param.",
	phrases: [
		"remove navigation item",
		"delete menu item",
		"remove from nav",
		"delete from menu",
	],
	relatedTools: ["getNavItem"],
	riskLevel: "moderate",
	requiresConfirmation: false,
	extraction: null,
});
