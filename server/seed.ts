import { storage } from "./storage";
import { db } from "./db";
import { tasks, sessions, logs } from "@shared/schema";
import { users } from "@shared/models/auth";

export async function seed() {
  // Seeding disabled to prevent ghost tasks
  return;
}
