/**
 * updateNavItem Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "updateNavItem",
	description: "Update nav item. Set visible: false to hide.",
	phrases: [
		"update navigation item",
		"edit menu item",
		"change navigation",
		"modify nav item",
		"rename menu item",
		"toggle navigation item",
		"enable menu item",
		"disable menu item",
		"hide nav item",
		"show nav item",
	],
	relatedTools: ["getNavItem"],
	riskLevel: "moderate",
	requiresConfirmation: false,
	extraction: null,
});
