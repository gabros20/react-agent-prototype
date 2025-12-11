/**
 * updatePost Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "updatePost",
	description: "Update post. Set status: published/archived to change state.",
	phrases: [
		"update post",
		"edit post",
		"modify post",
		"change post",
		"update blog",
		"edit blog post",
		"change post content",
		"publish post",
		"publish blog",
		"make live",
		"go live",
		"archive post",
		"unpublish post",
		"hide post",
	],
	relatedTools: ["getPost"],
	riskLevel: "moderate",
	requiresConfirmation: false,
	extraction: {
		path: "items",
		type: "post",
		nameField: "title",
		idField: "id",
		isArray: true,
	},
});
