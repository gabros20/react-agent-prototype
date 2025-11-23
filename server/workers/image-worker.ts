import { Worker } from "bullmq";
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

const uploadsDir = process.env.UPLOADS_DIR || "./uploads";

// Redis connection with logging
const redisConnection = new Redis({
	host: process.env.REDIS_HOST || "localhost",
	port: parseInt(process.env.REDIS_PORT || "6379", 10),
	maxRetriesPerRequest: null,
});

redisConnection.on("connect", () => {
	console.log("✅ [Worker] Redis connected");
});

redisConnection.on("error", (err) => {
	console.error("❌ [Worker] Redis error:", err.message);
});

redisConnection.on("close", () => {
	console.log("⚠️  [Worker] Redis connection closed");
});

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

async function processMetadata(job: any) {
	const { imageId, filePath } = job.data;

	await job.updateProgress(10);

	// Read file from disk
	const fullPath = path.join(uploadsDir, filePath);
	const buffer = await fs.readFile(fullPath);

	await job.updateProgress(20);

	// Generate metadata with GPT-4o-mini
	const metadata = await generateImageMetadata(buffer);

	await job.updateProgress(50);

	// Store in database
	await db.insert(imageMetadata).values({
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
	});

	await job.updateProgress(80);

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
}

async function processVariants(job: any) {
	const { imageId, filePath } = job.data;

	await job.updateProgress(10);

	const variants = await imageStorageService.generateVariants(imageId, filePath);

	await job.updateProgress(60);

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
}

async function processEmbeddings(job: any) {
	const { imageId, metadata, filePath } = job.data;

	await job.updateProgress(10);

	try {
		// Store in vector index (embeddings generated internally via OpenRouter)
		const { default: vectorIndex } = await import("../services/vector-index");

		await job.updateProgress(30);

		// Add to vector index - it will generate embeddings from searchableText using OpenRouter
		await vectorIndex.add({
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
	} catch (error) {
		console.error(`Failed to generate embeddings for image ${imageId}:`, error);
		// Continue to mark as completed even if embeddings fail
		// The image metadata is still usable, just not searchable via vector search
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
}

worker.on("completed", (job) => {
	const duration = job.finishedOn ? job.finishedOn - (job.processedOn || job.timestamp) : 0;
	console.log(`✅ [Worker] ${job.name} completed for ${job.data.imageId?.substring(0, 8)}... (${duration}ms)`);
});

worker.on("failed", (job, err) => {
	const imageId = job?.data?.imageId?.substring(0, 8) || 'unknown';
	console.error(`❌ [Worker] ${job?.name} failed for ${imageId}...:`, err.message);
});

worker.on("error", (err) => {
	console.error("❌ [Worker] Worker error:", err.message);
});

worker.on("active", (job) => {
	const imageId = job.data.imageId?.substring(0, 8) || 'unknown';
	console.log(`⚙️  [Worker] Processing ${job.name} for ${imageId}...`);
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
		console.log("✅ Worker closed successfully");
		process.exit(0);
	} catch (error) {
		console.error("❌ Error during shutdown:", error);
		process.exit(1);
	}
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
