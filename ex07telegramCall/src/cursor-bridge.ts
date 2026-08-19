import { Agent, CursorAgentError } from "@cursor/sdk";
import type { BridgeConfig } from "./config.js";

export class CursorBridge {
  private agent: Awaited<ReturnType<typeof Agent.create>> | null = null;
  private readonly config: BridgeConfig;

  constructor(config: BridgeConfig) {
    this.config = config;
  }

  get agentId(): string | null {
    return this.agent?.agentId ?? null;
  }

  async reset(): Promise<void> {
    await this.disposeAgent();
  }

  async sendPrompt(prompt: string): Promise<string> {
    if (!this.agent) {
      this.agent = await Agent.create({
        apiKey: this.config.cursorApiKey,
        model: { id: "composer-2.5" },
        local: {
          cwd: this.config.cursorWorkspace,
          settingSources: [],
        },
      });
    }

    try {
      const run = await this.agent.send(prompt);
      let streamedText = "";

      for await (const event of run.stream()) {
        if (event.type === "assistant") {
          for (const block of event.message.content) {
            if (block.type === "text") {
              streamedText += block.text;
            }
          }
        }
      }

      const result = await run.wait();
      if (result.status === "error") {
        throw new Error(`Cursor run failed (${result.id})`);
      }

      return (
        streamedText.trim() ||
        result.result?.trim() ||
        "요청을 처리했지만 텍스트 응답이 없습니다."
      );
    } catch (error) {
      if (error instanceof CursorAgentError) {
        throw new Error(
          `Cursor startup failed: ${error.message} (retryable=${error.isRetryable})`,
        );
      }
      throw error;
    }
  }

  async dispose(): Promise<void> {
    await this.disposeAgent();
  }

  private async disposeAgent(): Promise<void> {
    if (!this.agent) {
      return;
    }

    const current = this.agent;
    this.agent = null;
    await current[Symbol.asyncDispose]();
  }
}
