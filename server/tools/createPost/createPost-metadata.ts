/**
 * createPost Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "createPost",
	description: "Create draft post. Use updatePost to publish.",
	phrases: [
		"create post",
		"new post",
		"write post",
		"add post",
		"create blog",
		"new blog post",
		"write blog",
		"create article",
		"new article",
		"blog post",
		"make post",
	],
	relatedTools: ["updatePost", "browseImages"],
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
