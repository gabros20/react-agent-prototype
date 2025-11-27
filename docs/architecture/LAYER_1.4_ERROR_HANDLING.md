# Layer 1.4: Error Handling

> Consistent error normalization and API response format

## Overview

All errors in the API are caught by a central error handler middleware and normalized to a consistent response format. This includes Zod validation errors, database constraint violations, not-found errors, and unexpected server errors.

**Key Responsibilities:**
- Catch all errors thrown from routes
- Map error types to appropriate HTTP status codes
- Format errors in consistent JSON structure
- Log errors for debugging

---

## The Problem

Without centralized error handling, responses are inconsistent:

```typescript
// Route A
res.status(400).json({ error: "Bad request" });

// Route B
res.status(400).json({ message: "Invalid input", code: "INVALID" });

// Route C
res.status(400).send("Validation failed");

// Unhandled error
throw new Error("Database error");
// Result: Express default HTML error page
```

**Our Solution:**
1. Single error handler middleware (last in stack)
2. Error classification by type/message
3. Consistent `ApiResponse` format
4. Proper HTTP status codes

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      ERROR FLOW                              │
│                                                              │
│  Route Handler                                               │
│       │                                                      │
│       ├── throw new ZodError([...])                          │
│       ├── throw new Error("Not found")                       │
│       ├── throw new Error("UNIQUE constraint failed")        │
│       └── throw new Error("Something unexpected")            │
│       │                                                      │
│       ▼                                                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  Error Handler Middleware              │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  Error Classification                            │  │  │
│  │  │                                                  │  │  │
│  │  │  ZodError?                                       │  │  │
│  │  │    → 400 VALIDATION_ERROR                        │  │  │
│  │  │                                                  │  │  │
│  │  │  "UNIQUE constraint"?                            │  │  │
│  │  │    → 409 CONFLICT                                │  │  │
│  │  │                                                  │  │  │
│  │  │  "not found"?                                    │  │  │
│  │  │    → 404 NOT_FOUND                               │  │  │
│  │  │                                                  │  │  │
│  │  │  "invalid"?                                      │  │  │
│  │  │    → 400 INVALID_INPUT                           │  │  │
│  │  │                                                  │  │  │
│  │  │  Otherwise                                       │  │  │
│  │  │    → 500 INTERNAL_ERROR                          │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │  Response Formatting                             │  │  │
│  │  │                                                  │  │  │
│  │  │  {                                               │  │  │
│  │  │    "error": {                                    │  │  │
│  │  │      "code": "ERROR_CODE",                       │  │  │
│  │  │      "message": "Human readable message",        │  │  │
│  │  │      "details": { ... }  // Optional             │  │  │
│  │  │    },                                            │  │  │
│  │  │    "statusCode": 400                             │  │  │
│  │  │  }                                               │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                        │                                     │
│                        ▼                                     │
│  Client receives consistent error response                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/middleware/error-handler.ts` | Error handler middleware |
| `server/types/api-response.ts` | Response type definitions |
| `server/routes/*.ts` | Routes throw errors to handler |

---

## Core Implementation

### Error Handler Middleware

```typescript
// server/middleware/error-handler.ts
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Log all errors
  console.error("Error:", err);

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: err.issues,  // Zod provides structured issues
      },
      statusCode: 400,
    });
  }

  // SQLite unique constraint violations
  if (err.message?.includes("UNIQUE constraint failed")) {
    return res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "Resource already exists",
        details: err.message,
      },
      statusCode: 409,
    });
  }

  // Not found errors (by convention)
  if (err.message?.toLowerCase().includes("not found")) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: err.message,
      },
      statusCode: 404,
    });
  }

  // Invalid input errors (by convention)
  if (err.message?.toLowerCase().includes("invalid")) {
    return res.status(400).json({
      error: {
        code: "INVALID_INPUT",
        message: err.message,
      },
      statusCode: 400,
    });
  }

  // Generic server error (fallback)
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: err.message || "Internal server error",
    },
    statusCode: 500,
  });
};
```

### API Response Helper

```typescript
// server/types/api-response.ts
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INVALID_INPUT: "INVALID_INPUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export class ApiResponse {
  // Success response
  static success<T>(data: T) {
    return { data, error: null };
  }

  // Error response
  static error(code: string, message: string, details?: unknown) {
    return {
      data: null,
      error: { code, message, details },
    };
  }
}
```

### Usage in Routes

```typescript
// server/routes/cms.ts
router.get("/pages/:page", async (req, res, next) => {
  try {
    const page = await services.pageService.getPageById(req.params.page);

    if (!page) {
      // Option A: Use ApiResponse directly
      return res.status(HttpStatus.NOT_FOUND).json(
        ApiResponse.error(ErrorCodes.NOT_FOUND, "Page not found")
      );
    }

    res.json(ApiResponse.success(page));
  } catch (error) {
    // Option B: Pass to error handler
    next(error);
  }
});

router.post("/pages", async (req, res, next) => {
  try {
    // Zod validates - throws ZodError if invalid
    const input = createPageSchema.parse(req.body);

    const page = await services.pageService.createPage(input);
    res.status(HttpStatus.CREATED).json(ApiResponse.success(page));
  } catch (error) {
    // ZodError caught by error handler → 400 VALIDATION_ERROR
    next(error);
  }
});
```

---

## Error Types and Status Codes

| Error Type | Status | Code | When |
|------------|--------|------|------|
| ZodError | 400 | VALIDATION_ERROR | Schema validation fails |
| "not found" | 404 | NOT_FOUND | Resource doesn't exist |
| "invalid" | 400 | INVALID_INPUT | Business logic validation |
| "UNIQUE constraint" | 409 | CONFLICT | Duplicate resource |
| Other | 500 | INTERNAL_ERROR | Unexpected errors |

### Response Examples

**Validation Error (Zod):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "code": "too_small",
        "minimum": 1,
        "type": "string",
        "inclusive": true,
        "message": "String must contain at least 1 character(s)",
        "path": ["name"]
      }
    ]
  },
  "statusCode": 400
}
```

**Not Found:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Page not found"
  },
  "statusCode": 404
}
```

**Conflict:**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Resource already exists",
    "details": "UNIQUE constraint failed: pages.slug"
  },
  "statusCode": 409
}
```

**Internal Error:**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Connection refused"
  },
  "statusCode": 500
}
```

---

## Design Decisions

### Why String Matching for Error Classification?

```typescript
// Check error message content
if (err.message?.toLowerCase().includes("not found")) {
  return res.status(404)...
}
```

**Alternatives:**
1. Custom error classes (`throw new NotFoundError()`)
2. Error codes (`err.code === "NOT_FOUND"`)
3. Status properties (`err.status = 404`)

**Why string matching:**
1. **Simple** - No custom error class hierarchy
2. **Works with existing errors** - Third-party libraries
3. **Convention-based** - Service layer just throws `Error("Page not found")`
4. **Trade-off** - Less type-safe, but simpler

### Why Include statusCode in Body?

```json
{
  "error": { ... },
  "statusCode": 400
}
```

**Reasons:**
1. **Debugging** - Status visible in response body
2. **Proxies** - Some proxies modify HTTP status
3. **Logging** - Easy to log entire response
4. **Redundancy** - HTTP status is also set

### Why ErrorRequestHandler Type?

```typescript
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // ...
};
```

**Reasons:**
1. **Four parameters** - Express identifies error handlers by arity
2. **Type safety** - TypeScript knows err is Error-like
3. **Explicit** - Clear this is error middleware, not regular

### Why Always Call next(error)?

```typescript
router.post("/pages", async (req, res, next) => {
  try {
    // ...
  } catch (error) {
    next(error);  // Pass to error handler
  }
});
```

**Reasons:**
1. **Centralized handling** - One place for all error logic
2. **Consistency** - Same format for all errors
3. **Async safety** - Express doesn't catch async errors automatically

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 1.3 (Middleware) | Must be LAST middleware |
| Layer 1.5 (Routes) | Routes call `next(error)` |
| Layer 4 (Services) | Services throw errors |
| Layer 6 (Client) | Clients parse error format |

### Client-Side Error Handling

```typescript
// Frontend error parsing
async function fetchPage(id: string) {
  const res = await fetch(`/v1/.../pages/${id}`);
  const data = await res.json();

  if (data.error) {
    // Structured error handling
    if (data.error.code === "NOT_FOUND") {
      showNotFoundPage();
    } else if (data.error.code === "VALIDATION_ERROR") {
      showValidationErrors(data.error.details);
    } else {
      showGenericError(data.error.message);
    }
    return null;
  }

  return data.data;
}
```

---

## Common Issues / Debugging

### Errors Not Caught

```typescript
router.get("/pages", async (req, res) => {
  const pages = await services.pageService.listPages();
  // If this throws, Express shows HTML error page
  res.json(pages);
});
```

**Cause:** Async errors not passed to `next()`.

**Fix:** Always wrap async routes:

```typescript
router.get("/pages", async (req, res, next) => {
  try {
    const pages = await services.pageService.listPages();
    res.json(pages);
  } catch (error) {
    next(error);  // Now caught by error handler
  }
});
```

### Error Handler Not Running

```
// Errors show as HTML, not JSON
```

**Cause:** Error handler not last or not mounted.

**Fix:** Ensure order:

```typescript
// Routes first
app.use("/api", routes);

// Error handler LAST
app.use(errorHandler);
```

### Wrong Status Code

```
// Expected 404, got 500
```

**Cause:** Error message doesn't match pattern.

**Debug:**

```typescript
console.log("Error message:", err.message);
console.log("Includes 'not found':", err.message?.toLowerCase().includes("not found"));
```

**Fix:** Ensure message matches convention:

```typescript
// Service layer
throw new Error("Page not found");  // ✅ Will be 404

throw new Error("Page does not exist");  // ❌ Will be 500
```

### Sensitive Data in Error

```json
{
  "error": {
    "message": "SELECT * FROM users WHERE password = '123'..."
  }
}
```

**Cause:** Raw error messages exposed.

**Fix:** Sanitize in production:

```typescript
const message = process.env.NODE_ENV === 'production'
  ? "Internal server error"
  : err.message;

res.status(500).json({
  error: { code: "INTERNAL_ERROR", message }
});
```

---

## Best Practices

### 1. Service Layer Error Messages

Use consistent error message patterns:

```typescript
// page-service.ts
async getPageById(id: string) {
  const page = await this.db.query.pages.findFirst({...});
  if (!page) {
    throw new Error("Page not found");  // Triggers 404
  }
  return page;
}

async createPage(data) {
  // SQLite throws "UNIQUE constraint failed" → 409
  return this.db.insert(pages).values(data).returning();
}
```

### 2. Validation at Route Level

```typescript
router.post("/pages", async (req, res, next) => {
  try {
    // Zod validation FIRST
    const input = createPageSchema.parse(req.body);

    // Then business logic
    const page = await services.pageService.createPage(input);
    res.json(ApiResponse.success(page));
  } catch (error) {
    next(error);
  }
});
```

### 3. Explicit 404 Responses

```typescript
// Option A: Let error handler do it
const page = await services.pageService.getPageById(id);
// Service throws "not found" error

// Option B: Handle explicitly (clearer)
if (!page) {
  return res.status(404).json(
    ApiResponse.error("NOT_FOUND", "Page not found")
  );
}
```

---

## Further Reading

- [Layer 1.3: Middleware](./LAYER_1.3_MIDDLEWARE.md) - Middleware ordering
- [Layer 1.5: Routes](./LAYER_1.5_ROUTES.md) - Route patterns
- [Express Error Handling](https://expressjs.com/en/guide/error-handling.html)
- [Zod Error Handling](https://zod.dev/?id=error-handling)
