/**
 * getPost Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "getPost",
	description: "Get post(s). By slug, or all with filters (status, category).",
	phrases: [
		"get post",
		"show post",
		"read post",
		"view post",
		"fetch post",
		"post details",
		"blog post content",
		"get article",
		"list posts",
		"show posts",
		"all posts",
		"get posts",
		"blog posts",
		"view posts",
		"posts list",
		"articles",
	],
	relatedTools: ["updatePost"],
	riskLevel: "safe",
	requiresConfirmation: false,
	extraction: {
		path: "items",
		type: "post",
		nameField: "title",
		idField: "id",
		isArray: true,
	},
});
