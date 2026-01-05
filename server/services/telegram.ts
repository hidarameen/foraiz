import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { storage } from "../storage";
import { forwarder } from "./forwarder";

const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
const apiHash = process.env.TELEGRAM_API_HASH || "";

// Map to store active clients for multi-session support
const activeClients = new Map<number, TelegramClient>();

// Detailed logging utility
function log(level: string, phoneNumber: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] Phone: ${phoneNumber} | ${message}`;
  if (data) {
    console.log(logMessage, JSON.stringify(data, null, 2));
  } else {
    console.log(logMessage);
  }
}

export async function getTelegramClient(sessionId: number): Promise<TelegramClient | null> {
  if (activeClients.has(sessionId)) {
    return activeClients.get(sessionId)!;
  }

  const sessionData = await storage.getSession(sessionId);
  if (!sessionData || !sessionData.isActive) return null;

  const client = new TelegramClient(
    new StringSession(sessionData.sessionString),
    apiId,
    apiHash,
    { connectionRetries: 5, useWSS: false }
  );

  await client.connect();
  activeClients.set(sessionId, client);
  return client;
}

// Store pending login states with more detailed info
const pendingLogins = new Map<string, { 
  client: TelegramClient; 
  timestamp: number;
  phoneCodeHash?: string;
  phoneCode?: string;
  isVerifyingPassword?: boolean;
  phoneCodeVerified?: boolean; // Phone code accepted, waiting for password
  codeExpiryTime?: number; // Expire codes after 5 minutes
  attemptCount?: number;
  authMethod?: "start" | "password_retry"; // Track which method was last used
  passwordFailureCount?: number; // Track failed password attempts
  floodWaitUntil?: number; // Timestamp until rate limit is lifted
  passwordCallbackCount?: number; // Track password callback invocations to prevent infinite loop
}>();

// Helper function to clean up a login session
async function cleanupLoginSession(phoneNumber: string) {
  const entry = pendingLogins.get(phoneNumber);
  if (entry) {
    await entry.client.disconnect().catch(() => {});
    pendingLogins.delete(phoneNumber);
    log("INFO", phoneNumber, "Login session cleaned up");
  }
}

export async function sendCode(phoneNumber: string) {
  log("INFO", phoneNumber, "Starting sendCode request");
  
  const existing = pendingLogins.get(phoneNumber);
  if (existing) {
    // Check if currently verifying password - if so, don't disconnect
    if (existing.isVerifyingPassword || existing.phoneCodeVerified) {
      log("WARN", phoneNumber, "Password verification in progress, cannot send new code");
      throw new Error("PASSWORD_VERIFICATION_IN_PROGRESS");
    }
    
    // Reuse existing client if no password verification in progress
    log("INFO", phoneNumber, "Reusing existing client for new code request");
    try {
      const result = await existing.client.sendCode(
        { apiId, apiHash },
        phoneNumber
      );
      
      log("SUCCESS", phoneNumber, "Code sent to phone (reused client)", {
        phoneCodeHash: result.phoneCodeHash,
        type: (result as any).type,
      });
      
      const currentTime = Date.now();
      const expiryTime = currentTime + (5 * 60 * 1000);
      
      // Update existing entry with new code hash and reset state
      existing.phoneCodeHash = result.phoneCodeHash;
      existing.codeExpiryTime = expiryTime;
      existing.phoneCode = undefined;
      existing.phoneCodeVerified = undefined;
      existing.isVerifyingPassword = undefined;
      existing.attemptCount = 0;
      existing.passwordFailureCount = 0;
      existing.timestamp = currentTime;
      
      log("INFO", phoneNumber, "Pending login updated with new code", {
        timestamp: new Date(currentTime).toISOString(),
        expiryTime: new Date(expiryTime).toISOString(),
      });
      
      return result.phoneCodeHash;
    } catch (error: any) {
      log("ERROR", phoneNumber, "Failed to resend code with existing client", {
        errorMessage: error.message,
        errorCode: error.code
      });
      
      // If reuse fails, disconnect and create new client
      await existing.client.disconnect().catch(() => {});
      pendingLogins.delete(phoneNumber);
      
      // Continue to create new client below
    }
  }

  try {
    const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
      connectionRetries: 5,
      useWSS: false,
    });
    
    log("INFO", phoneNumber, "Created new TelegramClient");
    await client.connect();
    log("INFO", phoneNumber, "Client connected successfully");
    
    const result = await client.sendCode(
      { apiId, apiHash },
      phoneNumber
    );
    
    log("SUCCESS", phoneNumber, "Code sent to phone", {
      phoneCodeHash: result.phoneCodeHash,
      type: (result as any).type,
    });
    
    const currentTime = Date.now();
    const expiryTime = currentTime + (5 * 60 * 1000); // 5 minutes expiry
    
    pendingLogins.set(phoneNumber, { 
      client, 
      timestamp: currentTime,
      phoneCodeHash: result.phoneCodeHash,
      codeExpiryTime: expiryTime,
      attemptCount: 0,
      passwordFailureCount: 0,
      phoneCode: undefined,
      phoneCodeVerified: undefined,
      isVerifyingPassword: undefined
    });
    
    log("INFO", phoneNumber, "Pending login stored", {
      timestamp: new Date(currentTime).toISOString(),
      expiryTime: new Date(expiryTime).toISOString(),
      expiresIn: "5 minutes"
    });
    
    // Auto cleanup after 15 minutes
    setTimeout(async () => {
      const entry = pendingLogins.get(phoneNumber);
      if (entry && Date.now() - entry.timestamp >= 15 * 60 * 1000) {
        log("WARN", phoneNumber, "Auto-cleaning expired session (15 minutes timeout)");
        await entry.client.disconnect().catch(() => {});
        pendingLogins.delete(phoneNumber);
      }
    }, 15 * 60 * 1000);

    return result.phoneCodeHash;
  } catch (error: any) {
    log("ERROR", phoneNumber, "Failed to send code", {
      errorMessage: error.message,
      errorCode: error.code,
      stack: error.stack
    });
    throw error;
  }
}

export async function signIn(phoneNumber: string, code: string, password?: string) {
  log("INFO", phoneNumber, "Starting signIn request", { codeLength: code.length, hasPassword: !!password });
  
  const entry = pendingLogins.get(phoneNumber);
  
  if (!entry) {
    log("ERROR", phoneNumber, "No pending login entry found");
    throw new Error("SESSION_EXPIRED_OR_NOT_FOUND");
  }

  if (!entry.client) {
    log("ERROR", phoneNumber, "Pending login entry has no client");
    throw new Error("SESSION_EXPIRED_OR_NOT_FOUND");
  }

  // Check if code has expired
  if (entry.codeExpiryTime && Date.now() > entry.codeExpiryTime) {
    const expiredTime = Date.now() - entry.codeExpiryTime;
    log("ERROR", phoneNumber, "Code has expired", {
      expiredFor: `${Math.round(expiredTime / 1000)} seconds`,
      expiryTime: new Date(entry.codeExpiryTime).toISOString(),
      currentTime: new Date().toISOString()
    });
    await cleanupLoginSession(phoneNumber);
    throw new Error("CODE_EXPIRED");
  }

  const { client } = entry;
  entry.attemptCount = (entry.attemptCount || 0) + 1;
  
  log("INFO", phoneNumber, `Attempt #${entry.attemptCount} to sign in`, {
    isPasswordStep: entry.phoneCodeVerified,
    hasPassword: !!password
  });

  try {
    // If we've already verified the phone code and need a password
    if (entry.phoneCodeVerified && !password) {
      log("WARN", phoneNumber, "Password required - stopping here");
      throw new Error("PASSWORD_REQUIRED");
    }

    // If we've already verified the phone code and have a password, 
    // we should NOT call client.start() again because it re-submits the code.
    // Instead, we use the client that is already waiting at the password step.
    if (entry.phoneCodeVerified && password) {
      log("INFO", phoneNumber, "Processing password for existing session");
      // Use checkPassword for 2FA instead of client.start() again
      await (client as any).checkPassword(password);
    } else {
      entry.authMethod = "start";
      entry.passwordCallbackCount = 0;
      log("INFO", phoneNumber, "Starting fresh authentication with client.start()");
      await client.start({
        phoneNumber: async () => {
          log("INFO", phoneNumber, "phoneNumber callback invoked");
          return phoneNumber;
        },
        phoneCode: async () => {
          log("INFO", phoneNumber, "phoneCode callback invoked", { codeLength: code.length });
          return code;
        },
        password: async () => {
          entry.passwordCallbackCount = (entry.passwordCallbackCount || 0) + 1;
          log("INFO", phoneNumber, "password callback invoked", { 
            hasPassword: !!password,
            callCount: entry.passwordCallbackCount 
          });
          
          if (!password) {
            // Mark that we're now at password verification stage
            entry.isVerifyingPassword = true;
            entry.phoneCodeVerified = true;
            entry.phoneCode = code;
            log("WARN", phoneNumber, "Password required - stopping here (invocation #" + entry.passwordCallbackCount + ")");
            
            // On first invocation without password, throw to break out of the loop
            throw new Error("PASSWORD_REQUIRED");
          }
          log("INFO", phoneNumber, "password callback returning 2FA password");
          return password;
        },
        onError: (err: any) => {
          // Handle common errors gracefully within start()
          if (err.message === "PASSWORD_REQUIRED") {
            log("WARN", phoneNumber, "Breaking out of client.start() due to PASSWORD_REQUIRED");
            return;
          }
          
          log("ERROR", phoneNumber, "client.start() error callback", {
            errorMessage: err.message,
            errorCode: err.code
          });
          // We don't rethrow here to let the main try/catch handle it
        }
      });
    }
    
    log("SUCCESS", phoneNumber, "Authentication flow completed successfully");

    const sessionString = (client.session as StringSession).save();
    log("INFO", phoneNumber, "Session string generated successfully", {
      sessionStringLength: sessionString.length
    });

    // After successful sign in, disconnect the temp client
    await cleanupLoginSession(phoneNumber);
    log("SUCCESS", phoneNumber, "Authentication complete");
    
    return sessionString;
  } catch (err: any) {
    log("ERROR", phoneNumber, "signIn failed", {
      errorMessage: err.message,
      errorCode: err.code,
      attemptNumber: entry.attemptCount,
      stack: err.stack
    });

    if (err.message === "PASSWORD_REQUIRED") {
      log("INFO", phoneNumber, "Password verification required, keeping client alive for next attempt");
      // Keep the pending login entry for password retry
      throw err;
    }

    if (err.message.includes("PHONE_CODE_INVALID") || err.message === "INVALID_CODE") {
      log("ERROR", phoneNumber, "Invalid phone code provided");
      await cleanupLoginSession(phoneNumber);
      throw new Error("INVALID_CODE");
    }

    if (err.message.includes("PHONE_CODE_EXPIRED")) {
      log("ERROR", phoneNumber, "Phone code has expired");
      await cleanupLoginSession(phoneNumber);
      throw new Error("CODE_EXPIRED");
    }

    if (err.message && err.message.includes("FLOOD_WAIT")) {
      // Extract wait duration from error message if available
      let waitSeconds = 30; // default wait
      const match = err.message.match(/FLOOD_WAIT_(\d+)/i);
      if (match) {
        waitSeconds = parseInt(match[1]);
      }
      
      log("ERROR", phoneNumber, "Too many attempts, rate limit hit", {
        waitSeconds,
        retryAfter: new Date(Date.now() + waitSeconds * 1000).toISOString()
      });
      
      // Store wait time in pending login entry but keep client alive
      entry.floodWaitUntil = Date.now() + (waitSeconds * 1000);
      
      throw new Error(`RATE_LIMITED_WAIT_${waitSeconds}`);
    }

    // Password failure - track attempts but DON'T disconnect or delete
    if (err.message === "INVALID_PASSWORD" || err.message.includes("PASSWORD_INVALID")) {
      entry.passwordFailureCount = (entry.passwordFailureCount || 0) + 1;
      log("ERROR", phoneNumber, "Invalid password provided for 2FA", {
        failureCount: entry.passwordFailureCount,
        maxAttempts: 3
      });
      
      // Keep entry alive even after failures, only delete after max attempts
      if (entry.passwordFailureCount >= 3) {
        log("ERROR", phoneNumber, "Too many password failures (3/3), disconnecting");
        await cleanupLoginSession(phoneNumber);
      } else {
        log("INFO", phoneNumber, "Keeping session alive for password retry", {
          remainingAttempts: 3 - entry.passwordFailureCount
        });
      }
      
      throw new Error("INVALID_PASSWORD");
    }

    // For any other error, disconnect and clean up
    log("ERROR", phoneNumber, "Unknown error during sign in", { error: err.message });
    await cleanupLoginSession(phoneNumber);
    throw err;
  }
}

