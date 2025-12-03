"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useTraceStore } from "../_stores/trace-store";
import { debugLogger } from "@/lib/debug-logger";

// EventSource readyState constants (avoid SSR issues with EventSource global)
const SSE_OPEN = 1;
const SSE_CLOSED = 2;

interface WorkerEvent {
	type: "job-queued" | "job-active" | "job-progress" | "job-completed" | "job-failed";
	traceType: string;
	jobId: string;
	jobName: string;
	imageId: string;
	timestamp: number;
	progress?: number;
	duration?: number;
	error?: string;
	queueSize?: number;
	attempt?: number;
	maxAttempts?: number;
}

interface QueueStatus {
	waiting: number;
	active: number;
	completed: number;
	failed: number;
}

/**
 * Hook to subscribe to worker events via SSE.
 * Connects on mount, reconnects on disconnect, adds events to trace store.
 */
export function useWorkerEvents() {
	const activeTraceId = useTraceStore((state) => state.activeTraceId);

	const [isConnected, setIsConnected] = useState(false);

	// Track seen jobs to prevent duplicate entries
	const seenJobsRef = useRef<Set<string>>(new Set());
	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const reconnectAttempts = useRef(0);
	const maxReconnectAttempts = 10;

	const connect = useCallback(() => {
		// Don't create duplicate connections
		if (eventSourceRef.current?.readyState === SSE_OPEN) {
			return;
		}

		// Clean up existing connection
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
		}

		// Connect to Express backend directly (not Next.js)
		const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
		const eventSource = new EventSource(`${backendUrl}/v1/worker-events/stream`);
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			console.log("[WorkerEvents] SSE connected");
			reconnectAttempts.current = 0;
			setIsConnected(true);
		};

		// Handle connected event with queue status
		eventSource.addEventListener("connected", (e) => {
			try {
				const data = JSON.parse(e.data);
				const status: QueueStatus | null = data.queueStatus;

				if (status && (status.waiting > 0 || status.active > 0)) {
					console.log("[WorkerEvents] Queue status:", status);

					// Log queue status to active trace
					const traceId = activeTraceId || "worker-events";
					const trace = debugLogger.trace(traceId);
					trace.systemLog(
						`Image queue: ${status.waiting} waiting, ${status.active} active`,
						status
					);
				}
			} catch (err) {
				console.error("[WorkerEvents] Failed to parse connected event:", err);
			}
		});

		// Handle worker events
		eventSource.addEventListener("worker-event", (e) => {
			try {
				const event: WorkerEvent = JSON.parse(e.data);
				handleWorkerEvent(event);
			} catch (err) {
				console.error("[WorkerEvents] Failed to parse worker event:", err);
			}
		});

		// Handle heartbeat (keep-alive)
		eventSource.addEventListener("heartbeat", () => {
			// Just keep alive, no action needed
		});

		// Handle errors
		eventSource.addEventListener("error", () => {
			setIsConnected(false);
			// Reconnect only on CLOSED state, not CONNECTING or OPEN
			if (eventSource.readyState === SSE_CLOSED) {
				handleReconnect();
			}
		});

		function handleWorkerEvent(event: WorkerEvent) {
			// Use active trace or a dedicated worker-events trace
			const traceId = activeTraceId || "worker-events";
			const trace = debugLogger.trace(traceId);
			const seenJobs = seenJobsRef.current;

			switch (event.type) {
				case "job-queued": {
					// Skip if already tracked (duplicate event)
					if (seenJobs.has(event.jobId)) {
						break;
					}
					seenJobs.add(event.jobId);
					trace.jobQueued(event.jobId, event.jobName, event.imageId);
					break;
				}

				case "job-active": {
					// Job started processing - update to progress state
					trace.jobProgress(event.jobId, 0);
					break;
				}

				case "job-progress": {
					trace.jobProgress(event.jobId, event.progress || 0);
					break;
				}

				case "job-completed": {
					trace.jobComplete(event.jobId, event.duration);
					seenJobs.delete(event.jobId);
					break;
				}

				case "job-failed": {
					trace.jobFailed(event.jobId, event.error || "Unknown error");
					seenJobs.delete(event.jobId);
					break;
				}
			}
		}

		function handleReconnect() {
			// Clear existing timeout
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}

			reconnectAttempts.current++;

			if (reconnectAttempts.current > maxReconnectAttempts) {
				console.error("[WorkerEvents] Max reconnect attempts reached");
				return;
			}

			// Exponential backoff: 1s, 2s, 4s, 8s, ... up to 30s
			const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 30000);
			console.log(`[WorkerEvents] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);

			reconnectTimeoutRef.current = setTimeout(() => {
				connect();
			}, delay);
		}
	}, [activeTraceId]);

	const disconnect = useCallback(() => {
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}

		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
		setIsConnected(false);
	}, []);

	// Connect on mount, disconnect on unmount
	useEffect(() => {
		connect();

		return () => {
			disconnect();
		};
	}, [connect, disconnect]);

	return {
		connect,
		disconnect,
		isConnected,
	};
}
