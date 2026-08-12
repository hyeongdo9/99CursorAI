import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CliConfig, ShareRole } from "./config.js";

export interface CreateDocArgs {
  title: string;
  markdown: string;
  shareWith?: string;
  shareRole?: ShareRole;
}

export interface CreateDocResult {
  documentId: string;
  documentUrl: string;
  title: string;
}

function buildEnv(config: CliConfig): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) merged[key] = value;
  }
  Object.assign(merged, config.env);
  return merged;
}

export class McpGdocsClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  constructor(private readonly config: CliConfig) {}

  async connect(): Promise<void> {
    this.transport = new StdioClientTransport({
      command: "node",
      args: [this.config.mcpServerTsx, this.config.mcpServerEntry],
      env: buildEnv(this.config),
      cwd: this.config.projectRoot,
    });

    this.client = new Client({ name: "md-to-gdocs-cli", version: "1.0.0" });
    await this.client.connect(this.transport);
  }

  async createFromMarkdown(args: CreateDocArgs): Promise<CreateDocResult> {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    // Large markdown docs can exceed the SDK default 60s timeout.
    const result = await this.client.callTool(
      {
        name: "gdocs_create_from_markdown",
        arguments: {
          title: args.title,
          markdown: args.markdown,
          shareWith: args.shareWith,
          shareRole: args.shareRole,
        },
      },
      undefined,
      { timeout: 300_000 }
    );

    if (result.isError) {
      const content = result.content as Array<{ type: string; text?: string }>;
      const message = content[0]?.text ?? "Unknown MCP tool error";
      throw new Error(message);
    }

    const content = result.content as Array<{ type: string; text?: string }>;
    const text = content[0]?.text ?? "{}";
    return JSON.parse(text) as CreateDocResult;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    this.transport = null;
  }
}
