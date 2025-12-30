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

// Temporary storage for clients during the login process to keep the connection alive
const pendingClients = new Map<string, TelegramClient>();

export async function sendCode(phoneNumber: string) {
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
    useWSS: false,
  });
  await client.connect();
  const { phoneCodeHash } = await client.sendCode(
    { apiId, apiHash },
    phoneNumber
  );
  
  // Store the client using the phone number as key
  pendingClients.set(phoneNumber, client);
  
  // Cleanup old pending clients (older than 15 minutes)
  setTimeout(() => {
    if (pendingClients.has(phoneNumber)) {
      const c = pendingClients.get(phoneNumber);
      c?.disconnect();
      pendingClients.delete(phoneNumber);
    }
  }, 15 * 60 * 1000);

  return phoneCodeHash;
}

export async function signIn(phoneNumber: string, phoneCodeHash: string, code: string, password?: string) {
  const client = pendingClients.get(phoneNumber);
  
  if (!client) {
    throw new Error("SESSION_EXPIRED_OR_NOT_FOUND");
  }

  try {
    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash,
          phoneCode: code,
        })
      );
    } catch (err: any) {
      if (err.message.includes("SESSION_PASSWORD_NEEDED")) {
        if (!password) {
          throw new Error("PASSWORD_REQUIRED");
        }
        await client.signIn({
          password: async () => password,
        } as any);
      } else {
        throw err;
      }
    }

    const sessionString = (client.session as StringSession).save();
    // After successful login, we can remove it from pending and potentially move to active
    pendingClients.delete(phoneNumber);
    return sessionString;
  } catch (err: any) {
    if (err.message === "PASSWORD_REQUIRED") throw err;
    throw new Error(err.message || "Failed to sign in");
  }
}
