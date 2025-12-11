/**
 * createNavItem Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "createNavItem",
	description: "Add navigation item. Location: header/footer/both.",
	phrases: [
		"add navigation item",
		"add to menu",
		"add menu item",
		"add to nav",
		"add link to navigation",
		"new menu item",
	],
	relatedTools: ["getNavItem"],
	riskLevel: "moderate",
	requiresConfirmation: false,
	extraction: null,
});
