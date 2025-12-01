import express from "express";
import { db } from "../db/client";
import { images } from "../db/schema";
import { eq } from "drizzle-orm";
import imageProcessingService from "../services/storage/image-processing.service";
import { searchLimiter } from "../middleware/rate-limit";
import { ApiResponse, ErrorCodes, HttpStatus } from "../types/api-response";
import type { PaginationMeta } from "../types/api-response";

const router = express.Router();

/**
 * GET /api/images/:id/status
 * Check image processing status
 */
router.get("/api/images/:id/status", async (req, res) => {
	try {
		const status = await imageProcessingService.getImageStatus(req.params.id);
		res.json(ApiResponse.success(status));
	} catch (error) {
		res.status(HttpStatus.NOT_FOUND).json(ApiResponse.error(ErrorCodes.NOT_FOUND, error instanceof Error ? error.message : "Image not found"));
	}
});

/**
 * GET /api/images/:id/thumbnail
 * Serve 150x150 WebP thumbnail from BLOB
 */
router.get("/api/images/:id/thumbnail", async (req, res) => {
	try {
		const image = await db.query.images.findFirst({
			where: eq(images.id, req.params.id),
		});

		if (!image || !image.thumbnailData) {
			return res.status(404).send("Thumbnail not found");
		}

		res.set("Content-Type", "image/webp");
		res.set("Cache-Control", "public, max-age=31536000"); // 1 year
		res.send(image.thumbnailData);
	} catch (error) {
		res.status(500).send("Error serving thumbnail");
	}
});

/**
 * GET /api/images/:id/details
 * Get complete image details with metadata and variants
 */
router.get("/api/images/:id/details", async (req, res) => {
	try {
		const details = await imageProcessingService.getImageWithDetails(req.params.id);
		res.json(ApiResponse.success(details));
	} catch (error) {
		res.status(HttpStatus.NOT_FOUND).json(ApiResponse.error(ErrorCodes.NOT_FOUND, error instanceof Error ? error.message : "Image not found"));
	}
});

/**
 * GET /api/images/conversation/:sessionId
 * Get all images in a conversation
 */
router.get("/api/images/conversation/:sessionId", async (req, res) => {
	try {
		const images = await imageProcessingService.getConversationImages(req.params.sessionId);
		res.json(ApiResponse.success(images));
	} catch (error) {
		res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
			ApiResponse.error(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : "Failed to get images")
		);
	}
});

/**
 * GET /api/images/search?q=query&page=1&limit=10
 * Search images by natural language query with pagination
 */
router.get("/api/images/search", searchLimiter, async (req, res) => {
	try {
		const query = req.query.q as string;
		const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
		const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "10", 10)));

		if (!query) {
			return res.status(HttpStatus.BAD_REQUEST).json(ApiResponse.error(ErrorCodes.MISSING_REQUIRED_FIELD, "Query parameter 'q' is required"));
		}

		const { ServiceContainer } = await import("../services/service-container");
		const vectorIndex = ServiceContainer.get().vectorIndex;
		const offset = (page - 1) * limit;
		const { results, total } = await vectorIndex.searchImages(query, {
			limit,
			offset,
		});

		const totalPages = Math.ceil(total / limit);
		const pagination: PaginationMeta = {
			page,
			limit,
			total,
			totalPages,
			hasNextPage: page < totalPages,
			hasPreviousPage: page > 1,
		};

		res.json(
			ApiResponse.paginated(results, pagination, {
				requestId: req.headers["x-request-id"] as string,
			})
		);
	} catch (error) {
		console.error("Image search error:", error);
		res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
			ApiResponse.error(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : "Search failed")
		);
	}
});

/**
 * POST /api/images/find
 * Find single best match by description (for agents)
 */
router.post("/api/images/find", async (req, res) => {
	try {
		const { description } = req.body;

		if (!description) {
			return res.status(HttpStatus.BAD_REQUEST).json(ApiResponse.error(ErrorCodes.MISSING_REQUIRED_FIELD, "Description field is required"));
		}

		const { ServiceContainer } = await import("../services/service-container");
		const vectorIndex = ServiceContainer.get().vectorIndex;
		const image = await vectorIndex.findImageByDescription(description);

		res.json(ApiResponse.success(image));
	} catch (error) {
		res.status(HttpStatus.NOT_FOUND).json(ApiResponse.error(ErrorCodes.NOT_FOUND, error instanceof Error ? error.message : "Image not found"));
	}
});

/**
 * DELETE /api/images/:id
 * Delete image and clean up all references
 */
router.delete("/api/images/:id", async (req, res) => {
	try {
		await imageProcessingService.deleteImage(req.params.id);
		res.json(ApiResponse.success({ deleted: true, id: req.params.id }));
	} catch (error) {
		res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
			ApiResponse.error(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : "Delete failed")
		);
	}
});

export default router;
