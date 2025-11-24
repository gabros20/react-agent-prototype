#!/usr/bin/env tsx
/**
 * Update Blog Post Image URLs
 *
 * Updates all blog post featured images and cover images to use actual image file paths from the database.
 * This ensures image URLs are always correct regardless of upload date.
 *
 * Usage: Called automatically by reset-data-only.ts after seed-images.ts
 */

import { db } from "../server/db/client";
import { collectionEntries, entryContents } from "../server/db/schema";
import { eq } from "drizzle-orm";

async function updateBlogImages() {
  console.log("🔄 Updating blog post image URLs...");

  try {
    // Get all images with their actual file paths
    const images = await db.query.images.findMany({
      columns: {
        id: true,
        filePath: true,
      },
    });

    if (images.length === 0) {
      console.log("   ⚠️  No images found in database");
      return;
    }

    console.log(`   Found ${images.length} images`);

    // Create a map of image ID to URL
    const imageUrls = new Map<string, string>();
    for (const img of images) {
      // Convert file_path to URL: images/2025/11/24/original/uuid.jpg → /uploads/images/2025/11/24/original/uuid.jpg
      imageUrls.set(img.id, `/uploads/${img.filePath}`);
    }

    let updatedFeaturedImages = 0;
    let updatedCoverImages = 0;

    // Update featured images in collection_entries
    const entries = await db.query.collectionEntries.findMany({
      where: (ce, { isNotNull }) => isNotNull(ce.featuredImage),
    });

    for (const entry of entries) {
      if (!entry.featuredImage) continue;

      // Check if featuredImage is a UUID (no slashes)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        entry.featuredImage
      );

      if (isUuid) {
        const correctUrl = imageUrls.get(entry.featuredImage);

        if (correctUrl) {
          await db
            .update(collectionEntries)
            .set({ featuredImage: correctUrl })
            .where(eq(collectionEntries.id, entry.id));

          updatedFeaturedImages++;
          console.log(
            `   ✓ Updated featured image for post: ${entry.slug} (${entry.featuredImage.substring(0, 8)}...)`
          );
        }
      }
    }

    // Update cover images in entry_contents
    const contents = await db.query.entryContents.findMany();

    for (const content of contents) {
      try {
        const data = JSON.parse(content.content);
        let modified = false;

        // Check if content has a cover field with url
        if (data.cover && typeof data.cover === "object" && data.cover.url) {
          // Check if cover.url is a UUID (no slashes)
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            data.cover.url
          );

          if (isUuid) {
            const correctUrl = imageUrls.get(data.cover.url);

            if (correctUrl && data.cover.url !== correctUrl) {
              data.cover.url = correctUrl;
              modified = true;
              console.log(
                `   ✓ Updated cover image for entry content: ${data.cover.url.substring(0, 8)}...`
              );
            }
          }
        }

        // Update if modified
        if (modified) {
          await db
            .update(entryContents)
            .set({ content: JSON.stringify(data) })
            .where(eq(entryContents.id, content.id));
          updatedCoverImages++;
        }
      } catch (error) {
        // Skip non-JSON or malformed content
        continue;
      }
    }

    console.log(
      `   ✅ Updated ${updatedFeaturedImages} featured image(s) and ${updatedCoverImages} cover image(s)\n`
    );
  } catch (error) {
    console.error("   ❌ Update failed:", error);
    throw error;
  }
}

updateBlogImages().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
