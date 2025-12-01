/**
 * Worker Events Service
 *
 * Redis pub/sub service to bridge worker events to SSE streams.
 * The worker process publishes events, and the main server subscribes
 * to forward them to connected clients via SSE.
 *
 * Channel: worker:events
 *
 * Event types:
 * - job-queued: Job added to queue
 * - job-active: Worker started processing
 * - job-progress: Progress update (0-100)
 * - job-completed: Job finished successfully
 * - job-failed: Job failed with error
 */

import Redis from "ioredis";
import { EventEmitter } from "events";

// Channel name for worker events
const WORKER_EVENTS_CHANNEL = "worker:events";

// Event types matching trace-store types
export type WorkerEventType =
	| "job-queued"
	| "job-active"
	| "job-progress"
	| "job-completed"
	| "job-failed";

export interface WorkerEvent {
	type: WorkerEventType;
	jobId: string;
	jobName: string; // generate-metadata, generate-variants, generate-embeddings
	imageId: string;
	timestamp: number;
	// Optional fields based on event type
	progress?: number; // 0-100 for job-progress
	duration?: number; // ms for job-completed
	error?: string; // for job-failed
	queueSize?: number; // jobs waiting in queue
	attempt?: number; // retry attempt number
	maxAttempts?: number;
}

/**
 * Publisher - Used by the worker process to emit events
 */
export class WorkerEventPublisher {
	private redis: Redis;
	private connected = false;

	constructor() {
		this.redis = new Redis({
			host: process.env.REDIS_HOST || "localhost",
			port: parseInt(process.env.REDIS_PORT || "6379", 10),
			maxRetriesPerRequest: null,
			retryStrategy: (times) => {
				// Exponential backoff, max 30 seconds
				return Math.min(times * 1000, 30000);
			},
		});

		this.redis.on("connect", () => {
			this.connected = true;
			console.log("✅ [WorkerEvents] Publisher connected to Redis");
		});

		this.redis.on("error", (err) => {
			console.error("❌ [WorkerEvents] Publisher error:", err.message);
		});

		this.redis.on("close", () => {
			this.connected = false;
		});
	}

	async publish(event: WorkerEvent): Promise<void> {
		if (!this.connected) {
			console.warn("[WorkerEvents] Not connected, skipping event:", event.type);
			return;
		}

		try {
			await this.redis.publish(WORKER_EVENTS_CHANNEL, JSON.stringify(event));
		} catch (error) {
			console.error("[WorkerEvents] Failed to publish:", error);
		}
	}

	// Convenience methods for common events
	async jobQueued(jobId: string, jobName: string, imageId: string, queueSize?: number): Promise<void> {
		await this.publish({
			type: "job-queued",
			jobId,
			jobName,
			imageId,
			timestamp: Date.now(),
			queueSize,
		});
	}

	async jobActive(jobId: string, jobName: string, imageId: string, attempt?: number, maxAttempts?: number): Promise<void> {
		await this.publish({
			type: "job-active",
			jobId,
			jobName,
			imageId,
			timestamp: Date.now(),
			attempt,
			maxAttempts,
		});
	}

	async jobProgress(jobId: string, jobName: string, imageId: string, progress: number): Promise<void> {
		await this.publish({
			type: "job-progress",
			jobId,
			jobName,
			imageId,
			timestamp: Date.now(),
			progress,
		});
	}

	async jobCompleted(jobId: string, jobName: string, imageId: string, duration: number): Promise<void> {
		await this.publish({
			type: "job-completed",
			jobId,
			jobName,
			imageId,
			timestamp: Date.now(),
			duration,
		});
	}

	async jobFailed(jobId: string, jobName: string, imageId: string, error: string, attempt?: number, maxAttempts?: number): Promise<void> {
		await this.publish({
			type: "job-failed",
			jobId,
			jobName,
			imageId,
			timestamp: Date.now(),
			error,
			attempt,
			maxAttempts,
		});
	}

	async close(): Promise<void> {
		await this.redis.quit();
	}
}

/**
 * Subscriber - Used by the main server to receive events and forward to SSE
 */
export class WorkerEventSubscriber extends EventEmitter {
	private redis: Redis;
	private connected = false;

	constructor() {
		super();

		this.redis = new Redis({
			host: process.env.REDIS_HOST || "localhost",
			port: parseInt(process.env.REDIS_PORT || "6379", 10),
			maxRetriesPerRequest: null,
			retryStrategy: (times) => {
				return Math.min(times * 1000, 30000);
			},
		});

		this.redis.on("connect", () => {
			this.connected = true;
			console.log("✅ [WorkerEvents] Subscriber connected to Redis");
		});

		this.redis.on("error", (err) => {
			console.error("❌ [WorkerEvents] Subscriber error:", err.message);
		});

		this.redis.on("close", () => {
			this.connected = false;
		});

		// Handle incoming messages
		this.redis.on("message", (channel, message) => {
			if (channel !== WORKER_EVENTS_CHANNEL) return;

			try {
				const event: WorkerEvent = JSON.parse(message);
				this.emit("event", event);
				// Also emit by event type for targeted listeners
				this.emit(event.type, event);
			} catch (error) {
				console.error("[WorkerEvents] Failed to parse event:", error);
			}
		});
	}

	async subscribe(): Promise<void> {
		await this.redis.subscribe(WORKER_EVENTS_CHANNEL);
		console.log(`📡 [WorkerEvents] Subscribed to ${WORKER_EVENTS_CHANNEL}`);
	}

	async unsubscribe(): Promise<void> {
		await this.redis.unsubscribe(WORKER_EVENTS_CHANNEL);
	}

	async close(): Promise<void> {
		await this.unsubscribe();
		await this.redis.quit();
	}

	isConnected(): boolean {
		return this.connected;
	}
}

// Singleton instances for easy import
let publisherInstance: WorkerEventPublisher | null = null;
let subscriberInstance: WorkerEventSubscriber | null = null;

export function getPublisher(): WorkerEventPublisher {
	if (!publisherInstance) {
		publisherInstance = new WorkerEventPublisher();
	}
	return publisherInstance;
}

export function getSubscriber(): WorkerEventSubscriber {
	if (!subscriberInstance) {
		subscriberInstance = new WorkerEventSubscriber();
	}
	return subscriberInstance;
}

// Export channel name for testing
export { WORKER_EVENTS_CHANNEL };