// Message forwarding listener setup
const messageListeners = new Map<number, boolean>();

export async function resolveChannelId(sessionId: number, identifier: string): Promise<string> {
  const client = await getTelegramClient(sessionId);
  if (!client) throw new Error("No active client for session");

  try {
    // 1. Handle Private Invite Links (https://t.me/joinchat/... or https://t.me/+...)
    if (identifier.includes("joinchat/") || identifier.includes("t.me/+")) {
      const hash = identifier.split("/").pop()?.replace("+", "");
      if (hash) {
        try {
          const result = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
          if (result instanceof Api.ChatInviteAlready) {
            return result.chat.id.toString();
          } else if (result instanceof Api.ChatInvite) {
            // If not joined yet, we might need to join, but for now we just try to get the ID
            // Telegram usually doesn't give the ID until joined for private links
            // So we join
            const joined = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
            if ('chats' in joined && joined.chats.length > 0) {
              return joined.chats[0].id.toString();
            }
          }
        } catch (e) {
          console.error(`[Telegram] Failed to resolve invite link: ${identifier}`, e);
        }
      }
    }

    // 2. Handle Public Links and Usernames
    const cleanIdentifier = identifier.replace("https://t.me/", "").replace("@", "");
    const entity = await client.getEntity(cleanIdentifier);
    
    // GramJS returns numeric IDs for channels that need to be prefixed with -100
    // for most API calls. Let's ensure consistent storage.
    let resolvedId = entity.id.toString();
    // For Channels and Supergroups, GramJS often returns the ID without -100 prefix in some contexts
    // but the listener event gives it with -100 (as a string or bigInt)
    // We'll store it with -100 prefix if it's a channel/megagroup
    const className = entity.className || (entity as any).constructor?.name || (entity as any)._?.replace('Api.', '') || '';
    if ((entity instanceof Api.Channel || entity instanceof Api.Chat || className === 'Channel' || className === 'Chat') && !resolvedId.startsWith("-100") && !resolvedId.startsWith("-")) {
      resolvedId = "-100" + resolvedId;
    }
    return resolvedId;
  } catch (err) {
    console.error(`[Telegram] Failed to resolve identifier ${identifier}:`, err);
    // If it looks like a numeric ID already, return it
    if (/^-?\d+$/.test(identifier)) return identifier;
    throw err;
  }
}

