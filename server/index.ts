import "dotenv/config";
import express from "express";
import { db } from "./db/client";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/error-handler";
import { createCMSRoutes } from "./routes/cms";
import { createAgentRoutes } from "./routes/agent";
import { ServiceContainer } from "./services/service-container";
import './tools'; // Initialize tool registry

const app = express();
const PORT = process.env.EXPRESS_PORT || 8787;

// Middleware
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Async startup
async function startServer() {
  try {
    // Initialize services (includes vector index initialization)
    const services = await ServiceContainer.initialize(db);
    console.log("✓ Services initialized");

    // Routes
    app.use("/v1/teams/:team/sites/:site/environments/:env", createCMSRoutes(services));
    app.use("/v1/agent", createAgentRoutes(services));

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
      console.log(`✅ Express API server running on http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
      console.log(
        `   API base: http://localhost:${PORT}/v1/teams/dev-team/sites/local-site/environments/main`,
      );
      console.log(`   Agent endpoint: http://localhost:${PORT}/v1/agent/stream`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
