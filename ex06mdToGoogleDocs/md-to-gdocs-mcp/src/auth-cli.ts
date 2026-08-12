import { loadConfig } from "./config.js";
import { runWebAuthFlow } from "./auth.js";

async function main(): Promise<void> {
  const config = loadConfig();
  console.log("Starting Google OAuth flow...");
  console.log(`Client: ${config.oauthClientPath}`);
  console.log(`Token will be saved to: ${config.oauthTokenPath}`);
  await runWebAuthFlow(config);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
