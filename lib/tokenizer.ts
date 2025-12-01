/**
 * Token counting utility using gpt-tokenizer
 *
 * Uses cl100k_base encoding (GPT-4, GPT-3.5-turbo compatible)
 * Works in both browser and Node.js
 */

import { encode, encodeChat } from "gpt-tokenizer";

/**
 * Count tokens in a text string
 */
export function countTokens(text: string): number {
	if (!text) return 0;
	try {
		return encode(text).length;
	} catch {
		// Fallback: rough estimate (1 token ≈ 4 chars for English)
		return Math.ceil(text.length / 4);
	}
}

/**
 * Count tokens in a chat message format
 */
export function countChatTokens(messages: Array<{ role: string; content: string }>): number {
	if (!messages?.length) return 0;
	try {
		return encodeChat(messages as any).length;
	} catch {
		// Fallback: count each message
		return messages.reduce((sum, m) => sum + countTokens(m.content) + 4, 0); // +4 for message overhead
	}
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
	if (tokens < 1000) return tokens.toString();
	if (tokens < 10000) return `${(tokens / 1000).toFixed(1)}K`;
	return `${Math.round(tokens / 1000)}K`;
}

/**
 * Get token count with formatted string
 */
export function getTokenInfo(text: string): { count: number; formatted: string } {
	const count = countTokens(text);
	return {
		count,
		formatted: formatTokenCount(count),
	};
}

