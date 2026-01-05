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

  try {
    await client.connect();
    activeClients.set(sessionId, client);
    await client.getMe();
    // Force subscription to large channel updates
    await client.getDialogs({ limit: 100 });
    console.log(`[Telegram] ✅ Connection stabilized and dialogs fetched for session ${sessionId}`);
  } catch (e: any) {
    console.error(`[Telegram] ❌ Critical failure for session ${sessionId}:`, e.message);
    if (e.message.includes("AUTH_KEY_DUPLICATED") || e.message.includes("SESSION_REVOKED") || e.message.includes("SESSION_EXPIRED")) {
       console.error(`[Telegram] ⚠️ Session ${sessionId} is invalid. Deleting session and linked tasks.`);
       await storage.deleteSession(sessionId).catch(console.error);
    }
    activeClients.delete(sessionId);
    return null;
  }

  return client;
}

// Store pending login states
const pendingLogins = new Map<string, { 
  client: TelegramClient; 
  timestamp: number;
  phoneCodeHash?: string;
  phoneCode?: string;
  isVerifyingPassword?: boolean;
  phoneCodeVerified?: boolean;
  codeExpiryTime?: number;
  attemptCount?: number;
  authMethod?: "start" | "password_retry";
  passwordFailureCount?: number;
  floodWaitUntil?: number;
  passwordCallbackCount?: number;
}>();

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
    if (existing.isVerifyingPassword || existing.phoneCodeVerified) {
      log("WARN", phoneNumber, "Password verification in progress, cannot send new code");
      throw new Error("PASSWORD_VERIFICATION_IN_PROGRESS");
    }
    
    log("INFO", phoneNumber, "Reusing existing client for new code request");
    try {
      const result = await existing.client.sendCode({ apiId, apiHash }, phoneNumber);
      existing.phoneCodeHash = result.phoneCodeHash;
      existing.codeExpiryTime = Date.now() + (5 * 60 * 1000);
      return result.phoneCodeHash;
    } catch (error: any) {
      await existing.client.disconnect().catch(() => {});
      pendingLogins.delete(phoneNumber);
    }
  }

  try {
    const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
      connectionRetries: 5,
      useWSS: false,
    });
    
    await client.connect();
    const result = await client.sendCode({ apiId, apiHash }, phoneNumber);
    
    pendingLogins.set(phoneNumber, { 
      client, 
      timestamp: Date.now(),
      phoneCodeHash: result.phoneCodeHash,
      codeExpiryTime: Date.now() + (5 * 60 * 1000),
      attemptCount: 0,
      passwordFailureCount: 0
    });
    
    return result.phoneCodeHash;
  } catch (error: any) {
    throw error;
  }
}

export async function signIn(phoneNumber: string, code: string, password?: string) {
  const entry = pendingLogins.get(phoneNumber);
  if (!entry) throw new Error("SESSION_EXPIRED_OR_NOT_FOUND");

  const { client } = entry;
  try {
    if (entry.phoneCodeVerified && password) {
      await (client as any).checkPassword(password);
    } else {
      await client.start({
        phoneNumber: async () => phoneNumber,
        phoneCode: async () => code,
        password: async () => {
          if (!password) {
            entry.phoneCodeVerified = true;
            throw new Error("PASSWORD_REQUIRED");
          }
          return password;
        },
        onError: (err: any) => {
          if (err.message === "PASSWORD_REQUIRED") return;
        }
      });
    }
    
    const sessionString = (client.session as StringSession).save();
    await cleanupLoginSession(phoneNumber);
    return sessionString;
  } catch (err: any) {
    if (err.message === "PASSWORD_REQUIRED") throw err;
    await cleanupLoginSession(phoneNumber);
    throw err;
  }
}

const messageListeners = new Map<number, boolean>();

export async function resolveChannelId(sessionId: number, identifier: string): Promise<string> {
  const client = await getTelegramClient(sessionId);
  if (!client) throw new Error("No active client for session");

  try {
    if (identifier.includes("joinchat/") || identifier.includes("t.me/+")) {
      const hash = identifier.split("/").pop()?.replace("+", "");
      if (hash) {
        const result = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
        if (result instanceof Api.ChatInviteAlready) {
          return result.chat.id.toString();
        } else if (result instanceof Api.ChatInvite) {
          const joined = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
          if ('chats' in joined && joined.chats.length > 0) {
            return joined.chats[0].id.toString();
          }
        }
      }
    }

    const cleanIdentifier = identifier.replace("https://t.me/", "").replace("@", "");
    if (/^-?\d+$/.test(cleanIdentifier)) {
      let resolvedId = cleanIdentifier;
      if (resolvedId.length > 5 && !resolvedId.startsWith("-100") && !resolvedId.startsWith("-")) {
        resolvedId = "-100" + resolvedId;
      }
      return resolvedId;
    }

    const entity = await client.getEntity(cleanIdentifier);
    let resolvedId = entity.id.toString();
    const className = (entity as any).className || (entity as any).constructor?.name || '';
    if ((entity instanceof Api.Channel || entity instanceof Api.Chat || className.includes('Channel')) && !resolvedId.startsWith("-100") && !resolvedId.startsWith("-")) {
      resolvedId = "-100" + resolvedId;
    }
    return resolvedId;
  } catch (err) {
    if (/^-?\d+$/.test(identifier)) return identifier;
    throw err;
  }
}

