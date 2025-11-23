import rateLimit from "express-rate-limit";
import { ApiResponse, ErrorCodes, HttpStatus } from "../types/api-response";

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100,
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	handler: (req, res) => {
		res
			.status(HttpStatus.TOO_MANY_REQUESTS)
			.json(
				ApiResponse.error(
					ErrorCodes.RATE_LIMIT_EXCEEDED,
					"Too many requests from this IP, please try again later",
				),
			);
	},
});

/**
 * Upload rate limiter
 * 10 uploads per 15 minutes per IP (stricter for upload-heavy operations)
 */
export const uploadLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	skipSuccessfulRequests: false, // Count all requests including successful ones
	handler: (req, res) => {
		res
			.status(HttpStatus.TOO_MANY_REQUESTS)
			.json(
				ApiResponse.error(
					ErrorCodes.RATE_LIMIT_EXCEEDED,
					"Upload limit exceeded. Maximum 10 uploads per 15 minutes.",
				),
			);
	},
});

/**
 * Search rate limiter
 * 30 searches per minute per IP
 */
export const searchLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 30,
	standardHeaders: true,
	legacyHeaders: false,
	handler: (req, res) => {
		res
			.status(HttpStatus.TOO_MANY_REQUESTS)
			.json(
				ApiResponse.error(
					ErrorCodes.RATE_LIMIT_EXCEEDED,
					"Search limit exceeded. Maximum 30 searches per minute.",
				),
			);
	},
});
