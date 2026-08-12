import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { URL } from "node:url";
import { OAuth2Client } from "google-auth-library";
import type { AppConfig } from "./config.js";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
];

const DEFAULT_LOOPBACK_PORT = 3000;
const DEFAULT_LOOPBACK_REDIRECT = `http://127.0.0.1:${DEFAULT_LOOPBACK_PORT}/oauth2callback`;

interface TokenFile {
  type: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

interface OAuthClientInfo {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  listenPort: number;
  listenHost: string;
  callbackPath: string;
  isInstalled: boolean;
}

async function readOAuthClient(config: AppConfig): Promise<OAuthClientInfo> {
  const raw = await fs.readFile(config.oauthClientPath, "utf-8");
  const json = JSON.parse(raw) as {
    installed?: { client_id: string; client_secret: string; redirect_uris?: string[] };
    web?: { client_id: string; client_secret: string; redirect_uris?: string[] };
  };

  const isInstalled = Boolean(json.installed);
  const creds = json.installed ?? json.web;
  if (!creds) {
    throw new Error("OAuth client JSON must contain installed or web credentials");
  }

  const envRedirect = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (envRedirect) {
    const parsed = new URL(envRedirect);
    return {
      clientId: creds.client_id,
      clientSecret: creds.client_secret,
      redirectUri: envRedirect,
      listenPort: Number(parsed.port) || (parsed.protocol === "https:" ? 443 : 80),
      listenHost: parsed.hostname,
      callbackPath: parsed.pathname,
      isInstalled,
    };
  }

  const registeredRedirect = creds.redirect_uris?.[0];

  // Desktop(installed) clients: use loopback IP flow (Google-recommended, no Console URI change needed)
  if (isInstalled) {
    const parsed = new URL(DEFAULT_LOOPBACK_REDIRECT);
    return {
      clientId: creds.client_id,
      clientSecret: creds.client_secret,
      redirectUri: DEFAULT_LOOPBACK_REDIRECT,
      listenPort: DEFAULT_LOOPBACK_PORT,
      listenHost: parsed.hostname,
      callbackPath: parsed.pathname,
      isInstalled: true,
    };
  }

  // Web clients: use the registered redirect URI from credentials.json
  const redirectUri = registeredRedirect ?? DEFAULT_LOOPBACK_REDIRECT;
  const parsed = new URL(redirectUri);
  return {
    clientId: creds.client_id,
    clientSecret: creds.client_secret,
    redirectUri,
    listenPort: Number(parsed.port) || (parsed.protocol === "https:" ? 443 : 80),
    listenHost: parsed.hostname,
    callbackPath: parsed.pathname,
    isInstalled: false,
  };
}

async function loadTokenFile(config: AppConfig): Promise<TokenFile | null> {
  try {
    const raw = await fs.readFile(config.oauthTokenPath, "utf-8");
    return JSON.parse(raw) as TokenFile;
  } catch {
    return null;
  }
}

export async function saveTokenFile(
  config: AppConfig,
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<void> {
  await fs.mkdir(path.dirname(config.oauthTokenPath), { recursive: true });
  const payload: TokenFile = {
    type: "authorized_user",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  };
  await fs.writeFile(config.oauthTokenPath, JSON.stringify(payload, null, 2), "utf-8");
}

export async function getAuthenticatedClient(config: AppConfig): Promise<OAuth2Client> {
  const token = await loadTokenFile(config);
  const { clientId, clientSecret } = await readOAuthClient(config);
  const client = new OAuth2Client({ clientId, clientSecret });

  if (token?.refresh_token) {
    client.setCredentials({ refresh_token: token.refresh_token });
    return client;
  }

  throw new Error(
    `No token found at ${config.oauthTokenPath}. Run: npm run auth`
  );
}

function openBrowser(url: string): void {
  const platform = process.platform;
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  } else if (platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

/** Browser OAuth flow with local callback server */
export async function runWebAuthFlow(config: AppConfig): Promise<void> {
  const clientInfo = await readOAuthClient(config);
  const client = new OAuth2Client({
    clientId: clientInfo.clientId,
    clientSecret: clientInfo.clientSecret,
    redirectUri: clientInfo.redirectUri,
  });

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("Redirect URI:", clientInfo.redirectUri);
  if (clientInfo.isInstalled) {
    console.log(
      "Using desktop loopback flow (127.0.0.1). No Google Cloud redirect URI change needed."
    );
  } else {
    console.log(
      "Ensure this redirect URI is registered in Google Cloud Console → OAuth client → Authorized redirect URIs."
    );
  }

  console.log("\nOpening browser for Google sign-in...");
  console.log("If the browser does not open, visit this URL manually:\n", authUrl);

  const codePromise = waitForAuthCode(clientInfo);
  openBrowser(authUrl);

  const code = await codePromise;
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh_token received. Revoke app access in Google Account settings and run npm run auth again."
    );
  }

  await saveTokenFile(
    config,
    clientInfo.clientId,
    clientInfo.clientSecret,
    tokens.refresh_token
  );
  console.log(`Token saved to ${config.oauthTokenPath}`);
}

function waitForAuthCode(clientInfo: OAuthClientInfo): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? clientInfo.listenHost}`);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(`Auth error: ${error}`);
          server.close();
          reject(new Error(error));
          return;
        }

        if (code && url.pathname === clientInfo.callbackPath) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            "<h1>Authentication successful.</h1><p>You can close this window and return to the terminal.</p>"
          );
          server.close();
          resolve(code);
          return;
        }

        res.writeHead(404);
        res.end();
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(clientInfo.listenPort, clientInfo.listenHost, () => {
      console.log(
        `Waiting for OAuth callback on http://${clientInfo.listenHost}:${clientInfo.listenPort}${clientInfo.callbackPath}`
      );
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${clientInfo.listenPort} is already in use. Close the other process or set GOOGLE_OAUTH_REDIRECT_URI to use another port.`
          )
        );
        return;
      }
      reject(err);
    });
  });
}
