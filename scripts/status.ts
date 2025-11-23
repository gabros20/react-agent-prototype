#!/usr/bin/env tsx
/**
 * Check status of all services
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function checkStatus() {
  console.log("📊 Service Status\n");

  try {
    // Check Redis
    console.log("🔴 Redis:");
    const { stdout: redisStatus } = await execAsync("brew services list | grep redis");
    if (redisStatus.includes("started")) {
      console.log("   ✅ Running\n");
    } else {
      console.log("   ⏹️  Stopped\n");
    }

    // Check dev processes
    console.log("💻 Dev Processes:");
    const { stdout: devProcs } = await execAsync(
      "ps aux | grep -E '(tsx watch|next dev|concurrently)' | grep -v grep | wc -l"
    );
    const count = parseInt(devProcs.trim(), 10);
    if (count > 0) {
      console.log(`   ✅ Running (${count} processes)\n`);
    } else {
      console.log("   ⏹️  Stopped\n");
    }

    // Check database files
    console.log("💾 Database:");
    const { stdout: dbCheck } = await execAsync("ls -lh data/*.db 2>/dev/null || echo ''");
    if (dbCheck) {
      const lines = dbCheck.trim().split("\n").length;
      console.log(`   ✅ ${lines} database file(s) found\n`);
    } else {
      console.log("   ⚠️  No database files\n");
    }

    console.log("📋 Quick commands:");
    console.log("   pnpm start       - Start dev processes");
    console.log("   pnpm start:all   - Start Redis + dev");
    console.log("   pnpm stop        - Stop dev processes");
    console.log("   pnpm stop:all    - Stop everything");
  } catch (error) {
    console.error("❌ Error checking status:", error);
    process.exit(1);
  }
}

checkStatus();
