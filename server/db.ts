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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to handle migrations and ensure tables exist
export async function setupDatabase() {
  try {
    console.log("Starting database migration...");
    await migrate(db, { 
      migrationsFolder: path.resolve(__dirname, "../migrations") 
    });
    console.log("Database migrations completed successfully");
  } catch (error) {
    console.error("Database setup error:", error);
    // In dev, we might not have migrations generated yet, 
    // so we can fallback to just logging success if tables already exist
    // but the migrate command is the definitive way to ensure they do.
  }
}
