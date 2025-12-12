/**
 * searchTools Tool - Index
 */

export { default as metadata } from "./searchTools-metadata";
export { schema, outputSchema, execute } from "./searchTools-tool";
export type { SearchToolsOutput } from "./searchTools-tool";

import { tool } from "ai";
import metadata from "./searchTools-metadata";
import { schema, outputSchema, execute } from "./searchTools-tool";
import type { AgentContext } from "../_types/agent-context";

// searchTools is special - it has an outputSchema, so we build it directly
// instead of using assembleTool
export const searchToolsTool = tool({
	description: `${metadata.description}

IMPORTANT: Include ALL actions needed for your task (6-8 keywords recommended).
Common actions: create, list, get, update, delete, search, download, publish, archive

Examples:
- "create post publish" → createPost + updatePost
- "create post pexels search download" → post + pexels tools
- "web search research fetch" → all web research tools
- "page create section add update image" → full page building toolkit`,

	inputSchema: schema,
	outputSchema: outputSchema,

	execute: async (input, { experimental_context }) => {
		const ctx = experimental_context as AgentContext | undefined;
		return execute(input, ctx);
	},
});
