import express from "express";
import { z } from "zod";
import type { ServiceContainer } from "../services/service-container";
import { ApiResponse, ErrorCodes, HttpStatus } from "../types/api-response";

const createSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

const updateSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  archived: z.boolean().optional(),
});

const createMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.any(), // JSON content
  toolName: z.string().optional(),
  stepIdx: z.number().int().optional(),
});

export function createSessionRoutes(services: ServiceContainer) {
  const router = express.Router();

  // =========================================================================
  // SESSION MANAGEMENT
  // =========================================================================

  // POST /v1/sessions - Create new session
  router.post("/", async (req, res, next) => {
    try {
      const input = createSessionSchema.parse(req.body);
      const session = await services.sessionService.createSession(input);

      res.status(HttpStatus.CREATED).json(ApiResponse.success(session));
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/sessions - List all sessions with metadata
  router.get("/", async (req, res, next) => {
    try {
      const sessions = await services.sessionService.listSessions();

      res.json(ApiResponse.success(sessions));
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/sessions/:id - Get single session with messages
  router.get("/:id", async (req, res, next) => {
    try {
      const session = await services.sessionService.getSessionById(req.params.id);

      res.json(ApiResponse.success(session));
    } catch (error) {
      next(error);
    }
  });

  // PATCH /v1/sessions/:id - Update session (title, archived flag)
  router.patch("/:id", async (req, res, next) => {
    try {
      const input = updateSessionSchema.parse(req.body);
      const session = await services.sessionService.updateSession(req.params.id, input);

      res.json(ApiResponse.success(session));
    } catch (error) {
      next(error);
    }
  });

  // DELETE /v1/sessions/:id - Delete session permanently
  router.delete("/:id", async (req, res, next) => {
    try {
      const result = await services.sessionService.deleteSession(req.params.id);

      res.json(ApiResponse.success(result));
    } catch (error) {
      next(error);
    }
  });

  // =========================================================================
  // MESSAGE MANAGEMENT
  // =========================================================================

  // POST /v1/sessions/:id/messages - Add message to session
  router.post("/:id/messages", async (req, res, next) => {
    try {
      const input = createMessageSchema.parse(req.body);
      const message = await services.sessionService.addMessage(req.params.id, input);

      res.status(HttpStatus.CREATED).json(ApiResponse.success(message));
    } catch (error) {
      next(error);
    }
  });

  // DELETE /v1/sessions/:id/messages - Clear all messages (keep session)
  router.delete("/:id/messages", async (req, res, next) => {
    try {
      const result = await services.sessionService.clearMessages(req.params.id);

      res.json(ApiResponse.success(result));
    } catch (error) {
      next(error);
    }
  });

  // =========================================================================
  // CHECKPOINT MANAGEMENT
  // =========================================================================

  // DELETE /v1/sessions/:id/checkpoint - Clear checkpoint
  router.delete("/:id/checkpoint", async (req, res, next) => {
    try {
      const result = await services.sessionService.clearCheckpoint(req.params.id);

      res.json(ApiResponse.success(result));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
