#!/usr/bin/env tsx
/**
 * Stop everything: dev processes + Redis
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function stopAll() {
  console.log("🛑 Stopping all services...\n");

  try {
    // 1. Stop dev processes
    console.log("1️⃣  Stopping dev processes...");
    await execAsync("pkill -f 'pnpm.*dev' || true");
    await execAsync("pkill -f concurrently || true");
    await execAsync("pkill -f 'tsx watch' || true");
    await execAsync("pkill -f 'next dev' || true");
    await execAsync("pkill -f 'start-worker' || true");
    console.log("   ✅ Dev processes stopped\n");

    // 2. Stop Redis
    console.log("2️⃣  Stopping Redis...");
    await execAsync("brew services stop redis");
    console.log("   ✅ Redis stopped\n");

    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("✅ All services stopped!\n");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

stopAll();
