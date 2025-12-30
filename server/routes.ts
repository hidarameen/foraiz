import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { sendCode, signIn } from "./services/telegram";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // 1. Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // 2. Application Routes

  // === SESSIONS ===
  app.get(api.sessions.list.path, async (req, res) => {
    const sessions = await storage.getSessions();
    res.json(sessions);
  });

  app.post(api.sessions.create.path, async (req, res) => {
    try {
      const input = api.sessions.create.input.parse(req.body);
      const session = await storage.createSession(input);
      res.status(201).json(session);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.sessions.delete.path, async (req, res) => {
    await storage.deleteSession(Number(req.params.id));
    res.status(204).send();
  });

  // Telegram Login Route
  app.post(api.sessions.login.path, async (req, res) => {
    const { phoneNumber, code, password, phoneCodeHash } = req.body;
    
    try {
      if (phoneNumber && !code) {
        const hash = await sendCode(phoneNumber);
        return res.json({ status: 'code_sent', phoneCodeHash: hash });
      }
      
      if (phoneNumber && code) {
        try {
          const sessionString = await signIn(phoneNumber, code, password);
          
          const session = await storage.createSession({
            sessionName: `Account ${phoneNumber}`,
            phoneNumber: phoneNumber,
            sessionString: sessionString,
            isActive: true
          });
          
          return res.json({ status: 'logged_in', sessionString: session.sessionString });
        } catch (err: any) {
          if (err.message === "PASSWORD_REQUIRED") {
            return res.json({ status: 'password_required' });
          }
          if (err.message === "SESSION_EXPIRED_OR_NOT_FOUND") {
             return res.status(400).json({ message: "انتهت صلاحية الجلسة، يرجى طلب رمز جديد." });
          }
          throw err;
        }
      }

      return res.status(400).json({ message: "Missing required fields" });
    } catch (err: any) {
      console.error("Telegram Login Error:", err);
      res.status(500).json({ message: err.message || "Internal server error" });
    }
  });

  // === TASKS ===
  app.get(api.tasks.list.path, async (req, res) => {
    const tasks = await storage.getTasks();
    res.json(tasks);
  });

  app.get(api.tasks.get.path, async (req, res) => {
    const task = await storage.getTask(Number(req.params.id));
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  });

  app.post(api.tasks.create.path, async (req, res) => {
    try {
      const input = api.tasks.create.input.parse(req.body);
      const task = await storage.createTask(input);
      res.status(201).json(task);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.tasks.update.path, async (req, res) => {
    try {
      const input = api.tasks.update.input.parse(req.body);
      const task = await storage.updateTask(Number(req.params.id), input);
      if (!task) return res.status(404).json({ message: 'Task not found' });
      res.json(task);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.tasks.delete.path, async (req, res) => {
    await storage.deleteTask(Number(req.params.id));
    res.status(204).send();
  });

  app.patch(api.tasks.toggle.path, async (req, res) => {
    const { isActive } = req.body;
    const task = await storage.updateTask(Number(req.params.id), { isActive });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  });

  // === LOGS ===
  app.get(api.logs.list.path, async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const logs = await storage.getLogs(limit);
    res.json(logs);
  });

  // === STATS ===
  app.get(api.stats.get.path, async (req, res) => {
    const tasks = await storage.getTasks();
    const logs = await storage.getLogs(1000);
    
    const activeTasks = tasks.filter(t => t.isActive).length;
    const totalForwarded = logs.filter(l => l.status === 'success').length;
    
    res.json({
      activeTasks,
      totalForwarded,
      uptime: process.uptime(),
      workerStatus: 'running'
    });
  });

  return httpServer;
}
