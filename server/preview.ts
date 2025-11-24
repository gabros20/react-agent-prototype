import "dotenv/config";
import path from "node:path";
import express from "express";
import { db } from "./db/client";
import { RendererService } from "./services/renderer";
import { ServiceContainer } from "./services/service-container";
import { createPostsRouter } from "./routes/posts";

const app = express();
const PORT = process.env.PREVIEW_PORT || 4000;
const TEMPLATE_DIR = process.env.TEMPLATE_DIR || path.join(__dirname, "templates");

async function startPreviewServer() {
  try {
    const services = await ServiceContainer.initialize(db);
    console.log("✓ Services initialized for preview");

    const renderer = new RendererService(TEMPLATE_DIR);
    console.log("✓ Renderer initialized");

    // Request logging middleware
    app.use((req, res, next) => {
      const start = Date.now();
      const path = req.path;

      // Skip logging for health checks and static files
      if (path === '/health' || path.startsWith('/assets') || path.startsWith('/uploads')) {
        return next();
      }

      res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const statusEmoji = status >= 500 ? '❌' : status >= 400 ? '⚠️' : '✅';
        console.log(`${statusEmoji} [Preview] ${req.method} ${path} → ${status} (${duration}ms)`);
      });

      next();
    });

    app.get("/pages/:slug", async (req, res, next) => {
      try {
        const { slug } = req.params;
        const locale = (req.query.locale as string) || "en";

        const html = await renderer.renderPage(slug, locale, services.pageService);

        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } catch (error) {
        next(error);
      }
    });

    app.get("/pages/:slug/raw", async (req, res, next) => {
      try {
        const { slug } = req.params;
        const locale = (req.query.locale as string) || "en";

        // Preview server needs full content
        const page = await services.pageService.getPageBySlug(slug, true, locale);

        if (!page) {
          return res.status(404).json({ error: "Page not found" });
        }

        res.json({ data: page, locale, statusCode: 200 });
      } catch (error) {
        next(error);
      }
    });

    app.get("/", (_req, res) => {
      res.redirect("/pages/home?locale=en");
    });

    // Posts routes
    app.use("/posts", createPostsRouter(renderer, services.entryService));

    // Static files
    app.use("/assets", express.static(path.join(TEMPLATE_DIR, "assets")));

    // Serve uploaded images
    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
    app.use("/uploads", express.static(uploadsDir));

    app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "preview-server",
        templateRegistry: renderer.getTemplateRegistry(),
      });
    });

    app.use(
      (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        console.error("Preview server error:", err);
        res.status(500).send(`
        <html>
          <head><title>Error</title></head>
          <body>
            <h1>Preview Error</h1>
            <p>${err.message}</p>
            <pre>${err.stack}</pre>
          </body>
        </html>
      `);
      },
    );

    app.listen(PORT, () => {
      console.log(`✅ [Preview] Preview server running on http://localhost:${PORT}`);
      console.log(`   Pages: http://localhost:${PORT}/pages/home?locale=en`);
      console.log(`   Raw: http://localhost:${PORT}/pages/home/raw?locale=en`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   Uploads: http://localhost:${PORT}/uploads/`);
      console.log(`   Templates: ${TEMPLATE_DIR}`);
      console.log(`   Database: ${process.env.DATABASE_URL || 'file:data/sqlite.db'}`);
    });
  } catch (error) {
    console.error("❌ Failed to start preview server:", error);
    process.exit(1);
  }
}

startPreviewServer();
