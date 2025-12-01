import { Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";
import { getPublisher } from "../services/worker-events.service";

const connection = new Redis({
	host: process.env.REDIS_HOST || "localhost",
	port: parseInt(process.env.REDIS_PORT || "6379", 10),
	maxRetriesPerRequest: null,
});

// Event publisher - initialized lazily
let eventPublisher: ReturnType<typeof getPublisher> | null = null;
function getEventPublisher() {
	if (!eventPublisher) {
		eventPublisher = getPublisher();
	}
	return eventPublisher;
}

// Redis connection events
connection.on("connect", () => {
	console.log("✅ [Queue] Redis connected");
});

connection.on("error", (err) => {
	console.error("❌ [Queue] Redis error:", err.message);
});

export const imageQueue = new Queue("image-processing", {
	connection,
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			type: "exponential",
			delay: 2000,
		},
		removeOnComplete: {
			age: 3600, // Keep completed jobs for 1 hour
			count: 1000,
		},
		removeOnFail: {
			age: 24 * 3600, // Keep failed jobs for 24 hours
		},
	},
});

// Queue events (uses QueueEvents for job lifecycle events)
const queueEvents = new QueueEvents("image-processing", { connection });

queueEvents.on("added", async ({ jobId, name }) => {
	console.log(`📥 [Queue] Job ${name} queued (${jobId})`);

	// Get queue size and publish event
	try {
		const waitingCount = await imageQueue.getWaitingCount();
		const job = await imageQueue.getJob(jobId);
		const imageId = job?.data?.imageId || "unknown";

		await getEventPublisher().jobQueued(jobId, name, imageId, waitingCount);
	} catch (error) {
		// Don't fail job queueing if event publishing fails
		console.warn("[Queue] Failed to publish queued event:", error);
	}
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
	console.error(`❌ [Queue] Job ${jobId} failed:`, failedReason);
});

export interface GenerateMetadataJob {
	imageId: string;
	buffer: Buffer;
}

export interface GenerateVariantsJob {
	imageId: string;
	path: string;
}

export interface GenerateEmbeddingsJob {
	imageId: string;
	metadata: any;
	path: string;
}
