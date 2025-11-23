import crypto from "node:crypto";

/**
 * Generate MD5 hash from buffer
 */
export function generateMD5(buffer: Buffer): string {
	return crypto.createHash("md5").update(buffer).digest("hex");
}

/**
 * Generate SHA256 hash from buffer (for deduplication)
 */
export function generateSHA256(buffer: Buffer): string {
	return crypto.createHash("sha256").update(buffer).digest("hex");
}
