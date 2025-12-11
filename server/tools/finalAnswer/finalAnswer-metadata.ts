/**
 * finalAnswer Tool Metadata
 */

import { defineToolMetadata } from "../_types/metadata";

export default defineToolMetadata({
	name: "finalAnswer",
	description:
		"Present final results to user. ONLY call when all tool calls are complete and you have data to report.",
	phrases: [
		"final answer",
		"complete",
		"done",
		"finished",
		"respond",
		"present results",
		"wrap up",
		"summarize",
	],
	relatedTools: [],
	riskLevel: "safe",
	requiresConfirmation: false,
	extraction: null,
});
