/**
 * DebugLogger Implementation
 *
 * Main logger interface providing scoped trace loggers.
 * Singleton pattern for global access.
 */

import { useTraceStore } from "@/app/assistant/_stores/trace-store";
import { createTraceLogger } from "./trace-logger";
import type { DebugLogger, TraceLogger } from "./types";

/**
 * Create the DebugLogger implementation
 */
function createDebugLogger(): DebugLogger {
	// Cache of trace loggers by ID
	const traceLoggers = new Map<string, TraceLogger>();

	// Active trace ID (set when a trace starts)
	let activeTraceId: string | null = null;

	return {
		trace(traceId: string): TraceLogger {
			// Return cached logger if exists, otherwise create new one
			let logger = traceLoggers.get(traceId);
			if (!logger) {
				logger = createTraceLogger(traceId);
				traceLoggers.set(traceId, logger);
			}
			// Auto-set as active trace
			activeTraceId = traceId;
			return logger;
		},

		info(message: string, data?: unknown) {
			const traceId = activeTraceId || useTraceStore.getState().activeTraceId;
			if (!traceId) {
				console.info("[debug-logger]", message, data);
				return;
			}

			useTraceStore.getState().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "system-log",
				level: "info",
				summary: message,
				output: data,
			});
		},

		warn(message: string, data?: unknown) {
			const traceId = activeTraceId || useTraceStore.getState().activeTraceId;
			if (!traceId) {
				console.warn("[debug-logger]", message, data);
				return;
			}

			useTraceStore.getState().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "system-log",
				level: "warn",
				summary: message,
				output: data,
			});
		},

		error(message: string, error?: Error) {
			const traceId = activeTraceId || useTraceStore.getState().activeTraceId;
			if (!traceId) {
				console.error("[debug-logger]", message, error);
				return;
			}

			useTraceStore.getState().addEntry({
				traceId,
				timestamp: Date.now(),
				type: "error",
				level: "error",
				summary: message,
				error: error
					? { message: error.message, stack: error.stack }
					: undefined,
			});
		},

		getActiveTraceId(): string | null {
			return activeTraceId || useTraceStore.getState().activeTraceId;
		},

		setActiveTraceId(traceId: string | null) {
			activeTraceId = traceId;
			if (traceId) {
				useTraceStore.getState().setActiveTrace(traceId);
			}
		},
	};
}

/**
 * Singleton debug logger instance
 *
 * Usage:
 * ```ts
 * import { debugLogger } from "@/lib/debug-logger";
 *
 * // Quick logging
 * debugLogger.info("Something happened", { data });
 *
 * // Scoped trace logging
 * const trace = debugLogger.trace(traceId);
 * trace.start({ sessionId, userPrompt });
 * trace.toolCall("cms_getPage", { slug: "home" }, "call-123");
 * trace.complete();
 * ```
 */
export const debugLogger = createDebugLogger();
