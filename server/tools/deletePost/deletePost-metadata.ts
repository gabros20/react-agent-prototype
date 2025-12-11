/**
 * deletePost Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "deletePost",
	description: "Delete post(s). Array param. Requires confirmed.",
	phrases: [
		"delete post",
		"remove post",
		"trash post",
		"delete blog",
		"delete article",
	],
	relatedTools: ["getPost"],
	riskLevel: "destructive",
	requiresConfirmation: true,
	extraction: null,
});
