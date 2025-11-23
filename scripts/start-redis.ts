#!/usr/bin/env tsx
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function startRedis() {
  console.log("🚀 Starting Redis...\n");

  try {
    // Check if already running
    const { stdout } = await execAsync("brew services list | grep redis");
    if (stdout.includes("started")) {
      console.log("✅ Redis is already running\n");
      return;
    }

    // Start Redis
    await execAsync("brew services start redis");

    // Wait for Redis to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("✅ Redis started successfully\n");
  } catch (error) {
    console.error("❌ Failed to start Redis");
    console.log("💡 Install Redis: brew install redis");
    process.exit(1);
  }
}

startRedis();
