/**
 * React Hooks for Debug Logger
 *
 * Provides React-friendly access to the debug logger.
 */

"use client";

import { useMemo, useCallback } from "react";
import { debugLogger } from "./debug-logger";
import type { DebugLogger, TraceLogger } from "./types";

/**
 * Hook to access the debug logger
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const logger = useDebugLogger();
 *   logger.info("Component mounted");
 * }
 * ```
 */
export function useDebugLogger(): DebugLogger {
	return debugLogger;
}

/**
 * Hook to get a trace logger for a specific trace ID
 *
 * Usage:
 * ```tsx
 * function TraceComponent({ traceId }: { traceId: string }) {
 *   const trace = useTraceLogger(traceId);
 *   // Use trace.toolCall(), trace.complete(), etc.
 * }
 * ```
 */
export function useTraceLogger(traceId: string): TraceLogger {
	return useMemo(() => debugLogger.trace(traceId), [traceId]);
}

/**
 * Hook to create quick logging functions bound to a component
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { log, warn, error } = useQuickLog("MyComponent");
 *   log("Something happened", { data });
 * }
 * ```
 */
export function useQuickLog(prefix?: string) {
	const logger = useDebugLogger();

	const log = useCallback(
		(message: string, data?: unknown) => {
			const prefixed = prefix ? `[${prefix}] ${message}` : message;
			logger.info(prefixed, data);
		},
		[logger, prefix]
	);

	const warn = useCallback(
		(message: string, data?: unknown) => {
			const prefixed = prefix ? `[${prefix}] ${message}` : message;
			logger.warn(prefixed, data);
		},
		[logger, prefix]
	);

	const error = useCallback(
		(message: string, err?: Error) => {
			const prefixed = prefix ? `[${prefix}] ${message}` : message;
			logger.error(prefixed, err);
		},
		[logger, prefix]
	);

	return { log, warn, error };
}
