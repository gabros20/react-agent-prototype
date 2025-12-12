/**
 * Agent Context Types
 *
 * Context passed to all tool executions via AI SDK's experimental_context.
 * Moved from server/tools/types.ts as part of prompt system refactor.
 */

import type { DrizzleDB } from "../../db/client";
import type { VectorIndexService } from "../../services/vector-index";
import type { Services } from "../../services/types";

/**
 * Logger interface for agent context
 */
export interface AgentLogger {
	info: (msg: string | object, meta?: Record<string, unknown>) => void;
	warn: (msg: string | object, meta?: Record<string, unknown>) => void;
	error: (msg: string | object, meta?: Record<string, unknown>) => void;
}

/**
 * Stream writer interface for real-time updates
 * Type is `unknown` to avoid circular imports - actual typing enforced in orchestrator
 */
export interface StreamWriter {
	write: (event: unknown) => void;
}

/**
 * Agent context passed to all tool executions
 */
export interface AgentContext {
	// Database access
	db: DrizzleDB;

	// Vector index
	vectorIndex: VectorIndexService;

	// Logging
	logger: AgentLogger;

	// Streaming (for real-time updates)
	stream?: StreamWriter;

	// Tracing
	traceId: string;
	sessionId: string;

	// Services (full services object for tool access)
	services: Services;

	// CMS Target (for multi-tenant operations)
	cmsTarget?: {
		siteId: string;
		environmentId: string;
	};
}
