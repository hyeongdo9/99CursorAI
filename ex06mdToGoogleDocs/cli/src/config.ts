import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(projectRoot, ".env") });

export type ShareRole = "reader" | "writer" | "commenter";

export interface CliConfig {
  projectRoot: string;
  jobDir: string;
  completedDir: string;
  failedDir: string;
  mcpServerEntry: string;
  mcpServerTsx: string;
  env: Record<string, string>;
}

function resolvePath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

function resolveTsxCli(): string {
  const candidates = [
    path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(projectRoot, "md-to-gdocs-mcp", "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(projectRoot, "cli", "node_modules", "tsx", "dist", "cli.mjs"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("tsx CLI not found. Run npm install in project root.");
}

export function loadCliConfig(): CliConfig {
  const jobDir = resolvePath(process.env.JOB_DIR ?? "job");

  const env: Record<string, string> = {
    GOOGLE_OAUTH_CLIENT_PATH: process.env.GOOGLE_OAUTH_CLIENT_PATH ?? "credentials.json",
    GOOGLE_OAUTH_TOKEN_PATH: process.env.GOOGLE_OAUTH_TOKEN_PATH ?? "token.json",
    GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID ?? "",
    GOOGLE_SHARE_WITH: process.env.GOOGLE_SHARE_WITH ?? "",
    GOOGLE_SHARE_ROLE: process.env.GOOGLE_SHARE_ROLE ?? "reader",
    JOB_DIR: process.env.JOB_DIR ?? "job",
  };

  return {
    projectRoot,
    jobDir,
    completedDir: path.join(jobDir, "completed"),
    failedDir: path.join(jobDir, "failed"),
    mcpServerEntry: path.join(projectRoot, "md-to-gdocs-mcp", "src", "index.ts"),
    mcpServerTsx: resolveTsxCli(),
    env,
  };
}

export function isJobRootFile(filePath: string, config: CliConfig): boolean {
  const dir = path.dirname(filePath);
  return path.resolve(dir) === path.resolve(config.jobDir);
}
