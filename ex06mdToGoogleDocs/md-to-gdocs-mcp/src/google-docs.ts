import type { docs_v1, drive_v3 } from "googleapis";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { AppConfig, ShareRole } from "./config.js";
import { getAuthenticatedClient } from "./auth.js";
import { applyMarkdownContent } from "./markdown-to-docs.js";

export interface CreateDocInput {
  title: string;
  markdown: string;
  folderId?: string;
  shareWith?: string;
  shareRole?: ShareRole;
}

export interface CreateDocResult {
  documentId: string;
  documentUrl: string;
  title: string;
}

export class GoogleDocsService {
  private auth!: OAuth2Client;
  private drive!: drive_v3.Drive;
  private docs!: docs_v1.Docs;

  constructor(private readonly config: AppConfig) {}

  async init(): Promise<void> {
    this.auth = await getAuthenticatedClient(this.config);
    this.drive = google.drive({ version: "v3", auth: this.auth });
    this.docs = google.docs({ version: "v1", auth: this.auth });
  }

  async createFromMarkdown(input: CreateDocInput): Promise<CreateDocResult> {
    const folderId = input.folderId || this.config.driveFolderId || undefined;
    const shareWith = input.shareWith ?? this.config.defaultShareWith;
    const shareRole = input.shareRole ?? this.config.defaultShareRole;

    const createRes = await this.drive.files.create({
      requestBody: {
        name: input.title,
        mimeType: "application/vnd.google-apps.document",
        parents: folderId ? [folderId] : undefined,
      },
      fields: "id, webViewLink",
    });

    const documentId = createRes.data.id;
    if (!documentId) {
      throw new Error("Failed to create Google Doc");
    }

    await applyMarkdownContent(this.docs, documentId, input.markdown);

    if (shareWith.trim()) {
      await this.drive.permissions.create({
        fileId: documentId,
        requestBody: {
          type: "user",
          role: shareRole,
          emailAddress: shareWith.trim(),
        },
        sendNotificationEmail: false,
      });
    }

    return {
      documentId,
      documentUrl: createRes.data.webViewLink ?? `https://docs.google.com/document/d/${documentId}/edit`,
      title: input.title,
    };
  }
}

export async function createGoogleDocFromMarkdown(
  config: AppConfig,
  input: CreateDocInput
): Promise<CreateDocResult> {
  const service = new GoogleDocsService(config);
  await service.init();
  return service.createFromMarkdown(input);
}
