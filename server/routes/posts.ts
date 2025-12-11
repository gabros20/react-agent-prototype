import express from "express";
import type { RendererService } from "../services/renderer";
import type { EntryService } from "../services/cms/entry-service";

export function createPostsRouter(
  renderer: RendererService,
  entryService: EntryService
) {
  const router = express.Router();

  /**
   * GET /posts/:collectionSlug
   * List all published posts for a collection
   */
  router.get("/:collectionSlug", async (req, res) => {
    try {
      const { collectionSlug } = req.params;
      const locale = (req.query.locale as string) || "en";

      // Get collection definition
      const collection = await entryService.getCollectionTemplateBySlug(collectionSlug);

      if (!collection) {
        return res.status(404).send(`
          <html>
            <head><title>Collection Not Found</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 4rem;">
              <h1>404 - Collection Not Found</h1>
              <p>The collection "${collectionSlug}" does not exist.</p>
              <a href="/" style="color: #3b82f6; text-decoration: none;">← Back to Home</a>
            </body>
          </html>
        `);
      }

      // Get all published entries
      const entries = await entryService.listPublishedEntries(collection.id, locale);

      // Render listing page
      const html = await renderer.renderPostList(
        entries,
        collectionSlug,
        collection.name,
        locale,
        collection.description || undefined
      );

      res.send(html);
    } catch (error) {
      console.error("Error rendering post list:", error);
      res.status(500).send(`
        <html>
          <head><title>Server Error</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 4rem;">
            <h1>500 - Server Error</h1>
            <p>An error occurred while rendering the post list.</p>
            <pre style="text-align: left; background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; max-width: 600px; margin: 2rem auto;">${error instanceof Error ? error.message : String(error)}</pre>
            <a href="/" style="color: #3b82f6; text-decoration: none;">← Back to Home</a>
          </body>
        </html>
      `);
    }
  });

  /**
   * GET /posts/:collectionSlug/:postSlug
   * View a single post
   */
  router.get("/:collectionSlug/:postSlug", async (req, res) => {
    try {
      const { collectionSlug, postSlug } = req.params;
      const locale = (req.query.locale as string) || "en";

      // Get collection definition
      const collection = await entryService.getCollectionTemplateBySlug(collectionSlug);

      if (!collection) {
        return res.status(404).send(`
          <html>
            <head><title>Collection Not Found</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 4rem;">
              <h1>404 - Collection Not Found</h1>
              <p>The collection "${collectionSlug}" does not exist.</p>
              <a href="/" style="color: #3b82f6; text-decoration: none;">← Back to Home</a>
            </body>
          </html>
        `);
      }

      // Get post by slug
      const entry = await entryService.getEntryBySlug(postSlug, locale);

      if (!entry) {
        return res.status(404).send(`
          <html>
            <head><title>Post Not Found</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 4rem;">
              <h1>404 - Post Not Found</h1>
              <p>The post "${postSlug}" does not exist.</p>
              <a href="/posts/${collectionSlug}?locale=${locale}" style="color: #3b82f6; text-decoration: none;">← Back to ${collection.name}</a>
            </body>
          </html>
        `);
      }

      // Check if post is published (allow draft in development)
      if (entry.status !== "published" && process.env.NODE_ENV === "production") {
        return res.status(404).send(`
          <html>
            <head><title>Post Not Found</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 4rem;">
              <h1>404 - Post Not Found</h1>
              <p>The post "${postSlug}" is not available.</p>
              <a href="/posts/${collectionSlug}?locale=${locale}" style="color: #3b82f6; text-decoration: none;">← Back to ${collection.name}</a>
            </body>
          </html>
        `);
      }

      // Render post
      const html = await renderer.renderPost(entry, locale, collectionSlug);

      res.send(html);
    } catch (error) {
      console.error("Error rendering post:", error);
      res.status(500).send(`
        <html>
          <head><title>Server Error</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 4rem;">
            <h1>500 - Server Error</h1>
            <p>An error occurred while rendering the post.</p>
            <pre style="text-align: left; background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; max-width: 600px; margin: 2rem auto;">${error instanceof Error ? error.message : String(error)}</pre>
            <a href="/" style="color: #3b82f6; text-decoration: none;">← Back to Home</a>
          </body>
        </html>
      `);
    }
  });

  return router;
}
