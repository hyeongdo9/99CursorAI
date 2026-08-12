import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(projectRoot, ".env") });

export type ShareRole = "reader" | "writer" | "commenter";

export interface AppConfig {
  oauthClientPath: string;
  oauthTokenPath: string;
  driveFolderId: string;
  defaultShareWith: string;
  defaultShareRole: ShareRole;
  jobDir: string;
}

function resolvePath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

export function loadConfig(): AppConfig {
  return {
    oauthClientPath: resolvePath(
      process.env.GOOGLE_OAUTH_CLIENT_PATH ?? "credentials.json"
    ),
    oauthTokenPath: resolvePath(
      process.env.GOOGLE_OAUTH_TOKEN_PATH ?? "token.json"
    ),
    driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID ?? "",
    defaultShareWith: process.env.GOOGLE_SHARE_WITH ?? "",
    defaultShareRole: (process.env.GOOGLE_SHARE_ROLE as ShareRole) ?? "reader",
    jobDir: resolvePath(process.env.JOB_DIR ?? "job"),
  };
}
