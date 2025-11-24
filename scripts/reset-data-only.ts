#!/usr/bin/env tsx
/**
 * Data-Only Reset
 *
 * Resets data while preserving database schema:
 * - Stops all processes
 * - Clears Redis and BullMQ queues
 * - Truncates all database tables (keeps schema)
 * - Removes uploaded files
 * - Clears vector store
 * - Reseeds data
 * - Downloads and processes images
 *
 * Faster than reset:complete since it doesn't recreate schema.
 *
 * Usage: pnpm reset:data
 */

import { exec, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { Queue } from "bullmq";
import Redis from "ioredis";

const execAsync = promisify(exec);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function resetDataOnly() {
  console.log("🔄 Data-Only Reset\n");
  console.log("⚠️  This will delete all data but preserve schema!\n");

  const startTime = Date.now();

  try {
    // ========================================================================
    // PHASE 1: Stop All Processes
    // ========================================================================
    console.log("1️⃣  Stopping all processes...");
    try {
      await execAsync("pkill -f 'concurrently' || true");
      await execAsync("pkill -f 'tsx watch' || true");
      await execAsync("pkill -f 'next dev' || true");
      await sleep(2000);
      await execAsync("pkill -9 -f 'tsx watch' || true");
      await execAsync("pkill -9 -f 'next dev' || true");
      console.log("   ✅ All processes stopped\n");
    } catch (error) {
      console.log("   ⚠️  Some processes were not running\n");
    }

    // ========================================================================
    // PHASE 2: Clean Redis and BullMQ
    // ========================================================================
    console.log("2️⃣  Cleaning Redis and BullMQ queues...");
    try {
      const redis = new Redis({
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
        maxRetriesPerRequest: null,
      });

      const queue = new Queue("image-processing", { connection: redis });
      await queue.pause();
      await queue.obliterate({ force: true });
      await queue.close();
      await redis.quit();

      console.log("   ✅ Redis cleaned\n");
    } catch (error) {
      console.error("   ❌ Redis error:", error);
      console.log("   ⚠️  Make sure Redis is running: brew services start redis\n");
      process.exit(1);
    }

    // ========================================================================
    // PHASE 3: Truncate Database Tables
    // ========================================================================
    console.log("3️⃣  Truncating database tables...");
    const dbPath = process.env.DATABASE_URL?.replace("file:", "") || "data/sqlite.db";

    try {
      // Truncate all data tables while preserving schema
      const truncateSQL = `
        DELETE FROM conversation_images;
        DELETE FROM messages;
        DELETE FROM sessions;
        DELETE FROM media;
        DELETE FROM image_variants;
        DELETE FROM image_metadata;
        DELETE FROM images;
        DELETE FROM page_section_images;
        DELETE FROM entry_contents;
        DELETE FROM collection_entries;
        DELETE FROM collection_definitions;
        DELETE FROM page_section_contents;
        DELETE FROM page_sections;
        DELETE FROM section_definitions;
        DELETE FROM pages;
        DELETE FROM environments;
        DELETE FROM navigation_items;
        DELETE FROM navigations;
        DELETE FROM site_settings;
        DELETE FROM sites;
        DELETE FROM teams;
        DELETE FROM locales;
      `;

      await execAsync(`sqlite3 ${dbPath} "${truncateSQL}"`);
      console.log("   🗑️  All tables truncated");
      console.log("   ✅ Database cleared\n");
    } catch (error) {
      console.error("   ❌ Truncation failed:", error);
      process.exit(1);
    }

    // ========================================================================
    // PHASE 4: Clean Filesystem
    // ========================================================================
    console.log("4️⃣  Cleaning filesystem...");

    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
    const uploadsImagesDir = path.join(uploadsDir, "images");

    if (fs.existsSync(uploadsImagesDir)) {
      fs.rmSync(uploadsImagesDir, { recursive: true, force: true });
      console.log("   🗑️  Removed uploads/images/");
    }

    fs.mkdirSync(uploadsImagesDir, { recursive: true });
    console.log("   📁 Created empty uploads/images/");

    const lancedbDir = path.join(process.cwd(), "data", "lancedb");
    if (fs.existsSync(lancedbDir)) {
      fs.rmSync(lancedbDir, { recursive: true, force: true });
      console.log("   🗑️  Removed data/lancedb/");
    }

    console.log("   ✅ Filesystem cleaned\n");

    // ========================================================================
    // PHASE 5: Seed CMS Data
    // ========================================================================
    console.log("5️⃣  Seeding CMS data...");
    try {
      await execAsync("pnpm seed");
      console.log("   ✅ CMS data seeded\n");
    } catch (error) {
      console.error("   ❌ Seed failed:", error);
      process.exit(1);
    }

    // ========================================================================
    // PHASE 6: Download and Process Images
    // ========================================================================
    console.log("6️⃣  Downloading and processing images...");

    console.log("   🔧 Starting worker...");
    const workerProc = spawn("tsx", ["scripts/start-worker.ts"], {
      detached: true,
      stdio: "ignore",
    });

    await sleep(2000);

    console.log("   ⬇️  Downloading images...");
    try {
      await execAsync("pnpm seed:images");
      console.log("   ✅ Images queued for processing");
    } catch (error) {
      console.error("   ❌ Image seeding failed:", error);
      workerProc.kill("SIGTERM");
      process.exit(1);
    }

    console.log("   ⏳ Waiting for image processing to complete...");
    let allCompleted = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!allCompleted && attempts < maxAttempts) {
      attempts++;
      await sleep(1000);

      try {
        const { db } = await import("../server/db/client");
        const images = await db.query.images.findMany({
          columns: {
            id: true,
            status: true,
          },
        });

        const completed = images.filter((img) => img.status === "completed").length;
        const total = images.length;

        process.stdout.write(`\r   ⏳ Processing: ${completed}/${total} images completed...`);

        allCompleted = images.every((img) => img.status === "completed");
      } catch (error) {
        continue;
      }
    }

    console.log();

    workerProc.kill("SIGTERM");
    await sleep(1000);

    if (allCompleted) {
      console.log("   ✅ All images processed\n");
    } else {
      console.log("   ⚠️  Timeout waiting for image processing\n");
    }

    // ========================================================================
    // PHASE 6.5: Update Page Image URLs
    // ========================================================================
    console.log("6️⃣.5️⃣  Updating page image URLs...");
    try {
      await execAsync("tsx scripts/update-page-images.ts");
    } catch (error) {
      console.error("   ❌ Image URL update failed:", error);
    }

    // ========================================================================
    // PHASE 7: Summary
    // ========================================================================
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Data reset finished in ${elapsed}s!`);
    console.log("\n📋 Next steps:");
    console.log("   1. Run: pnpm start");
    console.log("   2. Preview: http://localhost:4000/pages/home?locale=en");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Reset failed:", error);
    process.exit(1);
  }
}

resetDataOnly().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
