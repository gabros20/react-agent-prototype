#!/usr/bin/env tsx
/**
 * Update Page Image URLs
 *
 * Updates all page section content to use actual image file paths from the database.
 * This ensures image URLs are always correct regardless of upload date.
 *
 * Usage: Called automatically by reset-complete.ts after seed-images.ts
 */

import { db } from "../server/db/client";
import { pageSectionContents } from "../server/db/schema";
import { eq } from "drizzle-orm";

async function updatePageImages() {
  console.log("🔄 Updating page image URLs...");

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

    // Get all page section contents
    const contents = await db.query.pageSectionContents.findMany();

    let updated = 0;

    for (const content of contents) {
      try {
        const data = JSON.parse(content.content);
        let modified = false;

        // Check if content has an image field
        if (data.image && typeof data.image === "object") {
          // Extract UUID from URL if it exists
          const urlMatch = data.image.url?.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);

          if (urlMatch) {
            const imageId = urlMatch[1];
            const correctUrl = imageUrls.get(imageId);

            if (correctUrl && data.image.url !== correctUrl) {
              data.image.url = correctUrl;
              modified = true;
              console.log(`   ✓ Updated image URL for image ${imageId.substring(0, 8)}...`);
            }
          }
        }

        // Update if modified
        if (modified) {
          await db.update(pageSectionContents)
            .set({ content: JSON.stringify(data) })
            .where(eq(pageSectionContents.id, content.id));
          updated++;
        }
      } catch (error) {
        // Skip non-JSON or malformed content
        continue;
      }
    }

    console.log(`   ✅ Updated ${updated} page section(s)\n`);
  } catch (error) {
    console.error("   ❌ Update failed:", error);
    throw error;
  }
}

updatePageImages().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
