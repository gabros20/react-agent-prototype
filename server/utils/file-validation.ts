import { fileTypeFromBuffer } from "file-type";
import sanitize from "sanitize-filename";
import path from "node:path";

interface ValidationResult {
	valid: boolean;
	errors: string[];
}

const ALLOWED_IMAGE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/avif",
];

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "5242880", 10); // 5MB default

/**
 * Validate uploaded file buffer
 */
export async function validateImageUpload(
	buffer: Buffer,
	originalName: string,
): Promise<ValidationResult> {
	const errors: string[] = [];

	// Check MIME type from binary signature (not just extension)
	const fileType = await fileTypeFromBuffer(buffer);

	if (!fileType || !ALLOWED_IMAGE_TYPES.includes(fileType.mime)) {
		errors.push(`Invalid file type: ${fileType?.mime || "unknown"}. Allowed: JPEG, PNG, GIF, WebP, AVIF`);
	}

	// Validate file size
	if (buffer.length > MAX_FILE_SIZE) {
		errors.push(
			`File too large: ${buffer.length} bytes (max ${MAX_FILE_SIZE} bytes = ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
		);
	}

	// Sanitize filename
	const safeName = sanitize(originalName);
	if (safeName !== originalName) {
		errors.push("Filename contains invalid characters");
	}

	// Check for path traversal attempts
	if (
		originalName.includes("..") ||
		originalName.includes("/") ||
		originalName.includes("\\")
	) {
		errors.push("Filename contains path traversal characters");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Generate safe filename using UUID
 */
export function generateSafeFilename(originalName: string): string {
	const ext = path.extname(originalName).toLowerCase();
	const safeExt = ext.replace(/[^a-z0-9]/gi, "");
	const uuid = crypto.randomUUID();

	return `${uuid}${safeExt ? `.${safeExt}` : ""}`;
}

/**
 * Prevent path traversal attacks
 */
export function securePath(baseDir: string, userPath: string): string {
	const resolved = path.resolve(baseDir, userPath);

	if (!resolved.startsWith(path.resolve(baseDir))) {
		throw new Error("Path traversal attempt detected");
	}

	return resolved;
}
