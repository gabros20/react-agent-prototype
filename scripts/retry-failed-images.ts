/**
 * Retry processing for failed images
 *
 * This script:
 * 1. Finds all images with status='failed'
 * 2. Resets their status to 'processing'
 * 3. Re-queues metadata and variant jobs
 */

import { db } from "../server/db/client";
import { images } from "../server/db/schema";
import { eq } from "drizzle-orm";
import { imageQueue } from "../server/queues/image-queue";

async function retryFailedImages() {
  console.log("🔄 Finding failed images...\n");

  const failedImages = await db.query.images.findMany({
    where: eq(images.status, "failed"),
  });

  if (failedImages.length === 0) {
    console.log("✅ No failed images found.");
    return;
  }

  console.log(`Found ${failedImages.length} failed images:\n`);

  for (const image of failedImages) {
    console.log(`  - ${image.originalFilename} (${image.id.substring(0, 8)}...)`);
    if (image.error) {
      console.log(`    Error: ${image.error}`);
    }
  }

  console.log("\n🔄 Resetting status and re-queuing jobs...\n");

  for (const image of failedImages) {
    // Reset status
    await db
      .update(images)
      .set({
        status: "processing",
        error: null,
        processedAt: null,
      })
      .where(eq(images.id, image.id));

    // Re-queue jobs
    const filePath = image.filePath;
    if (filePath) {
      await imageQueue.add(
        "generate-metadata",
        { imageId: image.id, filePath },
        { jobId: `metadata-retry-${image.id}-${Date.now()}` }
      );
      await imageQueue.add(
        "generate-variants",
        { imageId: image.id, filePath },
        { jobId: `variants-retry-${image.id}-${Date.now()}` }
      );
      console.log(`  ✓ Re-queued ${image.originalFilename}`);
    } else {
      console.log(`  ⚠ Skipped ${image.originalFilename} - no file path`);
    }
  }

  console.log("\n✅ Done! Jobs have been re-queued.");
  console.log("   Make sure the worker is running: pnpm worker:start");
}

// Run
retryFailedImages()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
