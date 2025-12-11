/**
 * getNavItem Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "getNavItem",
	description: "Get navigation item(s). By label or all.",
	phrases: [
		"get navigation",
		"show navigation",
		"menu items",
		"navigation menu",
		"site menu",
		"nav items",
		"header menu",
	],
	relatedTools: ["createNavItem", "updateNavItem"],
	riskLevel: "safe",
	requiresConfirmation: false,
	extraction: {
		path: "items",
		type: "nav_item",
		nameField: "label",
		idField: "label",
		isArray: true,
	},
});
