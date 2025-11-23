/**
 * Standardized API response types
 * Provides consistent response structure across all endpoints
 */

export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: ApiError;
	meta?: ResponseMeta;
}

export interface ApiError {
	code: string;
	message: string;
	details?: unknown;
}

export interface ResponseMeta {
	timestamp: number;
	requestId?: string;
	pagination?: PaginationMeta;
}

export interface PaginationMeta {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
}

/**
 * Helper functions for creating standardized responses
 */
export const ApiResponse = {
	success: <T>(data: T, meta?: Partial<ResponseMeta>): ApiResponse<T> => ({
		success: true,
		data,
		meta: {
			timestamp: Date.now(),
			...meta,
		},
	}),

	error: (
		code: string,
		message: string,
		details?: unknown,
		meta?: Partial<ResponseMeta>,
	): ApiResponse<never> => ({
		success: false,
		error: {
			code,
			message,
			details,
		},
		meta: {
			timestamp: Date.now(),
			...meta,
		},
	}),

	paginated: <T>(
		data: T[],
		pagination: PaginationMeta,
		meta?: Partial<ResponseMeta>,
	): ApiResponse<T[]> => ({
		success: true,
		data,
		meta: {
			timestamp: Date.now(),
			pagination,
			...meta,
		},
	}),
};

/**
 * Common error codes
 */
export const ErrorCodes = {
	// Validation errors (400)
	VALIDATION_ERROR: "VALIDATION_ERROR",
	INVALID_INPUT: "INVALID_INPUT",
	MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

	// Authentication/Authorization errors (401, 403)
	UNAUTHORIZED: "UNAUTHORIZED",
	FORBIDDEN: "FORBIDDEN",
	INVALID_TOKEN: "INVALID_TOKEN",

	// Resource errors (404, 409)
	NOT_FOUND: "NOT_FOUND",
	ALREADY_EXISTS: "ALREADY_EXISTS",
	CONFLICT: "CONFLICT",

	// Server errors (500)
	INTERNAL_ERROR: "INTERNAL_ERROR",
	DATABASE_ERROR: "DATABASE_ERROR",
	EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",

	// Image-specific errors
	INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
	FILE_TOO_LARGE: "FILE_TOO_LARGE",
	UPLOAD_FAILED: "UPLOAD_FAILED",
	PROCESSING_FAILED: "PROCESSING_FAILED",

	// Rate limiting
	RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
} as const;

/**
 * HTTP status codes helper
 */
export const HttpStatus = {
	OK: 200,
	CREATED: 201,
	NO_CONTENT: 204,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	TOO_MANY_REQUESTS: 429,
	INTERNAL_SERVER_ERROR: 500,
	SERVICE_UNAVAILABLE: 503,
} as const;