export async function stopMessageListener(sessionId: number) {
  if (!messageListeners.has(sessionId)) return;
  
  console.log(`[Listener] 🛑 Stopping message listener for session ${sessionId}`);
  messageListeners.delete(sessionId);
  
  const client = activeClients.get(sessionId);
  if (client) {
    // Note: GramJS doesn't have a simple way to remove all event handlers
    // but our handler checks messageListeners.has(sessionId) or isActive tasks
    // To truly stop it, we can disconnect if no other tasks need it
    // For now, removing from map is enough as our logic will skip it
  }
}

export async function startMessageListener(sessionId: number) {
  // If already listening, we might need to refresh state (re-read tasks)
  // but the current implementation already reads tasks from storage inside the handler
  if (messageListeners.has(sessionId)) {
    console.log(`[Listener] Listener already active for session ${sessionId}, picking up changes.`);
    return;
  }
  messageListeners.set(sessionId, true);

  try {
    const client = await getTelegramClient(sessionId);
    if (!client) {
      console.log(`[Listener] No active client for session ${sessionId}`);
      return;
    }

    const session = await storage.getSession(sessionId);
    if (!session) return;

    console.log(`[Listener] ✅ Starting message listener for session ${sessionId} (${session.phoneNumber})`);

// Store grouped messages (albums)
const albumBuffers = new Map<string, {
  messageIds: number[];
  timer: any;
  task: any;
  sessionId: number;
  chatId: string;
}>();

// Helper function to process albums
const processAlbum = async (groupId: string) => {
  const buffer = albumBuffers.get(groupId);
  if (!buffer) return;

  const { messageIds, task, chatId } = buffer;
  albumBuffers.delete(groupId);

  console.log(`[Listener] 📸 Processing album with ${messageIds.length} items for task ${task.id}`);

  try {
    const { forwarder } = await import("./forwarder");
    await forwarder.forwardAlbum(
      task,
      messageIds,
      chatId
    );
    console.log(`[Listener] ✅ Album forwarded successfully`);
  } catch (err) {
    console.error(`[Listener] ❌ Error forwarding album:`, err);
  }
};

// Listen for new messages using the proper event handler
client.addEventHandler(async (event: any) => {
  try {
    // Check if this is a new message event
    if (event.message) {
      const message = event.message;
      
      // Try multiple ways to get the chat ID
      const chatIdRaw = event.chatId || 
                        message.peerId?.channelId ||
                        message.peerId?.userId ||
                        message.peerId;
      
      if (!chatIdRaw) {
        console.log(`[Listener] ⚠️ Could not determine chat ID from event`);
        return;
      }

      const chatId = chatIdRaw.toString();
      
      // Standardize chatId for comparison
      const cleanChatId = chatId.replace(/^-100/, "");
      console.log(`[Listener] 📩 Received message from chat ${chatId} (Clean: ${cleanChatId})`);

      // Get active tasks
      const tasks = await storage.getTasks();
      const sessionTasks = tasks.filter(t => t.sessionId === sessionId && t.isActive);
      
      if (sessionTasks.length === 0) {
        console.log(`[Listener] ⚠️ No active tasks for session ${sessionId}, skipping.`);
        return;
      }

      // Check each task
      for (const task of sessionTasks) {
        // جلب أحدث بيانات المهمة من قاعدة البيانات لضمان استخدام الفلاتر المحدثة
        const currentTask = await storage.getTask(task.id);
        if (!currentTask || !currentTask.isActive) continue;

        console.log(`[Listener] Checking task ${currentTask.id} against sources: ${currentTask.sourceChannels.join(', ')}`);

        const matchesChannel = currentTask.sourceChannels.some(sourceId => {
          const cleanSourceId = sourceId.toString().replace(/^-100/, "");
          const isMatch = cleanSourceId === cleanChatId;
          if (isMatch) console.log(`[Listener] ✅ Match found for Task ${currentTask.id}: Source ${cleanSourceId} === Chat ${cleanChatId}`);
          return isMatch;
        });

        if (!matchesChannel) {
          continue;
        }

        // Handle Grouped Media (Albums)
        if (message.groupedId) {
          const groupId = message.groupedId.toString();
          const buffer = albumBuffers.get(groupId);

          if (buffer) {
            buffer.messageIds.push(message.id);
            // Reset timer - wait longer for all parts to arrive (5 seconds)
            if (buffer.timer) clearTimeout(buffer.timer);
            buffer.timer = setTimeout(() => processAlbum(groupId), 5000);
          } else {
            // First item of the album
            const timer = setTimeout(() => processAlbum(groupId), 5000);
            albumBuffers.set(groupId, {
              messageIds: [message.id],
              timer,
              task: currentTask,
              sessionId,
              chatId
            });
          }
          continue; // Don't process individual album parts yet
        }

        console.log(`[Listener] ✅ Task ${currentTask.id} matched! Processing message from ${chatId}`);

        // IN CHANNELS, THE TEXT IS OFTEN IN message.message
        const messageText = message.message || message.text || "";
        
        // Detect media type for filtering
        let mediaType = "text";
        if (message.photo) mediaType = "photo";
        else if (message.video) mediaType = "video";
        else if (message.document) mediaType = "document";
        else if (message.audio) mediaType = "audio";
        else if (message.voice) mediaType = "voice";
        else if (message.sticker) mediaType = "sticker";
        else if (message.videoNote) mediaType = "videoNote";
        else if (message.gif || message.animation) mediaType = "animation";
        else if (message.poll) mediaType = "poll";
        else if (message.contact) mediaType = "contact";
        else if (message.location) mediaType = "location";
        else if (message.invoice) mediaType = "invoice";

        // Forward message to destinations using the most reliable method
        try {
          const { forwarder } = await import("./forwarder");
          console.log(`[Forwarder] 🚀 Checking filters for task ${currentTask.id} with content: ${messageText.substring(0, 50)}...`);
          
          await forwarder.forwardMessage(
            currentTask,
            message.id?.toString() || `msg_${Date.now()}`,
            messageText,
            { 
              originalMessageId: message.id,
              originalText: messageText,
              hasMedia: !!message.media,
              type: mediaType,
              entities: message.entities,
              rawMessage: message,
              fromChatId: chatId
            }
          );
          console.log(`[Forwarder] ✅ Message processing completed for task ${currentTask.id}`);
        } catch (err) {
          console.error(`[Forwarder] ❌ Error forwarding message via task ${currentTask.id}:`, err);
        }
      }
    }
  } catch (err) {
    console.error(`[Listener] ❌ Error processing message event:`, err);
  }
});

    console.log(`[Listener] ✅ Message listener registered successfully for session ${sessionId}`);
  } catch (err) {
    console.error(`[Listener] ❌ Error starting message listener for session ${sessionId}:`, err);
  }
}

