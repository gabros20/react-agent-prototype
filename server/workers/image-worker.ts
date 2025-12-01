import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { imageQueue } from "../queues/image-queue";
import { generateImageMetadata } from "../services/ai/metadata-generation.service";
import imageStorageService from "../services/storage/image-storage.service";
import { db } from "../db/client";
import {
	images,
	imageMetadata,
	imageVariants,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import { getPublisher, WorkerEventPublisher } from "../services/worker-events.service";
import { VectorIndexService } from "../services/vector-index";

const uploadsDir = process.env.UPLOADS_DIR || "./uploads";

// Event publisher for UI debugging
let eventPublisher: WorkerEventPublisher;

// Vector index service (initialized on first use)
let vectorIndex: VectorIndexService | null = null;
async function getVectorIndex(): Promise<VectorIndexService> {
	if (!vectorIndex) {
		vectorIndex = new VectorIndexService(process.env.LANCEDB_DIR || "data/lancedb");
		await vectorIndex.initialize();
		console.log("✅ [Worker] Vector index initialized");
	}
	return vectorIndex;
}

// Redis connection with logging
const redisConnection = new Redis({
	host: process.env.REDIS_HOST || "localhost",
	port: parseInt(process.env.REDIS_PORT || "6379", 10),
	maxRetriesPerRequest: null,
});

redisConnection.on("connect", () => {
	console.log("✅ [Worker] Redis connected");
	// Initialize event publisher after Redis is ready
	eventPublisher = getPublisher();
});

redisConnection.on("error", (err) => {
	console.error("❌ [Worker] Redis error:", err.message);
});

redisConnection.on("close", () => {
	console.log("⚠️  [Worker] Redis connection closed");
});

// Helper to publish progress events (debounced to avoid flooding)
const progressThrottleMap = new Map<string, number>();
async function publishProgress(job: Job, progress: number) {
	const key = job.id || "";
	const now = Date.now();
	const lastPublish = progressThrottleMap.get(key) || 0;

	// Only publish every 500ms or at key milestones (10, 50, 90, 100)
	const isMilestone = [10, 50, 90, 100].includes(progress);
	if (isMilestone || now - lastPublish > 500) {
		progressThrottleMap.set(key, now);
		await eventPublisher?.jobProgress(
			job.id || "unknown",
			job.name,
			job.data.imageId || "unknown",
			progress
		);
	}
}

const worker = new Worker(
	"image-processing",
	async (job) => {
		const { imageId } = job.data;

		try {
			if (job.name === "generate-metadata") {
				await processMetadata(job);
			} else if (job.name === "generate-variants") {
				await processVariants(job);
			} else if (job.name === "generate-embeddings") {
				await processEmbeddings(job);
			}

			return { success: true, imageId };
		} catch (error) {
			console.error(`Job ${job.id} failed:`, error);

			// If this is the final attempt, mark image as failed
			if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
				console.error(`Job ${job.id} failed after all retries. Marking image as failed.`);
				await db
					.update(images)
					.set({
						status: "failed",
						error: error instanceof Error ? error.message : "Unknown error",
						processedAt: new Date(),
					})
					.where(eq(images.id, imageId));
			}

			throw error; // Let BullMQ handle retry
		}
	},
	{
		connection: redisConnection,
		concurrency: 5, // Process 5 images concurrently
		limiter: {
			max: 10,
			duration: 60000, // Max 10 jobs per minute
		},
	}
);

async function processMetadata(job: Job) {
	const { imageId, filePath } = job.data;

	await job.updateProgress(10);
	await publishProgress(job, 10);

	// Read file from disk
	const fullPath = path.join(uploadsDir, filePath);
	const buffer = await fs.readFile(fullPath);

	await job.updateProgress(20);
	await publishProgress(job, 20);

	// Generate metadata with GPT-4o-mini
	const metadata = await generateImageMetadata(buffer);

	await job.updateProgress(50);
	await publishProgress(job, 50);

	// Store in database (upsert - preserve source attribution from Pexels if exists)
	await db
		.insert(imageMetadata)
		.values({
			id: randomUUID(),
			imageId,
			description: metadata.description,
			detailedDescription: metadata.detailedDescription,
			tags: JSON.stringify(metadata.tags),
			categories: JSON.stringify(metadata.categories),
			objects: JSON.stringify(metadata.objects),
			colors: JSON.stringify(metadata.colors),
			mood: metadata.mood,
			style: metadata.style,
			composition: JSON.stringify(metadata.composition),
			searchableText: metadata.searchableText,
			generatedAt: new Date(),
			model: "gpt-4o-mini",
		})
		.onConflictDoUpdate({
			target: imageMetadata.imageId,
			set: {
				// Update with AI-generated metadata, but preserve source attribution
				description: metadata.description,
				detailedDescription: metadata.detailedDescription,
				tags: JSON.stringify(metadata.tags),
				categories: JSON.stringify(metadata.categories),
				objects: JSON.stringify(metadata.objects),
				colors: JSON.stringify(metadata.colors),
				mood: metadata.mood,
				style: metadata.style,
				composition: JSON.stringify(metadata.composition),
				searchableText: metadata.searchableText,
				generatedAt: new Date(),
				model: "gpt-4o-mini",
			},
		});

	await job.updateProgress(80);
	await publishProgress(job, 80);

	// Queue embeddings job
	await imageQueue.add(
		"generate-embeddings",
		{
			imageId,
			metadata,
			filePath, // Pass filePath from job data
		},
		{ jobId: `embeddings-${imageId}` }
	);

	await job.updateProgress(100);
	await publishProgress(job, 100);
}

