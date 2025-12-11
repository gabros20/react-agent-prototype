/**
 * finalAnswer Tool Implementation
 *
 * Core tool for presenting final results to the user.
 * Used with AI SDK v6 hasToolCall() stop condition.
 *
 * When agent calls this tool, the loop stops and the response
 * is presented to the user.
 */

import { z } from "zod";

export const schema = z.object({
	summary: z
		.string()
		.describe("Brief summary of what was accomplished (1-2 sentences)"),
	content: z.string().describe("Formatted response in markdown with full details"),
});

export type FinalAnswerInput = z.infer<typeof schema>;

export async function execute(input: FinalAnswerInput) {
	// Tool execution is minimal - the content is the response
	return {
		success: true,
		summary: input.summary,
		content: input.content,
		_isFinalAnswer: true,
	};
}
