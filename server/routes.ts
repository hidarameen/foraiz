import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import { telegramLoginSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { sendCode, signIn, startAllMessageListeners } from "./services/telegram";

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

import { AIService, AI_CONFIG } from "./services/ai";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ... (setupAuth and message listeners)

  // === AI ROUTES ===
  app.get("/api/ai/config", (req, res) => {
    res.json(AI_CONFIG);
  });

  app.get("/api/ai/settings", async (req, res) => {
    const configs = await storage.getAIConfigs();
    res.json(configs);
  });

  app.post("/api/ai/settings", async (req, res) => {
    try {
      const config = await storage.upsertAIConfig(req.body);
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/ai/test", async (req, res) => {
    try {
      const { provider, model, prompt, apiKey } = req.body;
      if (!provider || !model || !prompt) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const response = await AIService.chat(provider, model, prompt, apiKey);
      res.json(response);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/telegram/resolve", async (req, res) => {
    const { sessionId, identifier } = req.query;
    if (!sessionId || !identifier) {
      return res.status(400).json({ message: "Missing sessionId or identifier" });
    }

    try {
      const { getTelegramClient } = await import("./services/telegram");
      const client = await getTelegramClient(Number(sessionId));
      if (!client) {
        return res.status(404).json({ message: "Session not found or not active" });
      }

      const cleanIdentifier = String(identifier).replace("https://t.me/", "").replace("@", "");
      let entity;
      try {
        entity = await client.getEntity(cleanIdentifier);
      } catch (e: any) {
        // Fallback for private links/invite hashes
        if (cleanIdentifier.length > 20) {
          const { resolveChannelId } = await import("./services/telegram");
          const resolvedId = await resolveChannelId(Number(sessionId), String(identifier));
          return res.json({
            id: resolvedId,
            title: cleanIdentifier,
            username: null
          });
        }
        throw e;
      }
      
      let resolvedId = entity.id.toString();
      const className = entity.className || (entity as any).constructor?.name || (entity as any)._?.replace('Api.', '') || '';
      if ((className === 'Channel' || className === 'Chat') && !resolvedId.startsWith("-100") && !resolvedId.startsWith("-")) {
        resolvedId = "-100" + resolvedId;
      }

      res.json({
        id: resolvedId,
        title: (entity as any).title || (entity as any).firstName || cleanIdentifier,
        username: (entity as any).username
      });
    } catch (err: any) {
      console.error("[Telegram] Resolve error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // 1. Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // 2. Start Message Listeners for all active sessions
  console.log("[Routes] Initializing message listeners...");
  await startAllMessageListeners().catch(err => 
    console.error("[Routes] Failed to start message listeners:", err)
  );

  // 3. Application Routes
  app.post("/api/tasks/:id/fetch", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.getTask(id);
      if (!task) return res.status(404).json({ message: "Task not found" });
      
      const { fetchLastMessages } = await import("./services/telegram");
      // Run in background
      fetchLastMessages(id, task.sourceChannels).catch(console.error);
      
      res.json({ message: "Manual fetch triggered" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

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
          
          // Handle password verification in progress
          if (err.message === "PASSWORD_VERIFICATION_IN_PROGRESS") {
            logRequest("INFO", api.sessions.login.path, "Password verification in progress, cannot send new code");
            return res.status(400).json({ 
              message: "يرجى إكمال التحقق من كلمة المرور أولاً قبل طلب رمز جديد.",
              errorCode: "PASSWORD_VERIFICATION_IN_PROGRESS"
            });
          }
          
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

          if (err.message.includes("RATE_LIMITED")) {
            let waitSeconds = 30;
            const match = err.message.match(/RATE_LIMITED_WAIT_(\d+)/);
            if (match) {
              waitSeconds = parseInt(match[1]);
            }
            logRequest("WARN", api.sessions.login.path, "Rate limit hit", { waitSeconds });
            return res.status(429).json({ 
              message: `تم محاولة التسجيل عدة مرات. الرجاء الانتظار ${waitSeconds} ثانية قبل المحاولة مجددا.`,
              errorCode: "RATE_LIMITED",
              waitSeconds
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
  // Helper function to clean legacy AI filters data
  function cleanAIFilters(filters: any): any {
    if (!filters || !filters.aiFilters) {
      return filters;
    }

    const cleaned = { ...filters };
    const aiFilters = { ...filters.aiFilters };

    // Remove all legacy fields completely
    delete aiFilters.rules;
    delete aiFilters.blacklist;
    delete aiFilters.whitelist;

    // Ensure clean arrays with correct field names - filter out empty rules
    aiFilters.blacklistRules = Array.isArray(aiFilters.blacklistRules) 
      ? aiFilters.blacklistRules
          .filter((r: any) => r.name && String(r.name).trim().length > 0)
          .map((r: any) => ({
            id: r.id,
            name: r.name,
            instruction: r.instruction || '',
            isActive: r.isActive ?? true,
            priority: r.priority ?? 0
          }))
      : [];

    aiFilters.whitelistRules = Array.isArray(aiFilters.whitelistRules)
      ? aiFilters.whitelistRules
          .filter((r: any) => r.name && String(r.name).trim().length > 0)
          .map((r: any) => ({
            id: r.id,
            name: r.name,
            instruction: r.instruction || '',
            isActive: r.isActive ?? true,
            priority: r.priority ?? 0
          }))
      : [];

    cleaned.aiFilters = aiFilters;
    return cleaned;
  }

  // Helper function to clean/normalize task options
  function cleanTaskOptions(options: any): any {
    if (!options) return options;
    const cleaned = { ...options };

    if (cleaned.aiRewrite) {
      const aiRewrite = { ...cleaned.aiRewrite };
      // Ensure we don't accidentally drop the whole object if rules are missing
      aiRewrite.isEnabled = !!aiRewrite.isEnabled;
      aiRewrite.provider = aiRewrite.provider || "openai";
      aiRewrite.model = aiRewrite.model || "gpt-4o-mini";
      
      aiRewrite.rules = Array.isArray(aiRewrite.rules)
        ? aiRewrite.rules
            .filter((r: any) => r && r.name && String(r.name).trim().length > 0)
            .map((r: any) => ({
              id: r.id || Math.random().toString(36).substr(2, 9),
              name: String(r.name).trim(),
              instruction: String(r.instruction || '').trim(),
              isActive: r.isActive ?? true
            }))
        : [];
      cleaned.aiRewrite = aiRewrite;
    }
    return cleaned;
  }

  app.get(api.tasks.list.path, async (req, res) => {
    logRequest("INFO", api.tasks.list.path, "Fetching all tasks");
    try {
      const tasks = await storage.getTasks();
      // Clean all legacy fields from response
      const cleanedTasks = tasks.map(task => ({
        ...task,
        filters: cleanAIFilters(task.filters),
        options: cleanTaskOptions(task.options)
      }));
      logRequest("SUCCESS", api.tasks.list.path, `Retrieved ${cleanedTasks.length} tasks`);
      res.json(cleanedTasks);
    } catch (err: any) {
      logRequest("ERROR", api.tasks.list.path, "Failed to fetch tasks", { error: err.message });
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  app.get(api.tasks.get.path, async (req, res) => {
    const taskId = Number(req.params.id);
    logRequest("INFO", api.tasks.get.path, `Fetching task ${taskId}`);
    try {
      const task = await storage.getTask(taskId);
      if (!task) {
        logRequest("WARN", api.tasks.get.path, `Task ${taskId} not found`);
        return res.status(404).json({ message: 'Task not found' });
      }
      // Clean legacy fields
      const cleanedTask = {
        ...task,
        filters: cleanAIFilters(task.filters),
        options: cleanTaskOptions(task.options)
      };
      logRequest("SUCCESS", api.tasks.get.path, `Retrieved task ${taskId}`);
      res.json(cleanedTask);
    } catch (err: any) {
      logRequest("ERROR", api.tasks.get.path, `Failed to fetch task ${taskId}`, { error: err.message });
      res.status(500).json({ message: 'Failed to fetch task' });
    }
  });

  app.post(api.tasks.create.path, async (req, res) => {
    logRequest("INFO", api.tasks.create.path, "Creating new task", {
      bodyKeys: Object.keys(req.body),
      bodyData: req.body
    });
    try {
      // Clean legacy fields from request
      const cleanedBody = {
        ...req.body,
        filters: cleanAIFilters(req.body.filters),
        options: cleanTaskOptions(req.body.options)
      };

      // تسوية المصادر والأهداف إلى IDs رقمية
      const { resolveChannelId } = await import("./services/telegram");
      if (cleanedBody.sourceChannels) {
        cleanedBody.sourceChannels = await Promise.all(
          cleanedBody.sourceChannels.map((id: string) => resolveChannelId(cleanedBody.sessionId, id).catch(() => id))
        );
      }
      if (cleanedBody.destinationChannels) {
        cleanedBody.destinationChannels = await Promise.all(
          cleanedBody.destinationChannels.map((id: string) => resolveChannelId(cleanedBody.sessionId, id).catch(() => id))
        );
      }
      
      const input = api.tasks.create.input.parse(cleanedBody);
      logRequest("SUCCESS", api.tasks.create.path, "Input validation passed", { input });
      const task = await storage.createTask(input);
      logRequest("SUCCESS", api.tasks.create.path, `Task created successfully`, {
        taskId: task.id,
        taskName: task.name,
      });

      // تفعيل المستمع للجلسة عند إنشاء مهمة نشطة جديدة
      if (task.isActive) {
        const { startMessageListener } = await import("./services/telegram");
        await startMessageListener(task.sessionId).catch(err => 
          console.error(`[Routes] Failed to start listener for session ${task.sessionId}:`, err)
        );
      }

      res.status(201).json({
        ...task,
        filters: cleanAIFilters(task.filters),
        options: cleanTaskOptions(task.options)
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        logRequest("WARN", api.tasks.create.path, "Validation error", {
          errors: err.errors
        });
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      logRequest("ERROR", api.tasks.create.path, "Unexpected error", { 
        error: (err as any).message,
        stack: (err as any).stack 
      });
      res.status(500).json({ message: (err as any).message });
    }
  });

  app.put(api.tasks.update.path, async (req, res) => {
    const taskId = Number(req.params.id);
    logRequest("INFO", api.tasks.update.path, `Updating task ${taskId}`, {
      bodyKeys: Object.keys(req.body),
      bodyData: req.body
    });
    try {
      // Clean incoming data
      if (req.body.filters?.mediaTypes && typeof req.body.filters.mediaTypes === 'object') {
        const mediaTypes = req.body.filters.mediaTypes;
        if (!Array.isArray(mediaTypes)) {
          const cleanedMedia: Record<string, boolean> = {};
          Object.keys(mediaTypes).forEach(key => {
            cleanedMedia[key] = String(mediaTypes[key]) === 'true';
          });
          req.body.filters.mediaTypes = cleanedMedia;
        }
      }

      // Clean legacy fields from request
      const cleanedBody = {
        ...req.body,
        filters: cleanAIFilters(req.body.filters),
        options: cleanTaskOptions(req.body.options)
      };

      // تسوية المصادر والأهداف إلى IDs رقمية
      const { resolveChannelId } = await import("./services/telegram");
      if (cleanedBody.sourceChannels) {
        cleanedBody.sourceChannels = await Promise.all(
          cleanedBody.sourceChannels.map((id: string) => {
            // Already resolved ID
            if (/^-?\d+$/.test(id)) return id;
            return resolveChannelId(cleanedBody.sessionId || task.sessionId, id).catch(() => id);
          })
        );
      }
      if (cleanedBody.destinationChannels) {
        cleanedBody.destinationChannels = await Promise.all(
          cleanedBody.destinationChannels.map((id: string) => {
            // Already resolved ID
            if (/^-?\d+$/.test(id)) return id;
            return resolveChannelId(cleanedBody.sessionId || task.sessionId, id).catch(() => id);
          })
        );
      }

      // Ensure isActive is preserved if not explicitly sent as false in a toggle action
      // In a full update, we take what's in the body.
      
      console.log(`[Routes] Updating task ${taskId} with data:`, JSON.stringify(cleanedBody.options?.aiRewrite, null, 2));
      const input = api.tasks.update.input.parse(cleanedBody);
      logRequest("SUCCESS", api.tasks.update.path, `Input validation passed for task ${taskId}`, { input });
      
      const task = await storage.updateTask(taskId, input);
      if (!task) {
        logRequest("WARN", api.tasks.update.path, `Task ${taskId} not found`);
        return res.status(404).json({ message: 'Task not found' });
      }

      // Restart listener logic
      if (task.isActive) {
        const { startMessageListener } = await import("./services/telegram");
        // startMessageListener already has an internal check (messageListeners.has(sessionId))
        // to prevent duplicate listeners for the same session.
        await startMessageListener(task.sessionId).catch(err => 
          console.error(`[Routes] Failed to ensure listener for session ${task.sessionId}:`, err)
        );
      }

      logRequest("SUCCESS", api.tasks.update.path, `Task ${taskId} updated successfully`);
      res.json({
        ...task,
        filters: cleanAIFilters(task.filters),
        options: cleanTaskOptions(task.options)
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        logRequest("WARN", api.tasks.update.path, `Validation error for task ${taskId}`, {
          errors: err.errors
        });
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      logRequest("ERROR", api.tasks.update.path, `Unexpected error updating task ${taskId}`, { 
        error: (err as any).message,
        stack: (err as any).stack 
      });
      throw err;
    }
  });

  app.delete(api.tasks.delete.path, async (req, res) => {
    const taskId = Number(req.params.id);
    logRequest("INFO", api.tasks.delete.path, `Deleting task ${taskId}`);
    try {
      const task = await storage.getTask(taskId);
      
      // Delete associated logs first to avoid foreign key constraint violation
      await storage.deleteLogsByTaskId(taskId);
      await storage.deleteTask(taskId);

      // إذا كانت هذه هي المهمة النشطة الوحيدة، نوقف المستمع
      if (task) {
        const allTasks = await storage.getTasks();
        const otherActiveTasks = allTasks.filter(t => t.sessionId === task.sessionId && t.isActive);
        if (otherActiveTasks.length === 0) {
          const { stopMessageListener } = await import("./services/telegram");
          await stopMessageListener(task.sessionId);
        }
      }

      logRequest("SUCCESS", api.tasks.delete.path, `Task ${taskId} deleted successfully`);
      res.status(204).send();
    } catch (err: any) {
      logRequest("ERROR", api.tasks.delete.path, `Failed to delete task ${taskId}`, { error: err.message });
      res.status(500).json({ message: 'Failed to delete task' });
    }
  });

  app.patch(api.tasks.toggle.path, async (req, res) => {
    const taskId = Number(req.params.id);
    const { isActive } = req.body;
    logRequest("INFO", api.tasks.toggle.path, `Toggling task ${taskId}`, { isActive });
    try {
      const task = await storage.updateTask(taskId, { isActive });
      if (!task) {
        logRequest("WARN", api.tasks.toggle.path, `Task ${taskId} not found`);
        return res.status(404).json({ message: 'Task not found' });
      }

      // تفعيل/إيقاف المستمع بناءً على الحالة الجديدة
      const { startMessageListener, stopMessageListener } = await import("./services/telegram");
      if (isActive) {
        // Don't await listener start to speed up response
        startMessageListener(task.sessionId).catch(err => 
          console.error(`[Routes] Failed to start listener for session ${task.sessionId}:`, err)
        );
      } else {
        // نتحقق أولاً إذا كانت هناك مهام نشطة أخرى قبل إيقاف المستمع تماماً
        const allTasks = await storage.getTasks();
        const otherActiveTasks = allTasks.filter(t => t.sessionId === task.sessionId && t.isActive && t.id !== taskId);
        if (otherActiveTasks.length === 0) {
          stopMessageListener(task.sessionId).catch(err =>
            console.error(`[Routes] Failed to stop listener for session ${task.sessionId}:`, err)
          );
        }
      }

      logRequest("SUCCESS", api.tasks.toggle.path, `Task ${taskId} toggled to ${isActive}`, { task });
      res.json(task);
    } catch (err: any) {
      logRequest("ERROR", api.tasks.toggle.path, `Failed to toggle task ${taskId}`, { error: err.message });
      res.status(500).json({ message: 'Failed to toggle task' });
    }
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

  // === TEST ENDPOINTS ===
  // Test message listener
  app.post('/api/test/simulate-message', async (req, res) => {
    try {
      const { taskId, messageText, chatId } = req.body;
      
      logRequest("INFO", "/api/test/simulate-message", "Simulating message", {
        taskId,
        messageText: messageText?.substring(0, 50),
        chatId
      });

      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }

      const { forwarder } = await import('./services/forwarder');
      const results = await forwarder.forwardMessage(
        task,
        `sim_${Date.now()}`,
        messageText || "رسالة اختبار",
        { simulatedMessage: true }
      );

      logRequest("SUCCESS", "/api/test/simulate-message", "Message simulated successfully", { results });
      res.json({ success: true, results });
    } catch (err) {
      logRequest("ERROR", "/api/test/simulate-message", (err as Error).message);
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Check Telegram connection
  app.get('/api/test/telegram-status', async (req, res) => {
    try {
      const { getTelegramClient } = await import('./services/telegram');
      const sessions = await storage.getSessions();
      
      const statusData = await Promise.all(
        sessions.map(async (session) => {
          try {
            const client = await getTelegramClient(session.id);
            const isConnected = client ? true : false;
            
            if (isConnected && client) {
              try {
                const me = await client.getMe();
                return {
                  sessionId: session.id,
                  phoneNumber: session.phoneNumber,
                  isActive: session.isActive,
                  connected: true,
                  userId: me?.id,
                  username: me?.username
                };
              } catch (e) {
                return {
                  sessionId: session.id,
                  phoneNumber: session.phoneNumber,
                  isActive: session.isActive,
                  connected: true,
                  error: 'Failed to get user info'
                };
              }
            }
            
            return {
              sessionId: session.id,
              phoneNumber: session.phoneNumber,
              isActive: session.isActive,
              connected: false
            };
          } catch (e) {
            return {
              sessionId: session.id,
              phoneNumber: session.phoneNumber,
              isActive: session.isActive,
              connected: false,
              error: (e as Error).message
            };
          }
        })
      );

      logRequest("SUCCESS", "/api/test/telegram-status", "Telegram status retrieved", { statusData });
      res.json({ status: 'ok', sessions: statusData });
    } catch (err) {
      logRequest("ERROR", "/api/test/telegram-status", (err as Error).message);
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Get channel entities
  app.post('/api/test/get-entity', async (req, res) => {
    try {
      const { sessionId, entity } = req.body;
      
      if (!sessionId || !entity) {
        return res.status(400).json({ message: 'sessionId and entity are required' });
      }

      const { getTelegramClient } = await import('./services/telegram');
      const client = await getTelegramClient(sessionId);
      
      if (!client) {
        return res.status(404).json({ message: 'Client not found for session' });
      }

      logRequest("INFO", "/api/test/get-entity", "Resolving entity", { sessionId, entity });

      try {
        const resolvedEntity = await client.getEntity(entity);
        
        logRequest("SUCCESS", "/api/test/get-entity", "Entity resolved", {
          inputId: entity,
          entityId: resolvedEntity?.id,
          entityTitle: (resolvedEntity as any)?.title || (resolvedEntity as any)?.username
        });

        res.json({
          success: true,
          entity: {
            id: resolvedEntity?.id?.toString(),
            title: (resolvedEntity as any)?.title,
            username: (resolvedEntity as any)?.username,
            type: (resolvedEntity as any)?.isUser ? 'user' : (resolvedEntity as any)?.isSupergroup ? 'supergroup' : 'unknown'
          }
        });
      } catch (err) {
        logRequest("WARN", "/api/test/get-entity", "Entity resolution failed", { error: (err as Error).message });
        res.json({
          success: false,
          message: `Failed to resolve entity: ${(err as Error).message}`
        });
      }
    } catch (err) {
      logRequest("ERROR", "/api/test/get-entity", (err as Error).message);
      res.status(500).json({ message: (err as Error).message });
    }
  });

  return httpServer;
}