async function processVariants(job: Job) {
	const { imageId, filePath } = job.data;

	await job.updateProgress(10);
	await publishProgress(job, 10);

	const variants = await imageStorageService.generateVariants(imageId, filePath);

	await job.updateProgress(60);
	await publishProgress(job, 60);

	// Store variants in database
	for (const variant of variants) {
		await db.insert(imageVariants).values({
			id: randomUUID(),
			imageId,
			variantType: variant.variantType as any,
			format: variant.format as any,
			width: variant.width,
			height: variant.height,
			fileSize: variant.fileSize,
			filePath: variant.filePath,
			createdAt: new Date(),
		});
	}

	await job.updateProgress(100);
	await publishProgress(job, 100);
}

async function processEmbeddings(job: Job) {
	const { imageId, metadata, filePath } = job.data;

	await job.updateProgress(10);
	await publishProgress(job, 10);

	try {
		// Get or initialize vector index for this worker process
		const vi = await getVectorIndex();

		await job.updateProgress(30);
		await publishProgress(job, 30);

		// Add to vector index - it will generate embeddings from searchableText using OpenRouter
		await vi.add({
			id: imageId,
			type: "image",
			name: path.basename(filePath || "image"),
			slug: path.basename(filePath || "image"),
			searchableText: metadata.searchableText,
			metadata: {
				description: metadata.description,
				tags: metadata.tags,
				categories: metadata.categories,
				colors: metadata.colors.dominant || [],
				mood: metadata.mood,
				style: metadata.style,
			},
		});

		await job.updateProgress(90);
		await publishProgress(job, 90);
	} catch (error) {
		console.error(`Failed to generate embeddings for image ${imageId}:`, error);
		// Re-throw to mark job as failed - embeddings are important for search
		throw error;
	}

	// Always update image status to completed
	// Even if embeddings fail, the image and metadata are still valid
	await db
		.update(images)
		.set({
			status: "completed",
			processedAt: new Date(),
		})
		.where(eq(images.id, imageId));

	await job.updateProgress(100);
	await publishProgress(job, 100);
}

worker.on("completed", async (job) => {
	const duration = job.finishedOn ? job.finishedOn - (job.processedOn || job.timestamp) : 0;
	console.log(`✅ [Worker] ${job.name} completed for ${job.data.imageId?.substring(0, 8)}... (${duration}ms)`);

	// Publish completion event
	await eventPublisher?.jobCompleted(
		job.id || "unknown",
		job.name,
		job.data.imageId || "unknown",
		duration
	);

	// Clean up throttle map
	progressThrottleMap.delete(job.id || "");
});

worker.on("failed", async (job, err) => {
	const imageId = job?.data?.imageId || "unknown";
	const shortId = imageId.substring(0, 8);
	console.error(`❌ [Worker] ${job?.name} failed for ${shortId}...:`, err.message);

	// Publish failure event
	await eventPublisher?.jobFailed(
		job?.id || "unknown",
		job?.name || "unknown",
		imageId,
		err.message,
		job?.attemptsMade,
		job?.opts?.attempts || 3
	);

	// Clean up throttle map
	progressThrottleMap.delete(job?.id || "");
});

worker.on("error", (err) => {
	console.error("❌ [Worker] Worker error:", err.message);
});

worker.on("active", async (job) => {
	const imageId = job.data.imageId || "unknown";
	const shortId = imageId.substring(0, 8);
	console.log(`⚙️  [Worker] Processing ${job.name} for ${shortId}...`);

	// Publish active event
	await eventPublisher?.jobActive(
		job.id || "unknown",
		job.name,
		imageId,
		job.attemptsMade + 1, // attemptsMade is 0-indexed
		job.opts?.attempts || 3
	);
});

console.log("🚀 [Worker] Image processing worker started");
console.log(`   Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);
console.log(`   Concurrency: 5 jobs`);
console.log(`   Rate limit: 10 jobs/minute`);

// Graceful shutdown
const shutdown = async (signal: string) => {
	console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);
	try {
		await worker.close();
		await eventPublisher?.close();
		console.log("✅ Worker closed successfully");
		process.exit(0);
	} catch (error) {
		console.error("❌ Error during shutdown:", error);
		process.exit(1);
	}
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
