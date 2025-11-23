#!/usr/bin/env tsx
/**
 * Stop dev processes only (pnpm dev)
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function stopDev() {
  console.log("🛑 Stopping dev processes...\n");

  try {
    // Stop all dev processes
    await execAsync("pkill -f 'pnpm.*dev' || true");
    await execAsync("pkill -f concurrently || true");
    await execAsync("pkill -f 'tsx watch' || true");
    await execAsync("pkill -f 'next dev' || true");
    await execAsync("pkill -f 'start-worker' || true");

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("✅ Dev processes stopped\n");
  } catch (error) {
    console.error("❌ Error stopping processes:", error);
    process.exit(1);
  }
}

stopDev();
