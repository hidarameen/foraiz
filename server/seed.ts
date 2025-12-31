import { storage } from "./storage";
import { db } from "./db";
import { tasks, sessions, logs } from "@shared/schema";
import { users } from "@shared/models/auth";

async function seed() {
  console.log("Checking if seeding is needed...");
  
  const existingTasks = await storage.getTasks();
  if (existingTasks.length > 0) {
    console.log("Database already has data, skipping seed.");
    return;
  }

  console.log("Seeding database...");
  
  // Create a mock session
  const session = await storage.createSession({
    sessionName: "Main Userbot",
    phoneNumber: "+1234567890",
    sessionString: "mock_session_string",
    isActive: true
  });
  console.log("Created session:", session.id);

  // Create a mock task
  const task = await storage.createTask({
    name: "Forward News to Channel",
    sessionId: session.id,
    sourceChannels: ["news_source_1", "news_source_2"],
    destinationChannels: ["my_news_channel"],
    filters: {
      keywords: ["breaking", "urgent"],
      mediaTypes: ["photo", "video"]
    },
    options: {
      withCaption: true,
      dropAuthor: true
    },
    isActive: true
  });
  console.log("Created task:", task.id);

  // Create some mock logs
  await storage.createLog({
    taskId: task.id,
    sourceChannel: "news_source_1",
    destinationChannel: "my_news_channel",
    messageId: "12345",
    status: "success",
    details: "Forwarded successfully"
  });

  await storage.createLog({
    taskId: task.id,
    sourceChannel: "news_source_2",
    destinationChannel: "my_news_channel",
    messageId: "12346",
    status: "failed",
    details: "FloodWait: 50 seconds"
  });

  console.log("Seeding complete!");
}

seed().catch(console.error);
