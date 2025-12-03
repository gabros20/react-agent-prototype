/**
 * Debug Logger Module
 *
 * Provides a clean abstraction layer over the trace-store for debug logging.
 * Decouples logging concerns from SSE parsing and agent communication.
 *
 * @example
 * ```ts
 * import { debugLogger } from "@/lib/debug-logger";
 *
 * // Quick logging (goes to active trace)
 * debugLogger.info("Something happened", { data });
 * debugLogger.warn("Warning message");
 * debugLogger.error("Error occurred", new Error("details"));
 *
 * // Scoped trace logging (for agent execution flows)
 * const trace = debugLogger.trace(traceId);
 * trace.start({ sessionId, userPrompt: "User's question" });
 * trace.toolCall("cms_getPage", { slug: "home" }, "call-123");
 * trace.toolResult("call-123", { id: "page-1", name: "Home" });
 * trace.stepComplete(1, { tokens: 150 });
 * trace.complete({ tokens: { input: 500, output: 200 } });
 * ```
 *
 * @example React Hooks
 * ```tsx
 * import { useDebugLogger, useTraceLogger, useQuickLog } from "@/lib/debug-logger";
 *
 * function MyComponent() {
 *   const logger = useDebugLogger();
 *   logger.info("Component event", { action: "click" });
 *
 *   // Or use quick log with prefix
 *   const { log, warn, error } = useQuickLog("MyComponent");
 *   log("Something happened");
 * }
 * ```
 */

// Main exports
export { debugLogger } from "./debug-logger";
export { createTraceLogger } from "./trace-logger";

// React hooks
export { useDebugLogger, useTraceLogger, useQuickLog } from "./hooks";

// Types
export type {
	DebugLogger,
	TraceLogger,
	TraceMetrics,
	ModelPricing,
	TraceStartOptions,
	TraceCompleteOptions,
	TraceEntryType,
	TraceLevel,
} from "./types";
