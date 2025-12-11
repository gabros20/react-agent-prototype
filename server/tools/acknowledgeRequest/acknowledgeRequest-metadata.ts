/**
 * acknowledgeRequest Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "acknowledgeRequest",
	description:
		"Acknowledge the user's request before taking action. Call this FIRST with a brief, natural response.",
	phrases: [
		"acknowledge",
		"confirm",
		"understood",
		"got it",
		"I'll check",
		"let me look",
		"working on it",
	],
	relatedTools: ["searchTools"],
	riskLevel: "safe",
	requiresConfirmation: false,
	extraction: null,
});
