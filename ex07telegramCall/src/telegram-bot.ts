import { Bot } from "grammy";
import type { BridgeConfig } from "./config.js";
import { CursorBridge } from "./cursor-bridge.js";
import { splitTelegramMessage } from "./util.js";

export function createTelegramBot(
  config: BridgeConfig,
  cursorBridge: CursorBridge,
): Bot {
  const bot = new Bot(config.telegramBotToken);

  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id?.toString();
    if (userId !== config.telegramAllowedUserId) {
      console.warn(`Ignored message from unauthorized user: ${userId ?? "unknown"}`);
      return;
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(
      [
        "Telegram → Cursor 브릿지입니다.",
        "",
        "일반 텍스트를 보내면 Cursor 에이전트로 전달됩니다.",
        "",
        "명령어:",
        "/new - 새 Cursor 세션 시작",
        "/status - 현재 세션 상태 확인",
      ].join("\n"),
    );
  });

  bot.command("new", async (ctx) => {
    await cursorBridge.reset();
    await ctx.reply("새 Cursor 에이전트 세션을 시작했습니다.");
  });

  bot.command("status", async (ctx) => {
    const agentId = cursorBridge.agentId;
    await ctx.reply(
      agentId
        ? `활성 Cursor 에이전트: ${agentId}`
        : "활성 Cursor 에이전트가 없습니다. 메시지를 보내면 새 세션이 시작됩니다.",
    );
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (!text || text.startsWith("/")) {
      return;
    }

    await ctx.replyWithChatAction("typing");
    const statusMessage = await ctx.reply("Cursor 에이전트 실행 중...");

    try {
      const response = await cursorBridge.sendPrompt(text);
      const chunks = splitTelegramMessage(response);

      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        chunks[0] ?? "완료",
      );

      for (let i = 1; i < chunks.length; i += 1) {
        await ctx.reply(chunks[i]!);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        `오류: ${message}`,
      );
    }
  });

  return bot;
}
