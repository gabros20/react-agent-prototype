#!/usr/bin/env tsx
/**
 * System Verification
 *
 * Checks that the system is in a healthy state:
 * - Redis is running and accessible
 * - Database exists with expected schema
 * - All seeded images are processed
 * - Upload directory has files
 * - Vector store has embeddings
 * - No dev processes running
 * - Required ports are free
 *
 * Usage: pnpm verify
 */

import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import Redis from "ioredis";

const execAsync = promisify(exec);

interface CheckResult {
  name: string;
  status: "✅" | "⚠️" | "❌";
  message: string;
}

async function verifySystem() {
  console.log("🔍 System Verification\n");

  const results: CheckResult[] = [];

  // ========================================================================
  // Check 1: Redis Running
  // ========================================================================
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
    });
    await redis.ping();
    await redis.quit();

    results.push({
      name: "Redis",
      status: "✅",
      message: "Running and accessible",
    });
  } catch (error) {
    results.push({
      name: "Redis",
      status: "❌",
      message: "Not running or not accessible",
    });
  }

  // ========================================================================
  // Check 2: Database Schema
  // ========================================================================
  const dbPath = process.env.DATABASE_URL?.replace("file:", "") || "data/sqlite.db";

  if (!fs.existsSync(dbPath)) {
    results.push({
      name: "Database",
      status: "❌",
      message: "Database file does not exist",
    });
  } else {
    try {
      const { db } = await import("../server/db/client");

      // Check core tables exist
      const pages = await db.query.pages.findMany();
      const images = await db.query.images.findMany();
      const sections = await db.query.sectionTemplates.findMany();

      results.push({
        name: "Database Schema",
        status: "✅",
        message: `${sections.length} sections, ${pages.length} pages defined`,
      });
    } catch (error) {
      results.push({
        name: "Database Schema",
        status: "❌",
        message: `Schema error: ${error}`,
      });
    }
  }

  // ========================================================================
  // Check 3: Image Processing Status
  // ========================================================================
  try {
    const { db } = await import("../server/db/client");
    const images = await db.query.images.findMany({
      columns: {
        id: true,
        status: true,
      },
    });

    const completed = images.filter((img) => img.status === "completed").length;
    const processing = images.filter((img) => img.status === "processing").length;
    const failed = images.filter((img) => img.status === "failed").length;
    const total = images.length;

    if (total === 0) {
      results.push({
        name: "Images",
        status: "⚠️",
        message: "No images in database",
      });
    } else if (completed === total) {
      results.push({
        name: "Images",
        status: "✅",
        message: `All ${total} images processed successfully`,
      });
    } else if (failed > 0) {
      results.push({
        name: "Images",
        status: "❌",
        message: `${failed} failed, ${processing} processing, ${completed}/${total} completed`,
      });
    } else {
      results.push({
        name: "Images",
        status: "⚠️",
        message: `${processing} still processing, ${completed}/${total} completed`,
      });
    }
  } catch (error) {
    results.push({
      name: "Images",
      status: "❌",
      message: `Database query failed: ${error}`,
    });
  }

  // ========================================================================
  // Check 4: Upload Directory
  // ========================================================================
  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
  const uploadsImagesDir = path.join(uploadsDir, "images");

  if (!fs.existsSync(uploadsImagesDir)) {
    results.push({
      name: "Uploads Directory",
      status: "❌",
      message: "uploads/images/ does not exist",
    });
  } else {
    try {
      const files = fs.readdirSync(uploadsImagesDir, { recursive: true });
      const fileCount = files.filter((f) => !fs.statSync(path.join(uploadsImagesDir, f as string)).isDirectory()).length;

      if (fileCount === 0) {
        results.push({
          name: "Uploads Directory",
          status: "⚠️",
          message: "No files uploaded yet",
        });
      } else {
        results.push({
          name: "Uploads Directory",
          status: "✅",
          message: `${fileCount} files stored`,
        });
      }
    } catch (error) {
      results.push({
        name: "Uploads Directory",
        status: "❌",
        message: `Cannot read directory: ${error}`,
      });
    }
  }

  // ========================================================================
  // Check 5: Vector Store (LanceDB)
  // ========================================================================
  const lancedbDir = path.join(process.cwd(), "data", "lancedb");

  if (!fs.existsSync(lancedbDir)) {
    results.push({
      name: "Vector Store",
      status: "⚠️",
      message: "LanceDB directory does not exist (embeddings not generated yet)",
    });
  } else {
    try {
      const files = fs.readdirSync(lancedbDir, { recursive: true });
      results.push({
        name: "Vector Store",
        status: "✅",
        message: `LanceDB initialized with ${files.length} files`,
      });
    } catch (error) {
      results.push({
        name: "Vector Store",
        status: "❌",
        message: `Cannot read LanceDB: ${error}`,
      });
    }
  }

  // ========================================================================
  // Check 6: Running Processes
  // ========================================================================
  try {
    const { stdout: tsxProcs } = await execAsync("pgrep -f 'tsx watch' || true");
    const { stdout: nextProcs } = await execAsync("pgrep -f 'next dev' || true");
    const { stdout: concurrentlyProcs } = await execAsync("pgrep -f 'concurrently' || true");

    const runningProcs = [tsxProcs, nextProcs, concurrentlyProcs].filter((p) => p.trim()).length;

    if (runningProcs === 0) {
      results.push({
        name: "Dev Processes",
        status: "✅",
        message: "No dev processes running (clean state)",
      });
    } else {
      results.push({
        name: "Dev Processes",
        status: "⚠️",
        message: `${runningProcs} dev process(es) currently running`,
      });
    }
  } catch (error) {
    results.push({
      name: "Dev Processes",
      status: "⚠️",
      message: "Cannot check process status",
    });
  }

  // ========================================================================
  // Check 7: Required Ports
  // ========================================================================
  const portsToCheck = [
    { port: 3000, name: "Next.js" },
    { port: 4000, name: "Preview" },
    { port: 8787, name: "API Server" },
  ];

  for (const { port, name } of portsToCheck) {
    try {
      const { stdout } = await execAsync(`lsof -ti:${port} || true`);
      if (stdout.trim()) {
        results.push({
          name: `Port ${port} (${name})`,
          status: "⚠️",
          message: `In use by PID ${stdout.trim()}`,
        });
      } else {
        results.push({
          name: `Port ${port} (${name})`,
          status: "✅",
          message: "Available",
        });
      }
    } catch (error) {
      results.push({
        name: `Port ${port} (${name})`,
        status: "⚠️",
        message: "Cannot check port status",
      });
    }
  }

  // ========================================================================
  // Check 8: Image Variants
  // ========================================================================
  try {
    const { db } = await import("../server/db/client");
    const variants = await db.query.imageVariants.findMany();
    const images = await db.query.images.findMany();

    const expectedVariants = images.length * 7; // 7 variants per image

    if (variants.length === 0 && images.length > 0) {
      results.push({
        name: "Image Variants",
        status: "⚠️",
        message: "No variants generated yet",
      });
    } else if (variants.length < expectedVariants) {
      results.push({
        name: "Image Variants",
        status: "⚠️",
        message: `${variants.length}/${expectedVariants} variants generated (incomplete)`,
      });
    } else {
      results.push({
        name: "Image Variants",
        status: "✅",
        message: `${variants.length} variants generated`,
      });
    }
  } catch (error) {
    results.push({
      name: "Image Variants",
      status: "❌",
      message: `Database query failed: ${error}`,
    });
  }

  // ========================================================================
  // Print Results
  // ========================================================================
  console.log("📊 System Status:\n");

  for (const result of results) {
    console.log(`${result.status} ${result.name}`);
    console.log(`   ${result.message}\n`);
  }

  // ========================================================================
  // Summary
  // ========================================================================
  const passed = results.filter((r) => r.status === "✅").length;
  const warnings = results.filter((r) => r.status === "⚠️").length;
  const failed = results.filter((r) => r.status === "❌").length;
  const total = results.length;

  console.log("\n📈 Summary:");
  console.log(`   ✅ Passed: ${passed}/${total}`);
  if (warnings > 0) console.log(`   ⚠️  Warnings: ${warnings}`);
  if (failed > 0) console.log(`   ❌ Failed: ${failed}`);

  if (failed === 0 && warnings === 0) {
    console.log("\n🎉 System is in perfect health!");
  } else if (failed === 0) {
    console.log("\n✅ System is healthy (minor warnings)");
  } else {
    console.log("\n⚠️  System has issues that need attention");
  }

  process.exit(failed > 0 ? 1 : 0);
}

verifySystem().catch((error) => {
  console.error("❌ Verification failed:", error);
  process.exit(1);
});
