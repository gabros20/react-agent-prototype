/**
 * fetchContent Tool Implementation
 *
 * Extract content from URLs.
 */

import { z } from "zod";
import { getTavilyService } from "../../services/ai/tavily-research.service";

export const schema = z.object({
	urls: z
		.array(z.string().url())
		.min(1)
		.max(10)
		.describe("URLs to fetch content from (1-10)"),
	format: z
		.enum(["markdown", "text"])
		.optional()
		.describe("Content format: markdown (default) or text"),
});

export type FetchContentInput = z.infer<typeof schema>;

export async function execute(input: FetchContentInput) {
	const tavilyService = getTavilyService();

	if (!tavilyService.isConfigured()) {
		return {
			success: false,
			error:
				"Tavily API key not configured. Set TAVILY_API_KEY environment variable.",
			contents: [],
		};
	}

	try {
		const response = await tavilyService.fetchUrlContent(input.urls, {
			format: input.format,
		});

		return {
			success: true,
			contents: response.contents,
			responseTime: response.responseTime,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Content fetch failed",
			contents: [],
		};
	}
}
