/**
 * Upload Routes
 *
 * Handles image uploads with session tracking.
 */

import express from "express";
import { upload, validateUploadedFiles } from "../middleware/upload";
import { uploadLimiter } from "../middleware/rate-limit";
import imageProcessingService from "../services/storage/image-processing.service";
import { ApiResponse, ErrorCodes, HttpStatus } from "../types/api-response";
import type { Services } from "../services/types";

/**
 * Create upload routes with services injection
 */
export function createUploadRoutes(services: Services) {
	const router = express.Router();

	/**
	 * POST /api/upload
	 * Upload one or more images
	 * Query/body params: sessionId (required)
	 */
	router.post(
		"/api/upload",
		uploadLimiter,
		upload.array("files", 10),
		validateUploadedFiles,
		async (req, res) => {
			try {
				const files = req.files as Express.Multer.File[];
				const sessionId = (req.body.sessionId || req.query.sessionId) as string;

				if (!sessionId) {
					return res
						.status(HttpStatus.BAD_REQUEST)
						.json(
							ApiResponse.error(
								ErrorCodes.MISSING_REQUIRED_FIELD,
								"sessionId is required",
							),
						);
				}

				const uploadedImages = [];

				for (const file of files) {
					const result = await imageProcessingService.processImage({
						buffer: file.buffer,
						filename: file.originalname,
						sessionId,
						mediaType: file.mimetype,
					});

					uploadedImages.push({
						id: result.imageId,
						filename: file.originalname,
						status: result.status,
						isNew: result.isNew,
						url: `/api/images/${result.imageId}`,
					});
				}

				res
					.status(HttpStatus.CREATED)
					.json(
						ApiResponse.success(uploadedImages, {
							requestId: req.headers["x-request-id"] as string,
						}),
					);
			} catch (error) {
				services.logger.error("Upload error", { error: error instanceof Error ? error.message : String(error) });
				res
					.status(HttpStatus.INTERNAL_SERVER_ERROR)
					.json(
						ApiResponse.error(
							ErrorCodes.UPLOAD_FAILED,
							error instanceof Error ? error.message : "Upload failed",
							error,
						),
					);
			}
		},
	);

	return router;
}
