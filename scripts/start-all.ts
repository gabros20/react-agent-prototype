#!/usr/bin/env tsx
/**
 * Start Redis + dev processes
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function startAll() {
  console.log("🚀 Starting all services...\n");

  try {
    // 1. Start Redis
    console.log("1️⃣  Starting Redis...");
    const { stdout } = await execAsync("brew services list | grep redis");
    if (stdout.includes("started")) {
      console.log("   ✅ Redis already running\n");
    } else {
      await execAsync("brew services start redis");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("   ✅ Redis started\n");
    }

    // 2. Start dev processes
    console.log("2️⃣  Starting dev processes...");
    console.log("   💡 Run in separate terminal: pnpm dev\n");
    console.log("✅ Ready to start development!");
    console.log("\n📋 Next step:");
    console.log("   pnpm dev");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

startAll();
