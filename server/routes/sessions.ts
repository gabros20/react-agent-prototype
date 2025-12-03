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
  modelId: z.string().optional(),
});

const createMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.any(), // JSON content
  toolName: z.string().optional(),
  stepIdx: z.number().int().optional(),
});

const createConversationLogSchema = z.object({
  userPrompt: z.string(),
  entries: z.array(z.any()),
  metrics: z.object({
    totalDuration: z.number(),
    toolCallCount: z.number(),
    stepCount: z.number(),
    tokens: z.object({ input: z.number(), output: z.number() }),
    cost: z.number(),
    errorCount: z.number(),
  }),
  modelInfo: z.object({
    modelId: z.string(),
    pricing: z.object({ prompt: z.number(), completion: z.number() }).nullable(),
  }).optional(),
  startedAt: z.string().transform((s) => new Date(s)),
  completedAt: z.string().transform((s) => new Date(s)).optional(),
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
  // WORKING MEMORY
  // =========================================================================

  // GET /v1/sessions/:id/working-memory - Get working memory entities for session
  router.get("/:id/working-memory", async (req, res, next) => {
    try {
      const workingContext = await services.sessionService.loadWorkingContext(req.params.id);
      const state = workingContext.toJSON();

      res.json(ApiResponse.success({
        entities: state.entities,
        size: workingContext.size(),
      }));
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
  // CONVERSATION LOG MANAGEMENT
  // =========================================================================

  // GET /v1/sessions/:id/logs - Get all conversation logs for a session
  router.get("/:id/logs", async (req, res, next) => {
    try {
      const logs = await services.conversationLogService.getSessionLogs(req.params.id);
      res.json(ApiResponse.success(logs));
    } catch (error) {
      next(error);
    }
  });

  // POST /v1/sessions/:id/logs - Save a conversation log
  router.post("/:id/logs", async (req, res, next) => {
    try {
      const input = createConversationLogSchema.parse(req.body);
      const log = await services.conversationLogService.saveConversationLog({
        sessionId: req.params.id,
        ...input,
      });
      res.status(HttpStatus.CREATED).json(ApiResponse.success(log));
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/sessions/:id/logs/stats - Get aggregated stats for a session
  router.get("/:id/logs/stats", async (req, res, next) => {
    try {
      const stats = await services.conversationLogService.getSessionStats(req.params.id);
      res.json(ApiResponse.success(stats));
    } catch (error) {
      next(error);
    }
  });

  // DELETE /v1/sessions/:id/logs - Delete all conversation logs for a session
  router.delete("/:id/logs", async (req, res, next) => {
    try {
      await services.conversationLogService.deleteSessionLogs(req.params.id);
      res.json(ApiResponse.success({ success: true }));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
