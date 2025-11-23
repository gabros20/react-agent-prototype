#!/usr/bin/env tsx
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function stopRedis() {
  console.log("🛑 Stopping Redis...\n");

  try {
    await execAsync("brew services stop redis");
    console.log("✅ Redis stopped\n");
  } catch (error) {
    console.error("❌ Failed to stop Redis:", error);
    process.exit(1);
  }
}

stopRedis();
