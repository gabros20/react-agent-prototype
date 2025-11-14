import "dotenv/config";
import path from "node:path";
import express from "express";
import { db } from "./db/client";
import { RendererService } from "./services/renderer";
import { ServiceContainer } from "./services/service-container";

const app = express();
const PORT = process.env.PREVIEW_PORT || 4000;
const TEMPLATE_DIR = process.env.TEMPLATE_DIR || path.join(__dirname, "templates");

async function startPreviewServer() {
  try {
    const services = await ServiceContainer.initialize(db);
    console.log("✓ Services initialized for preview");

    const renderer = new RendererService(TEMPLATE_DIR);
    console.log("✓ Renderer initialized");

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

        const page = await services.pageService.getPageBySlug(slug);

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

    app.use("/assets", express.static(path.join(TEMPLATE_DIR, "assets")));

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
      console.log(`✅ Preview server running on http://localhost:${PORT}`);
      console.log(`   Preview pages: http://localhost:${PORT}/pages/home?locale=en`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("❌ Failed to start preview server:", error);
    process.exit(1);
  }
}

startPreviewServer();
