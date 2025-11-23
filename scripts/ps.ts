#!/usr/bin/env tsx
/**
 * Process Monitor - Show all running services and duplicates
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function showProcesses() {
  console.log("🔍 Process Monitor\n");

  try {
    // 1. Check Redis
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔴 Redis Service");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
      const { stdout: redisStatus } = await execAsync("brew services list | grep redis");
      if (redisStatus.includes("started")) {
        console.log("✅ Running\n");
      } else {
        console.log("⏹️  Stopped\n");
      }
    } catch {
      console.log("❌ Not installed or not running\n");
    }

    // 2. Check ports
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔌 Port Usage");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const ports = [8787, 4000, 3000, 6379];
    const portNames = {
      8787: "API Server",
      4000: "Preview Server",
      3000: "Next.js",
      6379: "Redis",
    };

    for (const port of ports) {
      try {
        const { stdout } = await execAsync(`lsof -i :${port} -P -n | grep LISTEN`);
        const lines = stdout.trim().split("\n");
        console.log(`\n${portNames[port as keyof typeof portNames]} (${port}):`);
        for (const line of lines) {
          const parts = line.split(/\s+/);
          const process = parts[0];
          const pid = parts[1];
          console.log(`  ✅ ${process} (PID: ${pid})`);
        }
      } catch {
        console.log(`\n${portNames[port as keyof typeof portNames]} (${port}):`);
        console.log("  ⏹️  Not in use");
      }
    }

    // 3. Check project processes
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💻 Project Processes");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const processes = [
      { name: "pnpm dev", pattern: "pnpm.*dev" },
      { name: "concurrently", pattern: "concurrently" },
      { name: "tsx watch (server)", pattern: "tsx watch server/index" },
      { name: "tsx watch (preview)", pattern: "tsx watch server/preview" },
      { name: "tsx watch (worker)", pattern: "tsx watch scripts/start-worker" },
      { name: "next dev", pattern: "next dev" },
      { name: "standalone worker", pattern: "tsx.*start-worker" },
    ];

    for (const proc of processes) {
      try {
        const { stdout } = await execAsync(
          `ps aux | grep -E '${proc.pattern}' | grep -v grep | grep -v ps.ts`
        );
        const lines = stdout.trim().split("\n").filter((l) => l);

        if (lines.length > 0) {
          console.log(`${proc.name}:`);

          if (lines.length > 1) {
            console.log(`  ⚠️  DUPLICATES FOUND (${lines.length} instances)`);
          }

          for (const line of lines) {
            const parts = line.split(/\s+/);
            const pid = parts[1];
            const cpu = parts[2];
            const mem = parts[3];
            const started = parts[8];
            const cmd = parts.slice(10).join(" ").substring(0, 60);

            console.log(`  ${lines.length > 1 ? "⚠️" : "✅"} PID: ${pid} | CPU: ${cpu}% | MEM: ${mem}% | Started: ${started}`);
            console.log(`     ${cmd}...`);
          }
          console.log();
        }
      } catch {
        // Process not running
      }
    }

    // 4. Check for zombie node/tsx processes
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("👻 Potential Zombie Processes");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    try {
      const { stdout } = await execAsync(
        `ps aux | grep -E '(tsx|node)' | grep -v grep | grep -v ps.ts | grep -E '(react-agent-prototype|pnpm)'`
      );
      const lines = stdout.trim().split("\n").filter((l) => l);

      // Count by process type
      const tsxCount = lines.filter((l) => l.includes("tsx")).length;
      const nodeCount = lines.filter((l) => l.includes("node")).length;
      const pnpmCount = lines.filter((l) => l.includes("pnpm")).length;

      console.log(`Total project processes: ${lines.length}`);
      console.log(`  - tsx: ${tsxCount}`);
      console.log(`  - node: ${nodeCount}`);
      console.log(`  - pnpm: ${pnpmCount}`);

      // Check for old processes (started days ago)
      const oldProcesses = lines.filter((l) => {
        const parts = l.split(/\s+/);
        const started = parts[8];
        return started.includes("Nov") || started.includes("Oct") || /^\d{1,2}:\d{2}[AP]M$/.test(started) === false;
      });

      if (oldProcesses.length > 0) {
        console.log(`\n⚠️  Found ${oldProcesses.length} old process(es) (might be zombies):`);
        for (const line of oldProcesses) {
          const parts = line.split(/\s+/);
          const pid = parts[1];
          const started = parts[8];
          const cmd = parts.slice(10).join(" ").substring(0, 50);
          console.log(`  PID: ${pid} | Started: ${started} | ${cmd}...`);
        }
      } else {
        console.log("\n✅ No zombie processes detected");
      }
    } catch {
      console.log("✅ No project processes found");
    }

    // 5. Summary
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 Quick Actions");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Stop services:");
    console.log("  pnpm stop        - Stop dev processes");
    console.log("  pnpm stop:all    - Stop everything (dev + Redis)");
    console.log("\nKill specific process:");
    console.log("  kill -9 <PID>    - Force kill by PID");
    console.log("\nKill all (nuclear option):");
    console.log("  killall -9 tsx   - Kill all tsx processes");
    console.log("  killall -9 node  - Kill all node processes");
    console.log("\nCheck again:");
    console.log("  pnpm ps          - Run this monitor again");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

showProcesses();
