import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { storage } from "../storage";

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
}>();

export async function sendCode(phoneNumber: string) {
  log("INFO", phoneNumber, "Starting sendCode request");
  
  const existing = pendingLogins.get(phoneNumber);
  if (existing) {
    log("WARN", phoneNumber, "Existing pending login found, disconnecting old client");
    await existing.client.disconnect().catch(() => {});
    pendingLogins.delete(phoneNumber);
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
      type: result.type,
    });
    
    const currentTime = Date.now();
    const expiryTime = currentTime + (5 * 60 * 1000); // 5 minutes expiry
    
    pendingLogins.set(phoneNumber, { 
      client, 
      timestamp: currentTime,
      phoneCodeHash: result.phoneCodeHash,
      codeExpiryTime: expiryTime,
      attemptCount: 0,
      passwordFailureCount: 0
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
    await entry.client.disconnect().catch(() => {});
    pendingLogins.delete(phoneNumber);
    throw new Error("CODE_EXPIRED");
  }

  const { client } = entry;
  entry.attemptCount = (entry.attemptCount || 0) + 1;
  
  log("INFO", phoneNumber, `Attempt #${entry.attemptCount} to sign in`);

  try {
    // Always use client.start() for all authentication scenarios
    // It handles code verification, password requirement detection, and 2FA
    entry.authMethod = "start";
    log("INFO", phoneNumber, "Using client.start() for authentication");
    
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
        log("INFO", phoneNumber, "password callback invoked");
        if (!password) {
          entry.isVerifyingPassword = true;
          entry.phoneCodeVerified = true;
          entry.phoneCode = code;
          log("WARN", phoneNumber, "Password required but not provided - stopping here");
          throw new Error("PASSWORD_REQUIRED");
        }
        log("INFO", phoneNumber, "password callback returning 2FA password");
        return password;
      },
      onError: (err: any) => {
        log("ERROR", phoneNumber, "client.start() error callback", {
          errorMessage: err.message,
          errorCode: err.code
        });
        if (err.message && err.message.includes("PASSWORD")) {
          entry.isVerifyingPassword = true;
          entry.phoneCodeVerified = true;
          entry.phoneCode = code;
          throw new Error("PASSWORD_REQUIRED");
        }
        throw err;
      }
    });
    
    log("SUCCESS", phoneNumber, "client.start() completed successfully");

    const sessionString = (client.session as StringSession).save();
    log("INFO", phoneNumber, "Session string generated successfully", {
      sessionStringLength: sessionString.length
    });

    // After successful sign in, disconnect the temp client
    await client.disconnect().catch(() => {});
    log("INFO", phoneNumber, "Temporary client disconnected");
    
    pendingLogins.delete(phoneNumber);
    log("SUCCESS", phoneNumber, "Pending login entry removed, authentication complete");
    
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
      await client.disconnect().catch(() => {});
      pendingLogins.delete(phoneNumber);
      throw new Error("INVALID_CODE");
    }

    if (err.message.includes("PHONE_CODE_EXPIRED")) {
      log("ERROR", phoneNumber, "Phone code has expired");
      await client.disconnect().catch(() => {});
      pendingLogins.delete(phoneNumber);
      throw new Error("CODE_EXPIRED");
    }

    if (err.message.includes("FLOOD_WAIT")) {
      log("ERROR", phoneNumber, "Too many attempts, rate limit hit");
      await client.disconnect().catch(() => {});
      pendingLogins.delete(phoneNumber);
      throw new Error("RATE_LIMITED");
    }

    // Password failure - track attempts but DON'T disconnect or delete
    if (err.message === "INVALID_PASSWORD" || err.message.includes("PASSWORD_INVALID")) {
      entry.passwordFailureCount = (entry.passwordFailureCount || 0) + 1;
      log("ERROR", phoneNumber, "Invalid password provided for 2FA", {
        failureCount: entry.passwordFailureCount
      });
      
      // Allow up to 3 password attempts before giving up
      if (entry.passwordFailureCount >= 3) {
        log("ERROR", phoneNumber, "Too many password failures, disconnecting");
        await client.disconnect().catch(() => {});
        pendingLogins.delete(phoneNumber);
      }
      
      throw new Error("INVALID_PASSWORD");
    }

    // For any other error, disconnect and clean up
    log("ERROR", phoneNumber, "Unknown error during sign in", { error: err.message });
    await client.disconnect().catch(() => {});
    pendingLogins.delete(phoneNumber);
    throw err;
  }
}
