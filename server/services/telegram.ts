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

// Global store to keep clients alive across API calls
// key is phoneNumber, value is { client: TelegramClient, timestamp: number }
const pendingClients = new Map<string, { client: TelegramClient; timestamp: number }>();

export async function sendCode(phoneNumber: string) {
  // If there's already a pending client for this number, disconnect it first
  if (pendingClients.has(phoneNumber)) {
    const old = pendingClients.get(phoneNumber);
    await old?.client.disconnect();
    pendingClients.delete(phoneNumber);
  }

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
    useWSS: false,
  });
  
  await client.connect();
  
  const { phoneCodeHash } = await client.sendCode(
    { apiId, apiHash },
    phoneNumber
  );
  
  // Keep the client alive in memory
  pendingClients.set(phoneNumber, { client, timestamp: Date.now() });
  
  // Cleanup logic (15 minutes expiry)
  setTimeout(async () => {
    const entry = pendingClients.get(phoneNumber);
    if (entry && Date.now() - entry.timestamp >= 15 * 60 * 1000) {
      await entry.client.disconnect();
      pendingClients.delete(phoneNumber);
    }
  }, 15 * 60 * 1000);

  return phoneCodeHash;
}

export async function signIn(phoneNumber: string, phoneCodeHash: string, code: string, password?: string) {
  const entry = pendingClients.get(phoneNumber);
  
  if (!entry || !entry.client) {
    throw new Error("SESSION_EXPIRED_OR_NOT_FOUND");
  }

  const client = entry.client;

  try {
    // Check if 2FA is needed based on state or previous attempt
    if (password) {
        await (client as any).signIn({
            phoneNumber,
            phoneCodeHash,
            phoneCode: code,
            password: async () => password,
            onError: (err: any) => {
                throw err;
            }
        });
    } else {
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
             throw new Error("PASSWORD_REQUIRED");
          } else {
            throw err;
          }
        }
    }

    // Success! Save the session
    const sessionString = (client.session as StringSession).save();
    
    await client.disconnect();
    pendingClients.delete(phoneNumber);
    
    return sessionString;
  } catch (err: any) {
    if (err.message === "PASSWORD_REQUIRED") {
      // Don't disconnect, we need this client for the next request
      throw err;
    }
    
    // For other errors, cleanup
    await client.disconnect();
    pendingClients.delete(phoneNumber);
    throw new Error(err.message || "Failed to sign in");
  }
}
