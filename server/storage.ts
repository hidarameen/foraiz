import { db } from "./db";
import { 
  users, sessions, tasks, logs, aiConfigs,
  type Session, type InsertSession,
  type Task, type InsertTask,
  type Log, type InsertLog,
  type User, type InsertUser,
  type AIConfig, type InsertAIConfig
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Sessions
  getSessions(): Promise<Session[]>;
  getSession(id: number): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  deleteSession(id: number): Promise<void>;

  // Tasks
  getTasks(): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: number): Promise<void>;

  // Logs
  getLogs(limit?: number): Promise<Log[]>;
  createLog(log: InsertLog): Promise<Log>;
  deleteLogsByTaskId(taskId: number): Promise<void>;

  // AI Configs
  getAIConfigs(): Promise<AIConfig[]>;
  getAIConfigByProvider(provider: string): Promise<AIConfig | undefined>;
  upsertAIConfig(config: InsertAIConfig): Promise<AIConfig>;
}

export class DatabaseStorage implements IStorage {
  // === USERS ===
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // === SESSIONS ===
  async getSessions(): Promise<Session[]> {
    return await db.select().from(sessions);
  }

  async getSession(id: number): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const [session] = await db.insert(sessions).values(insertSession).returning();
    return session;
  }

  async deleteSession(id: number): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  // === TASKS ===
  async getTasks(): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(insertTask as any).returning();
    return task as Task;
  }

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task> {
    const [task] = await db
      .update(tasks)
      .set(updates as any)
      .where(eq(tasks.id, id))
      .returning();
    return task as Task;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // === LOGS ===
  async getLogs(limit: number = 50): Promise<Log[]> {
    return await db.select().from(logs).orderBy(desc(logs.timestamp)).limit(limit);
  }

  async createLog(insertLog: InsertLog): Promise<Log> {
    const [log] = await db.insert(logs).values(insertLog).returning();
    return log;
  }

  async deleteLogsByTaskId(taskId: number): Promise<void> {
    await db.delete(logs).where(eq(logs.taskId, taskId));
  }

  // === AI CONFIGS ===
  async getAIConfigs(): Promise<AIConfig[]> {
    return await db.select().from(aiConfigs);
  }

  async getAIConfigByProvider(provider: string): Promise<AIConfig | undefined> {
    const [config] = await db.select().from(aiConfigs).where(eq(aiConfigs.provider, provider));
    return config;
  }

  async upsertAIConfig(insertConfig: InsertAIConfig): Promise<AIConfig> {
    const [config] = await db
      .insert(aiConfigs)
      .values(insertConfig)
      .onConflictDoUpdate({
        target: aiConfigs.provider,
        set: {
          apiKey: insertConfig.apiKey,
          isActive: insertConfig.isActive,
          updatedAt: new Date(),
        },
      })
      .returning();
    return config;
  }
}

export const storage = new DatabaseStorage();
