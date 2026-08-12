import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { CliConfig, ShareRole } from "./config.js";
import { isJobRootFile } from "./config.js";
import type { McpGdocsClient } from "./mcp-client.js";

export interface ParsedMdFile {
  filePath: string;
  fileName: string;
  title: string;
  markdown: string;
  shareWith?: string;
  shareRole?: ShareRole;
}

const processing = new Set<string>();

function log(message: string, data?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    message,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

export function parseMdFile(filePath: string): ParsedMdFile {
  const raw = matter.read(filePath);
  const fileName = path.basename(filePath);
  const titleFromName = fileName.replace(/\.md$/i, "");
  const title = typeof raw.data.title === "string" && raw.data.title.trim()
    ? raw.data.title.trim()
    : titleFromName;

  const shareWith =
    typeof raw.data.shareWith === "string" && raw.data.shareWith.trim()
      ? raw.data.shareWith.trim()
      : undefined;

  const shareRole =
    typeof raw.data.shareRole === "string" &&
    ["reader", "writer", "commenter"].includes(raw.data.shareRole)
      ? (raw.data.shareRole as ShareRole)
      : undefined;

  return {
    filePath,
    fileName,
    title,
    markdown: raw.content.trim(),
    shareWith,
    shareRole,
  };
}

async function ensureDirs(config: CliConfig): Promise<void> {
  await fs.mkdir(config.completedDir, { recursive: true });
  await fs.mkdir(config.failedDir, { recursive: true });
}

async function moveFile(src: string, destDir: string): Promise<string> {
  const dest = path.join(destDir, path.basename(src));
  await fs.rename(src, dest);
  return dest;
}

async function writeErrorLog(failedFilePath: string, error: unknown): Promise<void> {
  const logPath = `${failedFilePath}.error.log`;
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  await fs.writeFile(
    logPath,
    `${new Date().toISOString()}\n${message}\n`,
    "utf-8"
  );
}

export async function processFile(
  filePath: string,
  config: CliConfig,
  client: McpGdocsClient
): Promise<void> {
  const resolved = path.resolve(filePath);

  if (!isJobRootFile(resolved, config)) {
    return;
  }

  if (processing.has(resolved)) {
    return;
  }

  processing.add(resolved);

  try {
    await ensureDirs(config);
    const parsed = parseMdFile(resolved);

    log("processing", { fileName: parsed.fileName, title: parsed.title });

    const result = await client.createFromMarkdown({
      title: parsed.title,
      markdown: parsed.markdown,
      shareWith: parsed.shareWith,
      shareRole: parsed.shareRole,
    });

    const dest = await moveFile(resolved, config.completedDir);

    log("completed", {
      fileName: parsed.fileName,
      status: "success",
      documentId: result.documentId,
      documentUrl: result.documentUrl,
      movedTo: dest,
    });
  } catch (error) {
    try {
      const failedPath = await moveFile(resolved, config.failedDir);
      await writeErrorLog(failedPath, error);
      log("failed", {
        fileName: path.basename(resolved),
        status: "error",
        movedTo: failedPath,
        error: error instanceof Error ? error.message : String(error),
      });
    } catch (moveError) {
      log("failed", {
        fileName: path.basename(resolved),
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        moveError: moveError instanceof Error ? moveError.message : String(moveError),
      });
      throw error;
    }
  } finally {
    processing.delete(resolved);
  }
}

export async function listPendingFiles(config: CliConfig): Promise<string[]> {
  await ensureDirs(config);
  const entries = await fs.readdir(config.jobDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"))
    .map((e) => path.join(config.jobDir, e.name));
}
