/**
 * Worker Events Routes
 *
 * SSE endpoint for streaming worker events to the debug panel.
 * Subscribes to Redis pub/sub channel and forwards events to connected clients.
 */

import express from "express";
import { getSubscriber, WorkerEvent } from "../services/worker-events.service";
import { imageQueue } from "../queues/image-queue";

export function createWorkerEventsRoutes() {
	const router = express.Router();

	// GET /v1/worker-events/stream - SSE stream for worker events
	router.get("/stream", async (req, res) => {
		// Setup SSE headers
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");
		res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
		res.flushHeaders();

		// SSE helper
		const writeSSE = (event: string, data: unknown) => {
			res.write(`event: ${event}\n`);
			res.write(`data: ${JSON.stringify(data)}\n\n`);
		};

		// Get the subscriber (singleton)
		const subscriber = getSubscriber();

		// Ensure we're subscribed
		if (!subscriber.isConnected()) {
			try {
				await subscriber.subscribe();
			} catch (error) {
				console.error("[WorkerEvents] Failed to subscribe:", error);
				writeSSE("error", { message: "Failed to connect to worker events" });
				res.end();
				return;
			}
		}

		// Send initial connection event with current queue status
		try {
			const [waitingCount, activeCount, completedCount, failedCount] = await Promise.all([
				imageQueue.getWaitingCount(),
				imageQueue.getActiveCount(),
				imageQueue.getCompletedCount(),
				imageQueue.getFailedCount(),
			]);

			writeSSE("connected", {
				type: "connected",
				timestamp: Date.now(),
				queueStatus: {
					waiting: waitingCount,
					active: activeCount,
					completed: completedCount,
					failed: failedCount,
				},
			});
		} catch (error) {
			console.warn("[WorkerEvents] Failed to get initial queue status:", error);
			writeSSE("connected", {
				type: "connected",
				timestamp: Date.now(),
				queueStatus: null,
			});
		}

		// Forward worker events to this client
		const eventHandler = (event: WorkerEvent) => {
			// Map internal event types to trace-store compatible types
			const traceType = mapEventType(event.type);
			writeSSE("worker-event", {
				...event,
				traceType,
			});
		};

		subscriber.on("event", eventHandler);

		// Heartbeat to keep connection alive (every 30 seconds)
		const heartbeatInterval = setInterval(() => {
			writeSSE("heartbeat", { timestamp: Date.now() });
		}, 30000);

		// Cleanup on client disconnect
		req.on("close", () => {
			subscriber.off("event", eventHandler);
			clearInterval(heartbeatInterval);
			console.log("[WorkerEvents] Client disconnected from SSE stream");
		});

		// Handle errors
		req.on("error", (error) => {
			console.error("[WorkerEvents] SSE connection error:", error);
			subscriber.off("event", eventHandler);
			clearInterval(heartbeatInterval);
		});
	});

	// GET /v1/worker-events/status - Get current queue status (non-streaming)
	router.get("/status", async (req, res) => {
		try {
			const [waitingCount, activeCount, completedCount, failedCount, waitingJobs, activeJobs] = await Promise.all([
				imageQueue.getWaitingCount(),
				imageQueue.getActiveCount(),
				imageQueue.getCompletedCount(),
				imageQueue.getFailedCount(),
				imageQueue.getWaiting(0, 10), // Get first 10 waiting jobs
				imageQueue.getActive(0, 10), // Get first 10 active jobs
			]);

			res.json({
				success: true,
				data: {
					counts: {
						waiting: waitingCount,
						active: activeCount,
						completed: completedCount,
						failed: failedCount,
					},
					waitingJobs: waitingJobs.map((j) => ({
						id: j.id,
						name: j.name,
						imageId: j.data?.imageId,
						addedAt: j.timestamp,
					})),
					activeJobs: activeJobs.map((j) => ({
						id: j.id,
						name: j.name,
						imageId: j.data?.imageId,
						startedAt: j.processedOn,
						progress: j.progress,
					})),
				},
			});
		} catch (error) {
			console.error("[WorkerEvents] Failed to get queue status:", error);
			res.status(500).json({
				success: false,
				error: "Failed to get queue status",
			});
		}
	});

	return router;
}

// Map internal event types to trace-store compatible types
function mapEventType(type: WorkerEvent["type"]): string {
	switch (type) {
		case "job-queued":
			return "job-queued";
		case "job-active":
			return "job-progress"; // Show as progress when starting
		case "job-progress":
			return "job-progress";
		case "job-completed":
			return "job-complete";
		case "job-failed":
			return "job-failed";
		default:
			return "system-log";
	}
}