// Track the application start time for polling filters
const appStartTime = Math.floor(Date.now() / 1000);
// Cache for processed message IDs to prevent duplicates
// Using a Map of messageKey -> timestamp to allow for TTL-like cleanup
const processedMessages = new Map<string, number>();
const processingLocks = new Set<string>();

// Track task versions to detect changes and prevent stale processing
const taskVersions = new Map<number, number>();

function getTaskKey(taskId: number, messageId: any, chatId: string): string {
  const version = taskVersions.get(taskId) || 0;
  return `${taskId}_v${version}_${chatId.replace(/^-100/, "").replace(/^-/, "")}_${messageId}`;
}

export async function fetchLastMessages(taskId: number, channelIds: string[]) {
  try {
    const task = await storage.getTask(taskId);
    if (!task) return;

    // Update version if needed
    const currentVersion = taskVersions.get(taskId) || 0;
    const dbVersion = task.updatedAt ? new Date(task.updatedAt).getTime() : 0;
    if (dbVersion > currentVersion) {
      taskVersions.set(taskId, dbVersion);
      console.log(`[Telegram] [Version] Task ${taskId} updated to version ${dbVersion}`);
    }

    const client = await getTelegramClient(task.sessionId);
    if (!client) return;

    for (const channelId of channelIds) {
      try {
        const sId = channelId.toString().trim();
        const cleanSId = sId.replace(/^-100/, "").replace(/^-/, "");
        let entity;
        try {
          entity = await client.getEntity(sId);
        } catch (e) {
          entity = sId;
        }

        const messages = await client.getMessages(entity, { limit: 5 });
        
        for (const msg of messages) {
          const messageKey = getTaskKey(taskId, msg.id, sId);
          
          // Check if already processed OR currently being processed
          if (processedMessages.has(messageKey) || processingLocks.has(messageKey)) {
            continue;
          }

          // Only process messages published after start
          if (msg.date >= appStartTime) {
            console.log(`[Telegram] [Polling] 🔍 Message ID ${msg.id} for task ${taskId} NOT FOUND in Updates - Processing via POLLING`);
            processingLocks.add(messageKey);
            processedMessages.set(messageKey, Date.now());
            
            try {
              // Keep the cache manageable
              if (processedMessages.size > 10000) {
                const oldestKey = processedMessages.keys().next().value;
                if (oldestKey) processedMessages.delete(oldestKey);
              }
              
              await processIncomingMessage(task, msg, sId, client);
            } finally {
              processingLocks.delete(messageKey);
            }
          }
        }
      } catch (e) {
        console.error(`[Telegram] ❌ Manual fetch failed for channel ${channelId}:`, (e as Error).message);
      }
    }
  } catch (err) {
    console.error(`[Telegram] ❌ Manual fetch fatal error:`, err);
  }
}

async function processIncomingMessage(task: any, message: any, chatId: string, client: TelegramClient) {
  try {
    // Re-verify task is still active and valid before processing
    const currentTask = await storage.getTask(task.id);
    if (!currentTask || !currentTask.isActive) return;

    const messageText = message.message || message.text || "";
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
    
    const { forwarder } = await import("./forwarder");
    for (const destination of currentTask.destinationChannels) {
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
    }
  } catch (err) {
    console.error(`[Listener] Error in processIncomingMessage:`, err);
  }
}

export async function stopMessageListener(sessionId: number) {
  messageListeners.delete(sessionId);
}

