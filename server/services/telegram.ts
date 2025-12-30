import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { storage } from "../storage";

const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
const apiHash = process.env.TELEGRAM_API_HASH || "";

// Map to store active clients for multi-session support
const activeClients = new Map<number, TelegramClient>();

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

// Store pending login states
const pendingLogins = new Map<string, { 
  client: TelegramClient; 
  timestamp: number;
  phoneCodeHash?: string;
  phoneCode?: string;
  isVerifyingPassword?: boolean;
}>();

export async function sendCode(phoneNumber: string) {
  const existing = pendingLogins.get(phoneNumber);
  if (existing) {
    await existing.client.disconnect().catch(() => {});
    pendingLogins.delete(phoneNumber);
  }

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
    useWSS: false,
  });
  
  await client.connect();
  
  const result = await client.sendCode(
    { apiId, apiHash },
    phoneNumber
  );
  
  pendingLogins.set(phoneNumber, { 
    client, 
    timestamp: Date.now(),
    phoneCodeHash: result.phoneCodeHash 
  });
  
  setTimeout(async () => {
    const entry = pendingLogins.get(phoneNumber);
    if (entry && Date.now() - entry.timestamp >= 15 * 60 * 1000) {
      await entry.client.disconnect().catch(() => {});
      pendingLogins.delete(phoneNumber);
    }
  }, 15 * 60 * 1000);

  return result.phoneCodeHash;
}

export async function signIn(phoneNumber: string, code: string, password?: string) {
  const entry = pendingLogins.get(phoneNumber);
  if (!entry || !entry.client) {
    throw new Error("SESSION_EXPIRED_OR_NOT_FOUND");
  }

  const { client } = entry;

  try {
    // Use client.start() as it's the most reliable way to handle the full flow including SRP for 2FA
    await client.start({
      phoneNumber: async () => phoneNumber,
      phoneCode: async () => code,
      password: async () => {
        if (!password) {
          entry.isVerifyingPassword = true;
          entry.phoneCode = code;
          throw new Error("PASSWORD_REQUIRED");
        }
        return password;
      },
      onError: (err: any) => {
        if (err.message.includes("SESSION_PASSWORD_NEEDED")) {
          entry.isVerifyingPassword = true;
          entry.phoneCode = code;
          throw new Error("PASSWORD_REQUIRED");
        }
        throw err;
      }
    });

    const sessionString = (client.session as StringSession).save();
    // After successful sign in, we don't disconnect if we want to use it, 
    // but for the sake of the session manager, we'll save it and close the current temp client
    await client.disconnect().catch(() => {});
    pendingLogins.delete(phoneNumber);
    return sessionString;
  } catch (err: any) {
    if (err.message === "PASSWORD_REQUIRED") {
      throw err;
    }
    await client.disconnect().catch(() => {});
    pendingLogins.delete(phoneNumber);
    throw err;
  }
}
