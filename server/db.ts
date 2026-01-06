import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { fileURLToPath } from "url";
import { sql } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

const __filename = process.env.NODE_ENV === 'production' 
  ? ""
  : fileURLToPath(import.meta.url);
const __dirname = process.env.NODE_ENV === 'production'
  ? path.resolve(process.cwd())
  : path.dirname(__filename);

// Helper to handle migrations and ensure tables exist
export async function setupDatabase() {
  try {
    console.log("Starting database synchronization...");
    
    // Attempt migration, catch specific "already exists" error
    await migrate(db, { 
      migrationsFolder: path.resolve(__dirname, "../migrations") 
    }).catch(err => {
      // 42P07 is the error code for "relation already exists"
      if (err.code === '42P07') {
        console.log("Tables already exist, skipping initial migration.");
      } else {
        throw err;
      }
    });

    // Handle session table manually if needed for connect-pg-simple
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "express_sessions" (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL,
          CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
        ) WITH (OIDS=FALSE);
        CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "express_sessions" ("expire");
      `);
      console.log("Session table checked/created");
    } catch (sessionErr) {
      console.error("Error ensuring session table:", sessionErr);
    }
    
    console.log("Database synchronization completed");
  } catch (error) {
    console.error("Database setup error:", error);
  }
}
