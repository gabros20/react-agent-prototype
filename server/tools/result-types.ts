/**
 * Standardized Tool Result Types
 *
 * All tools should return ToolResult<T> for consistent response patterns.
 * This enables:
 * - Type-safe success/error handling
 * - Consistent confirmation flow for destructive operations
 * - Proper error propagation to the agent
 */

/**
 * Base tool result - all tools should return this shape
 */
export interface ToolResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	requiresConfirmation?: boolean;
	confirmationMessage?: string;
}

/**
 * Success result factory
 */
export function toolSuccess<T>(data: T): ToolResult<T> {
	return { success: true, data };
}

/**
 * Error result factory
 */
export function toolError(error: string): ToolResult<never> {
	return { success: false, error };
}

/**
 * Confirmation required result factory
 */
export function toolRequiresConfirmation<T>(
	message: string,
	data?: T
): ToolResult<T> {
	return {
		success: false,
		requiresConfirmation: true,
		confirmationMessage: message,
		data,
	};
}

/**
 * Type guard to check if result is successful
 */
export function isToolSuccess<T>(
	result: ToolResult<T>
): result is ToolResult<T> & { success: true; data: T } {
	return result.success === true && result.data !== undefined;
}

/**
 * Type guard to check if result requires confirmation
 */
export function isToolConfirmation<T>(
	result: ToolResult<T>
): result is ToolResult<T> & { requiresConfirmation: true } {
	return result.requiresConfirmation === true;
}
