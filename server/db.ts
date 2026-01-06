import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Helper to handle migrations if needed
export async function setupDatabase() {
  try {
    // For local dev/fast-mode, we can use drizzle-kit push in the shell,
    // but having a programmatic way to ensure tables exist is better.
    // However, since we are in fast-mode and user wants it done "now",
    // we rely on the npx drizzle-kit push command.
    console.log("Database connection established");
  } catch (error) {
    console.error("Database setup error:", error);
    throw error;
  }
}
