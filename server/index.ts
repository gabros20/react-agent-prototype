import "dotenv/config";
import express from "express";
import path from "node:path";
import { db } from "./db/client";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/error-handler";
import { createCMSRoutes } from "./routes/cms";
import { createAgentRoutes } from "./routes/agent";
import { createSessionRoutes } from "./routes/sessions";
import { createWorkerEventsRoutes } from "./routes/worker-events";
import { createModelsRoutes } from "./routes/models";
import uploadRoutes from "./routes/upload";
import imageRoutes from "./routes/images";
import { ServiceContainer } from "./services/service-container";
import { getSubscriber } from "./services/worker-events.service";
import { validateToolIndex, initBM25Index, initToolVectorIndex } from "./tools/discovery";

const app = express();
const PORT = process.env.EXPRESS_PORT || 8787;

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  // Skip logging for health checks and static assets
  if (path === '/health' || path.startsWith('/_next') || path.startsWith('/uploads')) {
    return next();
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const method = req.method;
    const statusEmoji = status >= 500 ? '❌' : status >= 400 ? '⚠️' : '✅';

    console.log(`${statusEmoji} [API] ${method} ${path} → ${status} (${duration}ms)`);
  });

  next();
});

// Middleware
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Async startup
async function startServer() {
  try {
    // Validate tool index at startup (fail fast if misconfigured)
    validateToolIndex();

    // Initialize BM25 search index for tool discovery
    initBM25Index();

    // Initialize vector search index for semantic tool discovery (async - generates embeddings)
    // Run in background so server can start immediately - BM25 search works while vectors load
    initToolVectorIndex().catch((err) => {
      console.warn("⚠️ Vector search init failed (BM25 fallback available):", err.message);
    });

    // Initialize services (includes vector index initialization)
    const services = await ServiceContainer.initialize(db);
    console.log("✓ Services initialized");

    // Initialize worker events subscriber for SSE
    const workerEventSubscriber = getSubscriber();
    await workerEventSubscriber.subscribe();
    console.log("✓ Worker events subscriber initialized");

    // Routes
    app.use("/api", uploadRoutes);
    app.use("/api", imageRoutes);
    app.use("/v1/teams/:team/sites/:site/environments/:env", createCMSRoutes(services));
    app.use("/v1/agent", createAgentRoutes(services));
    app.use("/v1/sessions", createSessionRoutes(services));
    app.use("/v1/models", createModelsRoutes());
    app.use("/v1/worker-events", createWorkerEventsRoutes());

    // Serve uploaded images
    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
    app.use("/uploads", express.static(uploadsDir));

    // Health check
    app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        services: {
          database: "connected",
          pages: "ready",
          sections: "ready",
          entries: "ready",
          vectorIndex: "ready",
        },
      });
    });

    // Error handler (must be last)
    app.use(errorHandler);

    // Start server
    app.listen(PORT, () => {
      console.log(`✅ [API] Express API server running on http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   CMS API: http://localhost:${PORT}/v1/teams/dev-team/sites/local-site/environments/main`);
      console.log(`   Agent: http://localhost:${PORT}/v1/agent/stream`);
      console.log(`   Models: http://localhost:${PORT}/v1/models`);
      console.log(`   Worker Events: http://localhost:${PORT}/v1/worker-events/stream`);
      console.log(`   Images: http://localhost:${PORT}/api/images`);
      console.log(`   Upload: http://localhost:${PORT}/api/upload`);
      console.log(`   Uploads: http://localhost:${PORT}/uploads/`);
      console.log(`   Database: ${process.env.DATABASE_URL || 'file:data/sqlite.db'}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
