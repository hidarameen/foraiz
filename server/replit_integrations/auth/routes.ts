import type { Express } from "express";
import { storage } from "../../storage";
import { loginSchema, telegramLoginSchema } from "@shared/schema";
import { z } from "zod";
import bcryptjs from "bcryptjs";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const input = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(input.username);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isPasswordValid = await bcryptjs.compare(input.password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      (req as any).user = { id: user.id, username: user.username };
      (req.session as any).userId = user.id;

      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          displayName: user.displayName 
        } 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const input = loginSchema.parse(req.body);
      
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcryptjs.hash(input.password, 10);
      const user = await storage.createUser({
        username: input.username,
        password: hashedPassword,
      });

      res.status(201).json({ 
        user: { 
          id: user.id, 
          username: user.username 
        } 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Get current user
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      res.json({ 
        id: user.id, 
        username: user.username, 
        displayName: user.displayName 
      });
    } catch (error) {
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });
}
