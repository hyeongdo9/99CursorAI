import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(process.cwd(), ".env") });

export interface BridgeConfig {
  telegramBotToken: string;
  telegramAllowedUserId: string;
  cursorApiKey: string;
  cursorWorkspace: string;
}

export function loadConfig(): BridgeConfig {
  const telegramBotToken = process.env.TELEGRAM_BOT_API_TOKEN?.trim();
  const telegramAllowedUserId = process.env.TELEGRAM_ALLOWED_USER_ID?.trim();
  const cursorApiKey = process.env.CURSOR_API_KEY?.trim();
  const cursorWorkspace =
    process.env.CURSOR_WORKSPACE?.trim() || process.cwd();

  if (!telegramBotToken) {
    throw new Error("TELEGRAM_BOT_API_TOKEN is required in .env");
  }
  if (!telegramAllowedUserId) {
    throw new Error("TELEGRAM_ALLOWED_USER_ID is required in .env");
  }
  if (!cursorApiKey) {
    throw new Error("CURSOR_API_KEY is required in .env");
  }

  return {
    telegramBotToken,
    telegramAllowedUserId,
    cursorApiKey,
    cursorWorkspace: path.resolve(cursorWorkspace),
  };
}
