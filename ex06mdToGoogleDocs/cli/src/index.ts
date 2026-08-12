import path from "node:path";
import { loadCliConfig } from "./config.js";
import { McpGdocsClient } from "./mcp-client.js";
import { listPendingFiles, processFile } from "./processor.js";
import { startWatcher } from "./watcher.js";

function printUsage(): void {
  console.log(`Usage:
  npm run process -- --file job/example.md   Process a single file
  npm run process -- --all                   Process all files in job/
  npm run watch                              Watch job/ for new/changed files
`);
}

async function runProcess(args: string[]): Promise<void> {
  const config = loadCliConfig();
  const client = new McpGdocsClient(config);

  try {
    await client.connect();

    if (args.includes("--all")) {
      const files = await listPendingFiles(config);
      if (files.length === 0) {
        console.log(JSON.stringify({ message: "no_pending_files" }));
        return;
      }
      for (const file of files) {
        await processFile(file, config, client);
      }
      return;
    }

    const fileIndex = args.indexOf("--file");
    if (fileIndex === -1 || !args[fileIndex + 1]) {
      printUsage();
      process.exit(1);
    }

    const filePath = path.resolve(config.projectRoot, args[fileIndex + 1]);
    await processFile(filePath, config, client);
  } finally {
    await client.close();
  }
}

async function runWatch(): Promise<void> {
  const config = loadCliConfig();
  const client = new McpGdocsClient(config);
  await client.connect();
  const watcher = startWatcher(config, client);

  const shutdown = async () => {
    await watcher.close();
    await client.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;

  switch (command) {
    case "process":
      await runProcess(rest);
      break;
    case "watch":
      await runWatch();
      break;
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    message: "fatal",
    error: err instanceof Error ? err.message : String(err),
  }));
  process.exit(1);
});
