/**
 * Re-index all images in vector database
 * Run: pnpm tsx scripts/reindex-images.ts
 */

import { db } from "../server/db/client";
import { ServiceContainer } from "../server/services/service-container";

async function reindexImages() {
  console.log("Initializing services...");
  const services = await ServiceContainer.initialize(db);
  const vectorIndex = services.vectorIndex;

  // Get all images with their metadata
  const images = await db.query.images.findMany({
    with: {
      metadata: true,
    },
  });

  console.log(`Found ${images.length} images to index\n`);

  let indexed = 0;
  let skipped = 0;
  let errors = 0;

  for (const img of images) {
    const meta = img.metadata;

    if (!meta || !meta.searchableText) {
      console.log(`- Skipping ${img.originalFilename || img.filename}: no metadata`);
      skipped++;
      continue;
    }

    try {
      // Check if already indexed
      const exists = await vectorIndex.exists(img.id);
      if (exists) {
        console.log(`- Already indexed: ${img.originalFilename || img.filename}`);
        continue;
      }

      const filename = img.filename || img.id;
      const tags = meta.tags ? JSON.parse(meta.tags as string) : [];
      const categories = meta.categories ? JSON.parse(meta.categories as string) : [];
      const colors = meta.colors ? JSON.parse(meta.colors as string) : { dominant: [] };

      console.log(`+ Indexing: ${img.originalFilename || img.filename}`);
      console.log(`  Description: ${meta.description?.substring(0, 60)}...`);
      console.log(`  Tags: ${tags.slice(0, 5).join(", ")}`);

      // Add to vector index using the standard add method
      await vectorIndex.add({
        id: img.id,
        type: "image",
        name: filename,
        slug: filename,
        searchableText: meta.searchableText,
        metadata: {
          description: meta.description,
          tags,
          categories,
          colors: colors.dominant || [],
          mood: meta.mood,
          style: meta.style,
        },
      });

      indexed++;
    } catch (error) {
      console.error(`x Error indexing ${img.originalFilename || img.filename}:`, error);
      errors++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Indexed: ${indexed}`);
  console.log(`Skipped (no metadata): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${images.length}`);

  process.exit(0);
}

reindexImages().catch((err) => {
  console.error(err);
  process.exit(1);
});
