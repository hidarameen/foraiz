import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import { telegramLoginSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { sendCode, signIn } from "./services/telegram";

// Detailed logging utility for routes
function logRequest(level: string, route: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] Route: ${route} | ${message}`;
  if (data) {
    console.log(logMessage, JSON.stringify(data, null, 2));
  } else {
    console.log(logMessage);
  }
}

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
    const timestamp = new Date().toISOString();
    
    logRequest("INFO", api.sessions.login.path, "Login request received", {
      timestamp,
      phoneNumber,
      hasCode: !!code,
      hasPassword: !!password,
      hasPhoneCodeHash: !!phoneCodeHash
    });

    try {
      // Validate input with Telegram schema
      try {
        telegramLoginSchema.parse(req.body);
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          logRequest("WARN", api.sessions.login.path, "Invalid request format", {
            errors: err.errors
          });
          return res.status(400).json({ message: err.errors[0].message });
        }
      }

      // Step 1: Send code if only phone number provided
      if (phoneNumber && !code) {
        logRequest("INFO", api.sessions.login.path, "Step 1: Sending code", { phoneNumber });
        try {
          const hash = await sendCode(phoneNumber);
          logRequest("SUCCESS", api.sessions.login.path, "Code sent successfully", { 
            phoneNumber,
            hashLength: hash.length 
          });
          return res.json({ status: 'code_sent', phoneCodeHash: hash });
        } catch (err: any) {
          logRequest("ERROR", api.sessions.login.path, "Failed to send code", {
            phoneNumber,
            errorMessage: err.message,
            errorCode: err.code
          });
          return res.status(500).json({ 
            message: `فشل إرسال الرمز: ${err.message}`,
            errorCode: err.code 
          });
        }
      }
      
      // Step 2: Sign in with code
      if (phoneNumber && code) {
        logRequest("INFO", api.sessions.login.path, "Step 2: Signing in with code", { 
          phoneNumber,
          codeLength: code.length,
          hasPassword: !!password
        });

        try {
          const sessionString = await signIn(phoneNumber, code, password);
          
          logRequest("SUCCESS", api.sessions.login.path, "Sign in successful, creating session", {
            phoneNumber,
            sessionStringLength: sessionString.length
          });
          
          const session = await storage.createSession({
            sessionName: `Account ${phoneNumber}`,
            phoneNumber: phoneNumber,
            sessionString: sessionString,
            isActive: true
          });
          
          logRequest("SUCCESS", api.sessions.login.path, "Session created successfully", {
            phoneNumber,
            sessionId: session.id
          });
          
          return res.json({ 
            status: 'logged_in', 
            sessionString: session.sessionString,
            message: "تم تسجيل الدخول بنجاح"
          });
        } catch (err: any) {
          logRequest("ERROR", api.sessions.login.path, "Sign in failed", {
            phoneNumber,
            errorMessage: err.message,
            errorCode: err.code
          });

          // Handle specific errors
          if (err.message === "PASSWORD_REQUIRED") {
            logRequest("INFO", api.sessions.login.path, "Password verification required");
            return res.json({ status: 'password_required' });
          }
          
          if (err.message === "SESSION_EXPIRED_OR_NOT_FOUND") {
            logRequest("WARN", api.sessions.login.path, "Session expired");
            return res.status(400).json({ 
              message: "انتهت صلاحية الجلسة، يرجى طلب رمز جديد.",
              errorCode: "SESSION_EXPIRED"
            });
          }

          if (err.message === "CODE_EXPIRED") {
            logRequest("WARN", api.sessions.login.path, "Code expired");
            return res.status(400).json({ 
              message: "انتهت صلاحية الرمز. الرموز تنتهي بعد 5 دقائق من الإرسال. يرجى طلب رمز جديد.",
              errorCode: "CODE_EXPIRED"
            });
          }

          if (err.message === "INVALID_CODE") {
            logRequest("WARN", api.sessions.login.path, "Invalid code provided");
            return res.status(400).json({ 
              message: "الرمز المدخل غير صحيح. تأكد من إدخال الرمز بشكل صحيح.",
              errorCode: "INVALID_CODE"
            });
          }

          if (err.message === "RATE_LIMITED") {
            logRequest("WARN", api.sessions.login.path, "Rate limit hit");
            return res.status(429).json({ 
              message: "تم محاولة التسجيل عدة مرات. الرجاء الانتظار قبل المحاولة مجددا.",
              errorCode: "RATE_LIMITED"
            });
          }

          if (err.message.includes("PHONE_CODE_INVALID")) {
            logRequest("WARN", api.sessions.login.path, "Invalid phone code");
            return res.status(400).json({ 
              message: "الرمز المدخل غير صحيح. تأكد من إدخال الرمز بشكل صحيح.",
              errorCode: "INVALID_CODE"
            });
          }

          if (err.message.includes("PHONE_CODE_EXPIRED")) {
            logRequest("WARN", api.sessions.login.path, "Phone code expired");
            return res.status(400).json({ 
              message: "انتهت صلاحية الرمز. الرموز تنتهي بعد 5 دقائق من الإرسال. يرجى طلب رمز جديد.",
              errorCode: "CODE_EXPIRED"
            });
          }

          if (err.message === "INVALID_PASSWORD") {
            logRequest("WARN", api.sessions.login.path, "Invalid 2FA password");
            return res.status(400).json({ 
              message: "كلمة المرور غير صحيحة. تأكد من إدخال كلمة مرور التحقق بخطوتين بشكل صحيح.",
              errorCode: "INVALID_PASSWORD"
            });
          }

          // Generic error
          logRequest("ERROR", api.sessions.login.path, "Unexpected error during sign in", {
            errorMessage: err.message,
            stack: err.stack
          });

          return res.status(500).json({ 
            message: `خطأ في التسجيل: ${err.message}`,
            errorCode: err.code || "UNKNOWN_ERROR"
          });
        }
      }

      logRequest("WARN", api.sessions.login.path, "Missing required fields");
      return res.status(400).json({ message: "Missing required fields" });
    } catch (err: any) {
      logRequest("ERROR", api.sessions.login.path, "Unexpected error", {
        errorMessage: err.message,
        errorCode: err.code,
        stack: err.stack
      });
      res.status(500).json({ 
        message: err.message || "حدث خطأ في الخادم",
        errorCode: "INTERNAL_ERROR"
      });
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
