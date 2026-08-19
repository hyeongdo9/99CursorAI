import { loadConfig } from "./config.js";
import { CursorBridge } from "./cursor-bridge.js";
import { createTelegramBot } from "./telegram-bot.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const cursorBridge = new CursorBridge(config);
  const bot = createTelegramBot(config, cursorBridge);

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    bot.stop();
    await cursorBridge.dispose();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  console.log("Telegram → Cursor bridge starting...");
  console.log(`Workspace: ${config.cursorWorkspace}`);
  console.log(`Allowed Telegram user: ${config.telegramAllowedUserId}`);

  await bot.start({
    onStart: (info) => {
      console.log(`Bot @${info.username} is listening for messages.`);
    },
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
