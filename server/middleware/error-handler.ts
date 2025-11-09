import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error("Error:", err);

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: err.issues,
      },
      statusCode: 400,
    });
  }

  // SQLite constraint errors
  if (err.message && err.message.includes("UNIQUE constraint failed")) {
    return res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "Resource already exists",
        details: err.message,
      },
      statusCode: 409,
    });
  }

  // Not found errors
  if (err.message && err.message.toLowerCase().includes("not found")) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: err.message,
      },
      statusCode: 404,
    });
  }

  // Invalid format errors
  if (err.message && err.message.toLowerCase().includes("invalid")) {
    return res.status(400).json({
      error: {
        code: "INVALID_INPUT",
        message: err.message,
      },
      statusCode: 400,
    });
  }

  // Generic error
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: err.message || "Internal server error",
    },
    statusCode: 500,
  });
};