export async function startMessageListener(sessionId: number) {
  if (messageListeners.has(sessionId)) {
    console.log(`[Telegram] [Session ${sessionId}] 🛡️ Listener already active, skipping start`);
    return;
  }
  console.log(`[Telegram] [Session ${sessionId}] 🚀 Starting message listener (Updates + Polling)`);
  messageListeners.set(sessionId, true);

  try {
    const client = await getTelegramClient(sessionId);
    if (!client) return;

    const albumBuffers = new Map<string, {
      messageIds: number[];
      timer: any;
      task: any;
      sessionId: number;
      chatId: string;
    }>();

    const processAlbum = async (groupId: string) => {
      const buffer = albumBuffers.get(groupId);
      if (!buffer) return;
      const { messageIds, task, chatId } = buffer;
      albumBuffers.delete(groupId);
      
      // Use versioned key for albums too
      const albumKey = `album_${getTaskKey(task.id, groupId, chatId)}`;
      if (processedMessages.has(albumKey)) {
        console.log(`[Telegram] [Album] ⏩ Album ${groupId} for task ${task.id} already processed, skipping`);
        return;
      }
      processedMessages.set(albumKey, Date.now());

      try {
        const { forwarder } = await import("./forwarder");
        await forwarder.forwardAlbum(task, messageIds, chatId);
      } catch (err) {
        console.error(`[Listener] Album forward error:`, err);
      }
    };

    client.addEventHandler(async (event: any) => {
      try {
        if (!event.message) return;
        const message = event.message;
        const chatIdRaw = event.chatId || message.peerId?.channelId || message.peerId?.userId || message.peerId;
        if (!chatIdRaw) return;

        const chatId = chatIdRaw.toString();
        const cleanChatId = chatId.replace(/^-100/, "").replace(/^-/, "");

        // Only fetch tasks for THIS session to avoid cross-session processing
        const allTasks = await storage.getTasks();
        const sessionTasks = allTasks.filter(t => t.sessionId === sessionId && t.isActive);

        for (const task of sessionTasks) {
          // Sync version
          const dbVersion = task.updatedAt ? new Date(task.updatedAt).getTime() : 0;
          if (dbVersion > (taskVersions.get(task.id) || 0)) {
            taskVersions.set(task.id, dbVersion);
          }

          const sourceChannels = (task.sourceChannels || []).map(s => s.replace(/^-100/, "").replace(/^-/, ""));
          
          if (sourceChannels.includes(cleanChatId)) {
            const messageKey = getTaskKey(task.id, message.id, chatId);
            
            // Check if already processed OR currently being processed
            if (processedMessages.has(messageKey) || processingLocks.has(messageKey)) {
              console.log(`[Telegram] [Session ${sessionId}] [Updates] ⏩ Message ID ${message.id} for task ${task.id} already processed or in progress, skipping`);
              continue;
            }

            // Lock and mark as processed immediately
            processingLocks.add(messageKey);
            processedMessages.set(messageKey, Date.now());
            console.log(`[Telegram] [Session ${sessionId}] [Updates] 🚀 Message ID ${message.id} for task ${task.id} received via UPDATES`);

            try {
              if (message.groupedId) {
                const groupId = message.groupedId.toString();
                const existingBuffer = albumBuffers.get(groupId);
                if (existingBuffer) {
                  clearTimeout(existingBuffer.timer);
                  existingBuffer.messageIds.push(message.id);
                  existingBuffer.timer = setTimeout(() => processAlbum(groupId), 3000);
                } else {
                  albumBuffers.set(groupId, {
                    messageIds: [message.id],
                    timer: setTimeout(() => processAlbum(groupId), 3000),
                    task,
                    sessionId,
                    chatId
                  });
                }
                continue;
              }

              await processIncomingMessage(task, message, chatId, client);
            } finally {
              processingLocks.delete(messageKey);
            }
          }
        }
      } catch (err) {
        console.error(`[Telegram] [Session ${sessionId}] [Listener] Message event error:`, err);
      }
    });

    const pollingInterval = setInterval(async () => {
      if (!messageListeners.has(sessionId)) {
        clearInterval(pollingInterval);
        return;
      }
      
      try {
        const tasks = await storage.getTasks();
        // filter tasks for this session that are active
        const sessionTasks = tasks.filter(t => t.isActive && t.sessionId === sessionId);
        
        for (const task of sessionTasks) {
          if (task.sourceChannels && task.sourceChannels.length > 0) {
            console.log(`[Polling] [Session ${sessionId}] 🔄 Fallback fetch for task ${task.id} (${task.name})`);
            // Standardize channel IDs for polling
            const standardizedChannels = task.sourceChannels.map(id => {
              const sId = id.toString().trim();
              if (/^\d+$/.test(sId) && sId.length > 5 && !sId.startsWith("-100") && !sId.startsWith("-")) {
                return "-100" + sId;
              }
              return sId;
            });
            await fetchLastMessages(task.id, standardizedChannels);
          }
        }
      } catch (err) {
        console.error(`[Polling] Error for session ${sessionId}:`, err);
      }
    }, 15000); // Poll every 15 seconds to give Updates time to arrive

  } catch (err) {
    console.error(`[Listener] Listener start error for session ${sessionId}:`, err);
  }
}

export async function startAllMessageListeners() {
  const sessions = await storage.getSessions();
  const tasks = await storage.getTasks();
  
  // Create a unique set of session IDs that have at least one active task
  const activeTaskSessionIds = new Set(
    tasks
      .filter(t => t.isActive)
      .map(t => t.sessionId)
  );
  
  const activeSessions = sessions.filter(s => s.isActive && activeTaskSessionIds.has(s.id));

  console.log(`[Telegram] [Startup] 🚀 Initializing listeners for ${activeSessions.length} active sessions`);
  for (const session of activeSessions) {
    try {
      await startMessageListener(session.id);
    } catch (err) {
      console.error(`[Listener] Failed to start for session ${session.id}:`, err);
    }
  }
}
