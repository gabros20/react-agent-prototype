/**
 * API Client - Base fetch wrapper with error handling
 *
 * Provides consistent request/response handling for all API calls.
 * All frontend API calls should use this client.
 */

// ============================================================================
// Types
// ============================================================================

export interface ApiResponse<T> {
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
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
};

// ============================================================================
// Core Client
// ============================================================================

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Make an API request with standardized error handling
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, headers, ...rest } = options;

  const response = await fetch(endpoint, {
    ...rest,
    headers: {
      ...DEFAULT_HEADERS,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle non-JSON responses (e.g., SSE streams)
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    if (!response.ok) {
      throw new ApiClientError(
        `Request failed: ${response.statusText}`,
        "REQUEST_FAILED",
        response.status
      );
    }
    // Return response for non-JSON (caller handles stream)
    return response as unknown as T;
  }

  const result: ApiResponse<T> = await response.json();

  if (!response.ok || !result.success) {
    throw new ApiClientError(
      result.error?.message ?? `Request failed: ${response.statusText}`,
      result.error?.code ?? "UNKNOWN_ERROR",
      response.status,
      result.error?.details
    );
  }

  return result.data as T;
}

// ============================================================================
// HTTP Method Helpers
// ============================================================================

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "POST", body }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PATCH", body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PUT", body }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),
};

// ============================================================================
// Date Helpers
// ============================================================================

/**
 * Convert date strings in an object to Date objects
 */
export function parseDates<T extends Record<string, unknown>>(
  obj: T,
  dateFields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of dateFields) {
    if (result[field] && typeof result[field] === "string") {
      result[field] = new Date(result[field] as string) as T[keyof T];
    }
  }
  return result;
}
