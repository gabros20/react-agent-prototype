import express from "express";
import { z } from "zod";
import type { Services } from "../services/types";
import { ApiResponse, ErrorCodes, HttpStatus } from "../types/api-response";
import {
  prepareContextForLLM,
  getModelLimits,
  countTotalTokens,
  modelMessagesToRich,
  richMessagesToModel,
} from "../memory";
import type { ModelMessage } from "ai";

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

export function createSessionRoutes(services: Services) {
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

  // GET /v1/sessions/:id - Get single session with messages (via MessageStore)
  router.get("/:id", async (req, res, next) => {
    try {
      // Get session metadata
      const session = await services.sessionService.getSessionById(req.params.id);

      // Get messages with parts from MessageStore
      const richMessages = await services.messageStore.loadRichMessages(req.params.id);

      res.json(ApiResponse.success({
        ...session,
        messages: richMessages,
      }));
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
        discoveredTools: state.discoveredTools || [],
        usedTools: state.usedTools || [],
        size: workingContext.size(),
        discoveredToolsCount: workingContext.discoveredToolsCount(),
      }));
    } catch (error) {
      next(error);
    }
  });

  // =========================================================================
  // MESSAGE MANAGEMENT
  // =========================================================================

  // POST /v1/sessions/:id/messages - Add message to session (via MessageStore)
  router.post("/:id/messages", async (req, res, next) => {
    try {
      const input = createMessageSchema.parse(req.body);

      // Convert to RichMessage and save via MessageStore
      const { modelMessageToRich } = await import("../memory");
      const richMessage = modelMessageToRich(
        { role: input.role, content: input.content },
        req.params.id
      );

      const result = await services.messageStore.saveRichMessage(richMessage);

      res.status(HttpStatus.CREATED).json(ApiResponse.success({
        id: result.messageId,
        sessionId: req.params.id,
        role: input.role,
        partsCount: result.partsCount,
        tokens: result.tokens,
      }));
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

  // =========================================================================
  // CONTEXT & COMPACTION
  // =========================================================================

  const compactContextSchema = z.object({
    modelId: z.string().optional().default("anthropic/claude-3.5-sonnet"),
    force: z.boolean().optional().default(false),
  });

  // GET /v1/sessions/:id/context-stats - Get context usage statistics
  router.get("/:id/context-stats", async (req, res, next) => {
    try {
      const modelId = (req.query.modelId as string) || "anthropic/claude-3.5-sonnet";
      const messageStore = services.messageStore;

      // Load rich messages directly from MessageStore (includes parts with compactedAt)
      const richMessages = await messageStore.loadRichMessages(req.params.id);
      const currentTokens = countTotalTokens(richMessages);
      const limits = getModelLimits(modelId);
      const availableTokens = limits.contextLimit - limits.maxOutput;
      const usagePercent = Math.round((currentTokens / availableTokens) * 100);

      // Count tool results that are already compacted (use compactedAt field directly)
      let compactedResults = 0;
      for (const msg of richMessages) {
        if (msg.role === "tool") {
          for (const part of msg.parts) {
            if (part.type === "tool-result" && part.compactedAt) {
              compactedResults++;
            }
          }
        }
      }

      res.json(ApiResponse.success({
        modelId,
        currentTokens,
        availableTokens,
        contextLimit: limits.contextLimit,
        outputReserve: limits.maxOutput,
        usagePercent,
        messageCount: richMessages.length,
        compactedResults,
        isApproachingLimit: usagePercent > 80,
        isOverLimit: usagePercent > 95,
      }));
    } catch (error) {
      next(error);
    }
  });

  // POST /v1/sessions/:id/compact - Manually trigger context compaction
  router.post("/:id/compact", async (req, res, next) => {
    try {
      const input = compactContextSchema.parse(req.body);
      const sessionId = req.params.id;
      const messageStore = services.messageStore;

      // Load rich messages from MessageStore (the only source)
      const richMessages = await messageStore.loadRichMessages(sessionId);

      if (richMessages.length === 0) {
        res.json(ApiResponse.success({
          compacted: false,
          reason: "No messages to compact",
          tokensBefore: 0,
          tokensAfter: 0,
        }));
        return;
      }

      const messageCountBefore = richMessages.length;
      const tokensBefore = countTotalTokens(richMessages);

      // Run compaction on rich messages
      const { messages: compactedRich, result } = await prepareContextForLLM(
        richMessagesToModel(richMessages),
        {
          sessionId,
          modelId: input.modelId,
          force: input.force,
        }
      );

      // If pruning happened, update compactedAt on parts in-place (OpenCode pattern)
      if (result.wasPruned && result.debug.prunedOutputs > 0) {
        // Find parts that were pruned (they'll have compactedAt set in the result)
        const compactedRichResult = modelMessagesToRich(compactedRich, sessionId);

        for (const msg of compactedRichResult) {
          if (msg.role === "tool") {
            for (const part of msg.parts) {
              if (part.type === "tool-result" && part.compactedAt) {
                // Update this part in the database
                await messageStore.updatePart(part.id, { compactedAt: part.compactedAt });
              }
            }
          }
        }
      }

      // If full compaction (summary created), clear and save new messages via MessageStore
      if (result.wasCompacted) {
        // Clear existing messages (MessageStore saves to same tables, clearMessages works)
        await services.sessionService.clearMessages(sessionId);

        // Save compacted messages via MessageStore
        const summaryRichMessages = modelMessagesToRich(compactedRich, sessionId);
        for (const richMsg of summaryRichMessages) {
          // Mark as summary if it's an assistant message in a compacted result
          if (richMsg.role === "assistant" && "isSummary" in richMsg) {
            (richMsg as any).isSummary = true;
          }
          await messageStore.saveRichMessage(richMsg);
        }
      }

      // Update session compaction tracking
      if (result.wasCompacted || result.wasPruned) {
        const { eq, sql } = await import("drizzle-orm");
        const schema = await import("../db/schema");
        await services.db.update(schema.sessions)
          .set({
            compactionCount: sql`${schema.sessions.compactionCount} + 1`,
            lastCompactionAt: Date.now(),
            updatedAt: new Date(),
          })
          .where(eq(schema.sessions.id, sessionId));
      }

      res.json(ApiResponse.success({
        compacted: result.wasCompacted || result.wasPruned,
        wasPruned: result.wasPruned,
        wasCompacted: result.wasCompacted,
        tokensBefore: result.tokens.before,
        tokensAfter: result.tokens.final,
        tokensSaved: result.tokens.before - result.tokens.final,
        compressionRatio: result.tokens.before > 0
          ? Math.round(((result.tokens.before - result.tokens.final) / result.tokens.before) * 100)
          : 0,
        prunedOutputs: result.debug.prunedOutputs,
        compactedMessages: result.debug.compactedMessages,
        removedTools: result.debug.removedTools,
        messageCountBefore,
        messageCountAfter: compactedRich.length,
      }));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
