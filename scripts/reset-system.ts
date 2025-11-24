#!/usr/bin/env tsx
/**
 * Reset System - Clear caches and restart processes
 *
 * Lightweight reset that:
 * - Stops all dev processes
 * - Clears Redis cache and BullMQ queues
 * - Checkpoints SQLite WAL files
 *
 * ⚠️  DOES NOT delete data or files!
 *
 * For complete reset (delete database, uploads, etc):
 *   Use: pnpm reset:complete
 *
 * For data-only reset (keep schema, clear content):
 *   Use: pnpm reset:data
 *
 * Usage: pnpm reset:system
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Queue } from "bullmq";
import Redis from "ioredis";

const execAsync = promisify(exec);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function resetSystem() {
  console.log("🔄 Cache & Process Reset\n");
  console.log("ℹ️  This only clears caches. Use 'pnpm reset:complete' for full reset.\n");

  // 1. Kill all development processes
  console.log("1️⃣  Stopping all dev processes...");
  try {
    // Kill concurrently orchestrator first
    await execAsync("pkill -f 'concurrently' || true");

    // Kill development processes
    await execAsync("pkill -f 'tsx watch' || true");
    await execAsync("pkill -f 'next dev' || true");

    // Wait for graceful shutdown
    await sleep(2000);

    // Force kill stragglers
    await execAsync("pkill -9 -f 'tsx watch' || true");
    await execAsync("pkill -9 -f 'next dev' || true");

    console.log("   ✅ Processes stopped\n");
  } catch (error) {
    console.log("   ⚠️  Some processes were not running\n");
  }

  // 2. Clear Redis using queue.obliterate() for cleaner removal
  console.log("2️⃣  Clearing Redis cache...");
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      maxRetriesPerRequest: null,
    });

    const keys = await redis.keys("bull:image-processing:*");
    console.log(`   Found ${keys.length} job keys in Redis`);

    // Use queue.obliterate() for proper BullMQ cleanup
    const queue = new Queue("image-processing", { connection: redis });
    await queue.pause();
    await queue.obliterate({ force: true });
    await queue.close();

    console.log("   ✅ Redis cleared\n");

    await redis.quit();
  } catch (error) {
    console.error("   ❌ Redis error:", error);
    console.log("   ⚠️  Make sure Redis is running: brew services start redis\n");
  }

  // 3. Clear SQLite WAL files
  console.log("3️⃣  Clearing SQLite WAL files...");
  try {
    const dbPath = process.env.DATABASE_URL?.replace("file:", "") || "data/sqlite.db";

    // Close any open connections by checkpointing WAL
    await execAsync(`sqlite3 ${dbPath} "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true`);

    console.log("   ✅ WAL files checkpointed\n");
  } catch (error) {
    console.log("   ⚠️  WAL checkpoint failed (database may be locked)\n");
  }

  // 4. Check system status
  console.log("4️⃣  Checking system status...\n");

  // Check if Redis is running
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
    console.log("      Start with: brew services start redis");
  }

  // Check images in database
  try {
    const { db } = await import("../server/db/client");
    const images = await db.query.images.findMany({
      with: { metadata: true },
      limit: 5,
    });

    console.log(`   ✅ Database has ${images.length} images`);

    const withMetadata = images.filter((img) => img.metadata).length;
    const withoutMetadata = images.length - withMetadata;

    if (withoutMetadata > 0) {
      console.log(`   ⚠️  ${withoutMetadata} images missing metadata`);
      console.log("      Worker may not have processed them");
    }
  } catch (error) {
    console.error("   ❌ Database check failed:", error);
  }

  console.log("\n✅ System reset complete!");
  console.log("\n📋 Next steps:");
  console.log("   1. Run: pnpm dev");
  console.log("   2. Test agent: 'Show me all images in the system'");
  console.log("   3. If images missing metadata, check worker logs");

  process.exit(0);
}

resetSystem().catch((error) => {
  console.error("❌ Reset failed:", error);
  process.exit(1);
});
