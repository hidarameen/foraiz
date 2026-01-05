
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { storage } from "./storage";
import { getTelegramClient } from "./services/telegram";

async function testSession(sessionId: number) {
  console.log(`Testing session ${sessionId}...`);
  try {
    const client = await getTelegramClient(sessionId);
    if (!client) {
      console.log(`Session ${sessionId} not found or inactive.`);
      return;
    }

    console.log("Attempting to get 'me'...");
    const me = await client.getMe();
    console.log(`Successfully connected as: ${me.firstName} (@${me.username})`);

    console.log("Attempting to fetch last 5 dialogs...");
    const dialogs = await client.getDialogs({ limit: 5 });
    console.log(`Successfully fetched ${dialogs.length} dialogs.`);
    
    for (const dialog of dialogs) {
        console.log(`- ${dialog.title} (ID: ${dialog.id})`);
    }

    console.log(`Session ${sessionId} is VALID.`);
  } catch (error: any) {
    console.error(`Session ${sessionId} test FAILED:`, error.message);
    if (error.message.includes("AUTH_KEY_DUPLICATED")) {
      console.error("CRITICAL: Auth key is duplicated. This session string might be being used elsewhere or is corrupted.");
    }
  }
}

const sessionId = parseInt(process.argv[2]);
if (isNaN(sessionId)) {
  console.error("Please provide a session ID as an argument.");
  process.exit(1);
}

testSession(sessionId).then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
