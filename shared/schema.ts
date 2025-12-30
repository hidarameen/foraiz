import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Replit Auth User
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  roles: text("roles").array().default(["user"]), // admin, user
  createdAt: timestamp("created_at").defaultNow(),
});

// Telegram Sessions (Connected Accounts)
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  sessionName: text("session_name").notNull(), // Friendly name
  phoneNumber: text("phone_number").notNull(),
  sessionString: text("session_string").notNull(), // GramJS session string
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastActive: timestamp("last_active"),
});

// Forwarding Tasks
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sessionId: integer("session_id").references(() => sessions.id).notNull(),
  
  // Source & Destination
  sourceChannels: text("source_channels").array().notNull(), // List of Chat IDs or Usernames
  destinationChannels: text("destination_channels").array().notNull(), // List of Chat IDs or Usernames
  
  // Filters & Options stored as JSON for flexibility
  // Example: { keywords: ["urgent", "sale"], exclude: ["spam"], mediaTypes: ["photo", "video"] }
  filters: jsonb("filters").$type<{
    keywords?: string[];
    excludeKeywords?: string[];
    mediaTypes?: ("photo" | "video" | "document" | "audio" | "voice" | "sticker")[];
    minId?: number;
  }>().default({}),
  
  // Forwarding Options
  // Example: { withCaption: true, dropAuthor: false, delay: 0 }
  options: jsonb("options").$type<{
    withCaption?: boolean;
    dropAuthor?: boolean; // Send as copy vs forward
    delaySeconds?: number;
    addSignature?: string; // Custom footer text
    spoilerText?: boolean; // Force spoiler?
  }>().default({}),

  isActive: boolean("is_active").default(false),
  status: text("status").default("stopped"), // stopped, running, error
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Logs for forwarded messages
export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id),
  sourceChannel: text("source_channel"),
  destinationChannel: text("destination_channel"),
  messageId: text("message_id"), // Original Message ID
  status: text("status").notNull(), // success, failed, skipped
  details: text("details"), // Error message or skip reason
  timestamp: timestamp("timestamp").defaultNow(),
});

// === RELATIONS ===
// (Defined implicitly via references for now)

// === BASE SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });

// Regular username/password login schema
export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Telegram login schema (for phone-based authentication)
export const telegramLoginSchema = z.object({
  phoneNumber: z.string(),
  code: z.string().optional(),
  password: z.string().optional(),
  phoneCodeHash: z.string().optional(),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true, lastActive: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, status: true, errorMessage: true });
export const insertLogSchema = createInsertSchema(logs).omit({ id: true, timestamp: true });

// === TYPES ===
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;

// Request Types
export type CreateTaskRequest = InsertTask;
export type UpdateTaskRequest = Partial<InsertTask>;
export type CreateSessionRequest = InsertSession;

// Types for complex JSON fields
export type TaskFilters = NonNullable<Task["filters"]>;
export type TaskOptions = NonNullable<Task["options"]>;
