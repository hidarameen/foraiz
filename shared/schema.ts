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

// AI Provider Configurations
export const aiConfigs = pgTable("ai_configs", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().unique(), // openai, anthropic, etc.
  apiKey: text("api_key"),
  isActive: boolean("is_active").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  filters: jsonb("filters").$type<{
    mediaTypes?: Record<string, boolean>;
    aiFilters?: {
      isEnabled: boolean;
      provider: string;
      model: string;
      mode: 'whitelist' | 'blacklist';
      blacklistRules: {
        id: string;
        name: string;
        instruction: string; // The rule for the AI
        isActive: boolean;
        priority: number;
      }[];
      whitelistRules: {
        id: string;
        name: string;
        instruction: string; // The rule for the AI
        isActive: boolean;
        priority: number;
      }[];
    };
    minId?: number;
  }>().default({
    mediaTypes: {
      text: true,
      photo: true,
      video: true,
      document: true,
      audio: true,
      voice: true,
      sticker: true,
      videoNote: true,
      animation: true,
      poll: true,
      contact: true,
      location: true,
      invoice: true,
    },
    aiFilters: {
      isEnabled: false,
      provider: "openai",
      model: "gpt-4o-mini",
      mode: "blacklist",
      blacklistRules: [],
      whitelistRules: []
    }
  }),
  
  // Forwarding Options
  options: jsonb("options").$type<{
    withCaption?: boolean;
    dropAuthor?: boolean; // Send as copy vs forward
    delaySeconds?: number;
    addSignature?: string; // Custom footer text
    spoilerText?: boolean; // Force spoiler?
    aiRewrite?: {
      isEnabled: boolean;
      provider: string;
      model: string;
      rules: {
        id: string;
        name: string;
        instruction: string;
        isActive: boolean;
      }[];
    };
  }>().default({
    withCaption: true,
    dropAuthor: false,
    aiRewrite: {
      isEnabled: false,
      provider: "openai",
      model: "gpt-4o-mini",
      rules: []
    }
  }),

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

// === BASE SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });

export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const telegramLoginSchema = z.object({
  phoneNumber: z.string(),
  code: z.string().optional(),
  password: z.string().optional(),
  phoneCodeHash: z.string().optional(),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true, lastActive: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, status: true, errorMessage: true });
export const insertLogSchema = createInsertSchema(logs).omit({ id: true, timestamp: true });
export const insertAiConfigSchema = createInsertSchema(aiConfigs).omit({ id: true, updatedAt: true });

// === TYPES ===
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;

export type AIConfig = typeof aiConfigs.$inferSelect;
export type InsertAIConfig = z.infer<typeof insertAiConfigSchema>;

export type CreateTaskRequest = InsertTask;
export type UpdateTaskRequest = Partial<InsertTask>;
export type CreateSessionRequest = InsertSession;

export type TaskFilters = NonNullable<Task["filters"]>;
export type TaskOptions = NonNullable<Task["options"]>;
