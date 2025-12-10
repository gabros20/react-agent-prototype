/**
 * Final Answer Tool
 *
 * Core tool for presenting final results to the user.
 * Used with AI SDK v6 hasToolCall() stop condition.
 *
 * When agent calls this tool, the loop stops and the response
 * is presented to the user.
 */

import { tool } from "ai";
import { z } from "zod";

export const finalAnswerTool = tool({
	description: `Present final results to user. ONLY call when all tool calls are complete and you have data to report. NEVER call if user asked to verify/check something - call the verification tool FIRST, then final_answer with the result.`,

	inputSchema: z.object({
		summary: z.string().describe("Brief summary of what was accomplished (1-2 sentences)"),
		content: z.string().describe("Formatted response in markdown with full details"),
	}),

	execute: async ({ summary, content }) => {
		// Tool execution is minimal - the content is the response
		return {
			success: true,
			summary,
			content,
			_isFinalAnswer: true,
		};
	},
});
