import { randomUUID } from "node:crypto";
import { db } from "../server/db/client";
import * as schema from "../server/db/schema";
import { ImageProcessingService } from "../server/services/storage/image-processing.service";

// Sample images from Picsum Photos (unsplash quality, free)
const SAMPLE_IMAGES = [
  {
    url: "https://picsum.photos/id/1018/1920/1080", // Landscape - mountains
    name: "mountain-landscape.jpg",
    description: "Mountain landscape for testing",
  },
  {
    url: "https://picsum.photos/id/1025/1920/1080", // Portrait - puppy
    name: "golden-puppy.jpg",
    description: "Golden retriever puppy for testing",
  },
  {
    url: "https://picsum.photos/id/180/1920/1080", // Product - desk setup
    name: "desk-workspace.jpg",
    description: "Modern workspace desk setup for testing",
  },
];

async function downloadImage(url: string): Promise<Buffer> {
  console.log(`  Downloading: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function seedImages() {
  console.log("🖼️  Seeding sample images...\n");

  try {
    // Initialize image processing service
    const imageProcessingService = new ImageProcessingService();

    // Create a session for these uploads
    const sessionId = randomUUID();
    await db.insert(schema.sessions).values({
      id: sessionId,
      title: "Seed Images Session",
      checkpoint: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✓ Created session: ${sessionId}\n`);

    const imageIds: string[] = [];

    for (const [index, sample] of SAMPLE_IMAGES.entries()) {
      console.log(`\n[${index + 1}/${SAMPLE_IMAGES.length}] Processing: ${sample.name}`);

      // Download image
      const imageBuffer = await downloadImage(sample.url);
      console.log(`  ✓ Downloaded (${(imageBuffer.length / 1024).toFixed(1)} KB)`);

      // Process through image processing service (handles dedup, storage, DB, queuing)
      const result = await imageProcessingService.processImage({
        buffer: imageBuffer,
        filename: sample.name,
        sessionId,
        mediaType: "image/jpeg",
      });

      if (!result.isNew) {
        console.log(`  ⚠️  Image already exists (ID: ${result.imageId})`);
      } else {
        console.log(`  ✓ Saved to filesystem and database`);
        console.log(`  ✓ Queued 3 processing jobs (metadata, variants, embeddings)`);
      }

      console.log(`  ✓ Image ID: ${result.imageId}`);
      imageIds.push(result.imageId);
    }

    // ========================================================================
    // Summary
    // ========================================================================
    console.log("\n\n✅ Image seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   Images seeded: ${imageIds.length}`);
    console.log(`   Image IDs:`);
    for (const id of imageIds) {
      console.log(`     - ${id}`);
    }

    console.log("\n⏳ Processing jobs queued (will complete in ~5-10 seconds):");
    console.log("   - Metadata generation (GPT-4o-mini)");
    console.log("   - Variant generation (WebP + AVIF, 3 sizes each)");
    console.log("   - Embedding generation (CLIP model)");

    console.log("\n🔍 Verify processing:");
    console.log("   Watch worker logs for completion messages");
    console.log("   Or check status for each image:");
    for (const id of imageIds) {
      console.log(`     curl http://localhost:8787/api/images/${id}/status`);
    }

    console.log("\n🧪 Test semantic search:");
    console.log('   curl "http://localhost:8787/api/images/search?q=mountain"');
    console.log('   curl "http://localhost:8787/api/images/search?q=puppy"');
    console.log('   curl "http://localhost:8787/api/images/search?q=workspace"');

    console.log("\n💬 Test via agent:");
    console.log("   Go to http://localhost:3000/assistant");
    console.log('   Try: "Show me all images"');
    console.log('   Try: "Find the mountain photo"');
    console.log('   Try: "Search for images with animals"');

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Image seeding failed:", error);
    process.exit(1);
  }
}

seedImages();