export async function startAllMessageListeners() {
  console.log("[Listener] Starting all message listeners for active sessions");
  const sessions = await storage.getSessions();
  const tasks = await storage.getTasks();
  
  console.log(`[Listener] Debug: Found ${sessions.length} sessions and ${tasks.length} tasks.`);
  sessions.forEach(s => console.log(`[Listener] Debug Session: ID=${s.id}, Name=${s.sessionName}, Active=${s.isActive}`));
  tasks.forEach(t => console.log(`[Listener] Debug Task: ID=${t.id}, Name=${t.name}, SessionID=${t.sessionId}, Active=${t.isActive}`));

  // Get unique session IDs that have at least one active task
  const activeTaskSessionIds = new Set(
    tasks.filter(t => t.isActive).map(t => t.sessionId)
  );

  const activeSessions = sessions.filter(s => s.isActive && activeTaskSessionIds.has(s.id));

  if (activeSessions.length === 0) {
    console.log("[Listener] No active sessions with active tasks found.");
    return;
  }

  console.log(`[Listener] Found ${activeSessions.length} active sessions to start.`);

  for (const session of activeSessions) {
    try {
      await startMessageListener(session.id);
    } catch (err) {
      console.error(`[Listener] Failed to start listener for session ${session.id}:`, err);
    }
  }
}
