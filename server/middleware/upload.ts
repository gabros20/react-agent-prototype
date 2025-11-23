import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { validateImageUpload } from "../utils/file-validation";

// Multer configuration - store in memory for validation
export const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880", 10), // 5MB default
		files: parseInt(process.env.MAX_FILES_PER_UPLOAD || "10", 10),
	},
	fileFilter: (req, file, cb) => {
		const allowedMimes = [
			"image/jpeg",
			"image/png",
			"image/gif",
			"image/webp",
			"image/avif",
		];

		if (!allowedMimes.includes(file.mimetype)) {
			return cb(new Error(`File type not allowed: ${file.mimetype}`));
		}

		cb(null, true);
	},
});

/**
 * Validation middleware for uploaded files
 */
export async function validateUploadedFiles(
	req: Request,
	res: Response,
	next: NextFunction
) {
	if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
		return res.status(400).json({ error: "No files uploaded" });
	}

	try {
		for (const file of req.files) {
			const validation = await validateImageUpload(
				file.buffer,
				file.originalname
			);

			if (!validation.valid) {
				return res.status(400).json({
					error: "File validation failed",
					details: validation.errors,
				});
			}
		}

		next();
	} catch (error) {
		res.status(500).json({ error: "File validation failed" });
	}
}
