import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { createGoogleDocFromMarkdown } from "./google-docs.js";

const shareRoleSchema = z.enum(["reader", "writer", "commenter"]);

export function createMcpServer(): McpServer {
  const config = loadConfig();
  const server = new McpServer({
    name: "md-to-gdocs",
    version: "1.0.0",
  });

  server.tool(
    "gdocs_create_from_markdown",
    "Create a new Google Doc from Markdown content",
    {
      title: z.string().describe("Document title"),
      markdown: z.string().describe("Markdown body (without frontmatter)"),
      folderId: z.string().optional().describe("Drive folder ID"),
      shareWith: z.string().optional().describe("Email to share with"),
      shareRole: shareRoleSchema.optional().describe("Share permission role"),
    },
    async (args) => {
      const result = await createGoogleDocFromMarkdown(config, args);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "gdocs_auth_status",
    "Check whether OAuth token is configured",
    async () => {
      const fs = await import("node:fs/promises");
      let hasClient = false;
      let hasToken = false;

      try {
        await fs.access(config.oauthClientPath);
        hasClient = true;
      } catch {
        /* not found */
      }

      try {
        await fs.access(config.oauthTokenPath);
        hasToken = true;
      } catch {
        /* not found */
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                oauthClientPath: config.oauthClientPath,
                oauthTokenPath: config.oauthTokenPath,
                hasClient,
                hasToken,
                driveFolderId: config.driveFolderId || "(not set)",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

export async function startServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isDirectRun = process.argv[1]?.includes("index.ts") || process.argv[1]?.includes("index.js");
if (isDirectRun) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
