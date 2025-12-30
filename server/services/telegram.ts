import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { storage } from "../storage";

const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
const apiHash = process.env.TELEGRAM_API_HASH || "";

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

const pendingClients = new Map<string, { client: TelegramClient; timestamp: number }>();

export async function sendCode(phoneNumber: string) {
  if (pendingClients.has(phoneNumber)) {
    const old = pendingClients.get(phoneNumber);
    await old?.client.disconnect();
    pendingClients.delete(phoneNumber);
  }

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
    useWSS: false,
    testMode: false
  });
  
  await client.connect();
  
  const result = await client.sendCode(
    { apiId, apiHash },
    phoneNumber
  );
  
  pendingClients.set(phoneNumber, { client, timestamp: Date.now() });
  
  setTimeout(async () => {
    const entry = pendingClients.get(phoneNumber);
    if (entry && Date.now() - entry.timestamp >= 15 * 60 * 1000) {
      await entry.client.disconnect();
      pendingClients.delete(phoneNumber);
    }
  }, 15 * 60 * 1000);

  return result.phoneCodeHash;
}

export async function signIn(phoneNumber: string, code: string, password?: string) {
  const entry = pendingClients.get(phoneNumber);
  if (!entry || !entry.client) {
    throw new Error("SESSION_EXPIRED_OR_NOT_FOUND");
  }

  const client = entry.client;

  try {
    await client.start({
      phoneNumber: () => Promise.resolve(phoneNumber),
      password: () => {
        if (!password) return Promise.reject(new Error("PASSWORD_REQUIRED"));
        return Promise.resolve(password);
      },
      phoneCode: () => Promise.resolve(code),
      onError: (err) => {
        if (err.message.includes("SESSION_PASSWORD_NEEDED") || err.message.includes("Password is empty") || err.message.includes("password is required")) {
          throw new Error("PASSWORD_REQUIRED");
        }
        throw err;
      }
    });

    const sessionString = (client.session as StringSession).save();
    await client.disconnect();
    pendingClients.delete(phoneNumber);
    return sessionString;
  } catch (err: any) {
    if (err.message === "PASSWORD_REQUIRED") throw err;
    await client.disconnect();
    pendingClients.delete(phoneNumber);
    throw err;
  }
}
