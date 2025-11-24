#!/usr/bin/env tsx
/**
 * Complete System Reset - Nuclear Option
 *
 * Completely resets the system to pristine initial state:
 * - Stops all processes
 * - Clears Redis and BullMQ queues
 * - Deletes database completely
 * - Removes all uploaded files
 * - Clears vector store (LanceDB)
 * - Clears Next.js build cache
 * - Reseeds database with initial data
 * - Downloads and processes sample images
 * - Waits for image processing to complete
 *
 * Usage: pnpm reset:complete
 */

import { exec, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { Queue } from "bullmq";
import Redis from "ioredis";

const execAsync = promisify(exec);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function resetComplete() {
  console.log("🔄 Complete System Reset\n");
  console.log("⚠️  This will delete ALL data and files!\n");

  const startTime = Date.now();

  try {
    // ========================================================================
    // PHASE 1: Stop All Processes
    // ========================================================================
    console.log("1️⃣  Stopping all processes...");
    try {
      // Kill concurrently orchestrator first
      await execAsync("pkill -f 'concurrently' || true");

      // Kill all development processes
      await execAsync("pkill -f 'tsx watch' || true");
      await execAsync("pkill -f 'next dev' || true");

      // Wait for graceful shutdown
      await sleep(2000);

      // Force kill any stragglers
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

      // Clean image processing queue
      const queue = new Queue("image-processing", {
        connection: redis,
      });

      await queue.pause();
      console.log("   ⏸️  Queue paused");

      await queue.obliterate({ force: true });
      console.log("   🗑️  Queue obliterated");

      await queue.close();
      await redis.quit();

      console.log("   ✅ Redis cleaned\n");
    } catch (error) {
      console.error("   ❌ Redis error:", error);
      console.log("   ⚠️  Make sure Redis is running: brew services start redis\n");
      process.exit(1);
    }

    // ========================================================================
    // PHASE 3: Delete Database
    // ========================================================================
    console.log("3️⃣  Deleting database...");
    const dbPath = process.env.DATABASE_URL?.replace("file:", "") || "data/sqlite.db";

    try {
      // Checkpoint WAL first to ensure clean state
      await execAsync(`sqlite3 ${dbPath} "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true`);

      // Delete database files
      const dbDir = path.dirname(dbPath);
      const dbName = path.basename(dbPath);

      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
      if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);

      console.log(`   🗑️  Deleted ${dbName} and WAL files`);
      console.log("   ✅ Database deleted\n");
    } catch (error) {
      console.error("   ❌ Database deletion failed:", error);
      process.exit(1);
    }

    // ========================================================================
    // PHASE 4: Clean Filesystem
    // ========================================================================
    console.log("4️⃣  Cleaning filesystem...");

    // Clean uploads directory
    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
    const uploadsImagesDir = path.join(uploadsDir, "images");

    if (fs.existsSync(uploadsImagesDir)) {
      fs.rmSync(uploadsImagesDir, { recursive: true, force: true });
      console.log("   🗑️  Removed uploads/images/");
    }

    // Recreate empty uploads structure
    fs.mkdirSync(uploadsImagesDir, { recursive: true });
    console.log("   📁 Created empty uploads/images/");

    // Clean LanceDB vector store
    const lancedbDir = path.join(process.cwd(), "data", "lancedb");
    if (fs.existsSync(lancedbDir)) {
      fs.rmSync(lancedbDir, { recursive: true, force: true });
      console.log("   🗑️  Removed data/lancedb/");
    }

    // Clean Next.js build cache
    const nextDir = path.join(process.cwd(), ".next");
    if (fs.existsSync(nextDir)) {
      fs.rmSync(nextDir, { recursive: true, force: true });
      console.log("   🗑️  Removed .next/");
    }

    console.log("   ✅ Filesystem cleaned\n");

    // ========================================================================
    // PHASE 5: Reseed Database Schema
    // ========================================================================
    console.log("5️⃣  Creating database schema...");
    try {
      const { stdout } = await execAsync("pnpm db:push");
      console.log("   ✅ Schema created\n");
    } catch (error) {
      console.error("   ❌ Schema creation failed:", error);
      process.exit(1);
    }

    // ========================================================================
    // PHASE 6: Seed CMS Data
    // ========================================================================
    console.log("6️⃣  Seeding CMS data...");
    try {
      const { stdout } = await execAsync("pnpm seed");
      // Don't print full output, just confirmation
      console.log("   ✅ CMS data seeded\n");
    } catch (error) {
      console.error("   ❌ Seed failed:", error);
      process.exit(1);
    }

    // ========================================================================
    // PHASE 7: Download and Process Images
    // ========================================================================
    console.log("7️⃣  Downloading and processing images...");

    // Start worker in background
    console.log("   🔧 Starting worker...");
    const workerProc = spawn("tsx", ["scripts/start-worker.ts"], {
      detached: true,
      stdio: "ignore",
    });

    // Wait a moment for worker to initialize
    await sleep(2000);

    // Run seed-images
    console.log("   ⬇️  Downloading images...");
    try {
      await execAsync("pnpm seed:images");
      console.log("   ✅ Images queued for processing");
    } catch (error) {
      console.error("   ❌ Image seeding failed:", error);
      workerProc.kill("SIGTERM");
      process.exit(1);
    }

    // Wait for all images to complete processing
    console.log("   ⏳ Waiting for image processing to complete...");
    let allCompleted = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

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
        // Database might be locked, retry
        continue;
      }
    }

    console.log(); // New line after progress

    // Stop worker
    workerProc.kill("SIGTERM");
    await sleep(1000);

    if (allCompleted) {
      console.log("   ✅ All images processed\n");
    } else {
      console.log("   ⚠️  Timeout waiting for image processing\n");
      console.log("   Run 'pnpm check:images' to verify status\n");
    }

    // ========================================================================
    // PHASE 7.5: Update Page Image URLs
    // ========================================================================
    console.log("7️⃣.5️⃣  Updating page image URLs...");
    try {
      await execAsync("tsx scripts/update-page-images.ts");
    } catch (error) {
      console.error("   ❌ Image URL update failed:", error);
      // Don't exit - this is not critical
    }

    // ========================================================================
    // PHASE 8: Verify System
    // ========================================================================
    console.log("8️⃣  Verifying system...\n");

    // Check Redis
    try {
      const redis = new Redis({
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
      });
      await redis.ping();
      console.log("   ✅ Redis is running");
      await redis.quit();
    } catch (error) {
      console.error("   ❌ Redis is NOT running");
    }

    // Check database
    try {
      const { db } = await import("../server/db/client");

      const pages = await db.query.pages.findMany();
      console.log(`   ✅ Database has ${pages.length} pages`);

      const images = await db.query.images.findMany();
      const completed = images.filter((img) => img.status === "completed").length;
      console.log(`   ✅ Database has ${completed}/${images.length} images completed`);

      const variants = await db.query.imageVariants.findMany();
      console.log(`   ✅ Database has ${variants.length} image variants`);
    } catch (error) {
      console.error("   ❌ Database check failed:", error);
    }

    // Check uploads
    if (fs.existsSync(uploadsImagesDir)) {
      const files = fs.readdirSync(uploadsImagesDir, { recursive: true });
      console.log(`   ✅ Uploads directory has ${files.length} files`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Complete reset finished in ${elapsed}s!`);
    console.log("\n📋 Next steps:");
    console.log("   1. Run: pnpm start");
    console.log("   2. Preview: http://localhost:4000/pages/home?locale=en");
    console.log("   3. Assistant: http://localhost:3000/assistant");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Reset failed:", error);
    process.exit(1);
  }
}

resetComplete().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
