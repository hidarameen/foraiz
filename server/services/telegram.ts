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
    { connectionRetries: 5 }
  );

  await client.connect();
  activeClients.set(sessionId, client);
  return client;
}

export async function sendCode(phoneNumber: string) {
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.connect();
  const { phoneCodeHash } = await client.sendCode(
    { apiId, apiHash },
    phoneNumber
  );
  // We don't store the client here because we need the code to finish sign in
  // The client will be recreated with the string session later
  await client.disconnect();
  return phoneCodeHash;
}

export async function signIn(phoneNumber: string, phoneCodeHash: string, code: string, password?: string) {
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.connect();

  try {
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode: code,
      })
    );

    const sessionString = (client.session as StringSession).save();
    return sessionString;
  } catch (err: any) {
    if (err.message.includes("SESSION_PASSWORD_NEEDED")) {
      if (!password) {
        throw new Error("PASSWORD_REQUIRED");
      }
      await client.signIn({
        password: async () => password,
      } as any);
      const sessionString = (client.session as StringSession).save();
      return sessionString;
    }
    throw new Error(err.message || "Failed to sign in");
  } finally {
    await client.disconnect();
  }
}
