#!/usr/bin/env tsx
/**
 * Check images and their metadata status
 */
import { db } from "../server/db/client";

async function checkImages() {
  console.log("🔍 Checking image system status...\n");

  const images = await db.query.images.findMany({
    with: {
      metadata: true,
    },
    orderBy: (images, { desc }) => [desc(images.uploadedAt)],
  });

  console.log(`📊 Total images: ${images.length}\n`);

  if (images.length === 0) {
    console.log("No images found in database.");
    console.log("Run: pnpm seed:images");
    process.exit(0);
  }

  images.forEach((img, idx) => {
    console.log(`[${idx + 1}] ${img.originalFilename}`);
    console.log(`    ID: ${img.id}`);
    console.log(`    Status: ${img.status}`);
    console.log(`    Has metadata: ${img.metadata ? "✅ YES" : "❌ NO"}`);

    if (img.metadata) {
      console.log(`    Description: ${img.metadata.description?.substring(0, 60)}...`);
      const tags = img.metadata.tags ? JSON.parse(img.metadata.tags as string) : [];
      console.log(`    Tags: ${tags.join(", ")}`);
    } else {
      console.log(`    ⚠️  MISSING METADATA - Worker may not be running`);
    }
    console.log("");
  });

  const withoutMetadata = images.filter((img) => !img.metadata);
  if (withoutMetadata.length > 0) {
    console.log(`⚠️  ${withoutMetadata.length} images missing metadata`);
    console.log("   Make sure worker is running: pnpm worker");
  } else {
    console.log("✅ All images have metadata");
  }

  process.exit(0);
}

checkImages().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
