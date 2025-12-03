import type { DrizzleDB } from "../db/client";
import type { VectorIndexService } from "../services/vector-index";
import type { ServiceContainer } from "../services/service-container";
import type { SessionService } from "../services/session-service";

// Tool metadata
export interface ToolMetadata {
	id: string; // "cms.createPage"
	category: "cms" | "memory" | "http" | "planning";
	riskLevel: "safe" | "moderate" | "high";
	requiresApproval: boolean; // HITL flag
	tags: string[]; // ['write', 'page', 'cms']
}

// Logger interface for agent context
export interface AgentLogger {
	info: (msg: string | object, meta?: Record<string, unknown>) => void;
	warn: (msg: string | object, meta?: Record<string, unknown>) => void;
	error: (msg: string | object, meta?: Record<string, unknown>) => void;
}

// Stream writer interface for real-time updates
export interface StreamWriter {
	write: (event: StreamEvent) => void;
}

// Agent context passed to all tool executions
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

	// Services
	services: ServiceContainer;

	// Session service for message persistence
	sessionService: SessionService;

	// CMS Target (for multi-tenant operations)
	cmsTarget?: {
		siteId: string;
		environmentId: string;
	};
}

// Log entry types
export interface LogEntry {
	id: string;
	traceId: string;
	stepId: string;
	timestamp: Date;
	level: "info" | "warn" | "error";
	message: string;
	metadata?: Record<string, unknown>;
}

// Stream event types
export interface StepCompleteEvent {
	type: "step-complete";
	traceId: string;
	stepId: string;
	stepNumber: number;
	toolCalls?: Array<{
		toolName: string;
		input: unknown;
	}>;
	toolResults?: Array<{
		success: boolean;
		output: unknown;
	}>;
}

export interface ErrorEvent {
	type: "error";
	traceId: string;
	error: string;
	details?: unknown;
}

export interface LogEvent {
	type: "log";
	traceId: string;
	level: "info" | "warn" | "error";
	message: string;
	metadata?: Record<string, unknown>;
}

export type StreamEvent = StepCompleteEvent | ErrorEvent | LogEvent;
