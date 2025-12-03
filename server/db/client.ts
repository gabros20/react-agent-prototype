import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL || "file:data/sqlite.db";

// Extract file path from URL
const dbPath = DATABASE_URL.replace("file:", "");

// Initialize SQLite connection
const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrency
sqlite.pragma("journal_mode = WAL");

// Enable foreign key enforcement (required for ON DELETE CASCADE to work)
sqlite.pragma("foreign_keys = ON");

// Create Drizzle instance with schema
export const db = drizzle(sqlite, { schema });

export type DrizzleDB = typeof db;

// Helper to close the database connection
export function closeDatabase() {
  sqlite.close();
}
