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

  // gramjs doesn't automatically subscribe to updates for large channels
  // unless they are explicitly "viewed" or interacted with.
  try {
    await client.getMe();
    // Added: Invoke getDialogs to force update subscription for large channels
    await client.getDialogs({ limit: 100 });
    console.log(`[Telegram] ✅ Connection stabilized and dialogs fetched for session ${sessionId}`);
  } catch (e) {
    console.warn(`[Telegram] ⚠️ Connection stabilization failed for session ${sessionId}:`, (e as Error).message);
  }

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
    if (existing.isVerifyingPassword || existing.phoneCodeVerified) {
      log("WARN", phoneNumber, "Password verification in progress, cannot send new code");
      throw new Error("PASSWORD_VERIFICATION_IN_PROGRESS");
    }
    
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
      
      existing.phoneCodeHash = result.phoneCodeHash;
      existing.codeExpiryTime = expiryTime;
      existing.phoneCode = undefined;
      existing.phoneCodeVerified = undefined;
      existing.isVerifyingPassword = undefined;
      existing.attemptCount = 0;
      existing.passwordFailureCount = 0;
      existing.timestamp = currentTime;
      
      return result.phoneCodeHash;
    } catch (error: any) {
      log("ERROR", phoneNumber, "Failed to resend code with existing client", {
        errorMessage: error.message,
        errorCode: error.code
      });
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
    const result = await client.sendCode(
      { apiId, apiHash },
      phoneNumber
    );
    
    const currentTime = Date.now();
    const expiryTime = currentTime + (5 * 60 * 1000);
    
    pendingLogins.set(phoneNumber, { 
      client, 
      timestamp: currentTime,
      phoneCodeHash: result.phoneCodeHash,
      codeExpiryTime: expiryTime,
      attemptCount: 0,
      passwordFailureCount: 0
    });
    
    setTimeout(async () => {
      const entry = pendingLogins.get(phoneNumber);
      if (entry && Date.now() - entry.timestamp >= 15 * 60 * 1000) {
        await entry.client.disconnect().catch(() => {});
        pendingLogins.delete(phoneNumber);
      }
    }, 15 * 60 * 1000);

    return result.phoneCodeHash;
  } catch (error: any) {
    log("ERROR", phoneNumber, "Failed to send code", { errorMessage: error.message });
    throw error;
  }
}

export async function signIn(phoneNumber: string, code: string, password?: string) {
  const entry = pendingLogins.get(phoneNumber);
  if (!entry) throw new Error("SESSION_EXPIRED_OR_NOT_FOUND");

  const { client } = entry;
  entry.attemptCount = (entry.attemptCount || 0) + 1;
  
  try {
    if (entry.phoneCodeVerified && password) {
      await (client as any).checkPassword(password);
    } else {
      await client.start({
        phoneNumber: async () => phoneNumber,
        phoneCode: async () => code,
        password: async () => {
          if (!password) {
            entry.isVerifyingPassword = true;
            entry.phoneCodeVerified = true;
            throw new Error("PASSWORD_REQUIRED");
          }
          return password;
        },
        onError: (err: any) => {
          if (err.message === "PASSWORD_REQUIRED") return;
          log("ERROR", phoneNumber, "client.start() error", { message: err.message });
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
        try {
          const result = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
          if (result instanceof Api.ChatInviteAlready) {
            return result.chat.id.toString();
          } else if (result instanceof Api.ChatInvite) {
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
    const className = entity.className || (entity as any).constructor?.name || (entity as any)._?.replace('Api.', '') || '';
    if ((entity instanceof Api.Channel || entity instanceof Api.Chat || className === 'Channel' || className === 'Chat') && !resolvedId.startsWith("-100") && !resolvedId.startsWith("-")) {
      resolvedId = "-100" + resolvedId;
    }
    return resolvedId;
  } catch (err) {
    if (/^-?\d+$/.test(identifier)) return identifier;
    throw err;
  }
}

export async function fetchLastMessages(taskId: number, channelIds: string[]) {
  try {
    const task = await storage.getTask(taskId);
    if (!task) throw new Error("Task not found");

    const client = await getTelegramClient(task.sessionId);
    if (!client) throw new Error("No active client for session");

    for (const channelId of channelIds) {
      try {
        const entity = await client.getEntity(channelId);
        const messages = await client.getMessages(entity, { limit: 5 });
        for (const msg of messages) {
          await processIncomingMessage(task, msg, channelId, client);
        }
      } catch (e) {
        console.error(`[Telegram] ❌ Failed to fetch from ${channelId}:`, (e as Error).message);
      }
    }
  } catch (err) {
    console.error(`[Telegram] Error in manual fetch:`, err);
  }
}

async function processIncomingMessage(task: any, message: any, chatId: string, client: TelegramClient) {
  try {
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
    for (const destination of task.destinationChannels) {
      await forwarder.forwardMessage(
        task,
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
    console.error(`[Listener] ❌ Error in processIncomingMessage:`, err);
  }
}

export async function stopMessageListener(sessionId: number) {
  messageListeners.delete(sessionId);
}

export async function startMessageListener(sessionId: number) {
  if (messageListeners.has(sessionId)) return;
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
      try {
        const { forwarder } = await import("./forwarder");
        await forwarder.forwardAlbum(task, messageIds, chatId);
      } catch (err) {
        console.error(`[Listener] ❌ Error forwarding album:`, err);
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

        const tasks = await storage.getTasks();
        const sessionTasks = tasks.filter(t => t.sessionId === sessionId && t.isActive);

        for (const task of sessionTasks) {
          const sourceChannels = (task.sourceChannels || []).map(s => s.replace(/^-100/, "").replace(/^-/, ""));
          
          if (sourceChannels.includes(cleanChatId)) {
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
          }
        }
      } catch (err) {
        console.error(`[Listener] ❌ Error processing message event:`, err);
      }
    });
  } catch (err) {
    console.error(`[Listener] ❌ Error starting message listener for session ${sessionId}:`, err);
  }
}

export async function startAllMessageListeners() {
  const sessions = await storage.getSessions();
  const tasks = await storage.getTasks();
  const activeTaskSessionIds = new Set(tasks.filter(t => t.isActive).map(t => t.sessionId));
  const activeSessions = sessions.filter(s => s.isActive && activeTaskSessionIds.has(s.id));

  for (const session of activeSessions) {
    try {
      await startMessageListener(session.id);
    } catch (err) {
      console.error(`[Listener] Failed to start listener for session ${session.id}:`, err);
    }
  }
}
