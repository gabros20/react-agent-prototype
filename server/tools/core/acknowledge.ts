/**
 * Acknowledge Tool
 *
 * Lightweight tool for acknowledging user requests before processing.
 * Enables conversational flow: "I'll check that for you..." → tools → final_answer
 *
 * This tool exists because AI SDK's loop only continues when there are tool results.
 * By having the agent call this tool with an acknowledgment message, we:
 * 1. Display the acknowledgment to the user immediately
 * 2. Allow the loop to continue to subsequent tool calls
 */

import { tool } from "ai";
import { z } from "zod";

export const acknowledgeTool = tool({
	description: `Acknowledge the user's request before taking action. Call this FIRST with a brief, natural response. Vary your language - don't always say the same thing. Match your tone to the request (casual for simple asks, more focused for complex tasks).`,

	inputSchema: z.object({
		message: z
			.string()
			.describe(`Brief acknowledgment (1 sentence). Vary your responses naturally:
- Simple queries: "Sure!", "On it.", "Let me check.", "One moment..."
- List requests: "Let me pull that up.", "Checking now.", "Here's what we have..."
- Create/update: "I'll set that up.", "Making those changes.", "Working on it."
- Complex tasks: "Good idea, let me work through this.", "I'll handle that step by step."
Avoid repetitive "I'll check the X for you" patterns.`),
	}),

	execute: async ({ message }) => {
		// Returns immediately - the message will be streamed to UI
		return {
			acknowledged: true,
			message,
		};
	},
});
