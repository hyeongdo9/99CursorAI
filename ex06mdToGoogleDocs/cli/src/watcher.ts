import chokidar, { type FSWatcher } from "chokidar";
import path from "node:path";
import type { CliConfig } from "./config.js";
import { isJobRootFile } from "./config.js";
import type { McpGdocsClient } from "./mcp-client.js";
import { listPendingFiles, processFile } from "./processor.js";

const DEBOUNCE_MS = 300;

function isMarkdownFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".md";
}

export function startWatcher(config: CliConfig, client: McpGdocsClient): FSWatcher {
  // Watch the job directory (depth 0) instead of a glob.
  // Windows + chokidar often miss `job\*.md` globs for initial and copy events.
  const watcher = chokidar.watch(config.jobDir, {
    depth: 0,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 100 },
    ignored: [
      path.join(config.jobDir, "completed"),
      path.join(config.jobDir, "failed"),
      /(^|[\\/])\../, // dotfiles
    ],
  });

  const timers = new Map<string, NodeJS.Timeout>();

  const enqueue = (filePath: string) => {
    if (!isMarkdownFile(filePath)) return;
    if (!isJobRootFile(filePath, config)) return;

    const resolved = path.resolve(filePath);
    const existing = timers.get(resolved);
    if (existing) clearTimeout(existing);

    timers.set(
      resolved,
      setTimeout(() => {
        timers.delete(resolved);
        void processFile(resolved, config, client).catch((err) => {
          console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            message: "watcher_error",
            filePath: resolved,
            error: err instanceof Error ? err.message : String(err),
          }));
        });
      }, DEBOUNCE_MS)
    );
  };

  watcher.on("add", enqueue);
  watcher.on("change", enqueue);

  watcher.on("ready", () => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      message: "watching",
      jobDir: config.jobDir,
    }));

    // Startup scan: process files already waiting in job/
    void listPendingFiles(config).then((files) => {
      for (const file of files) {
        enqueue(file);
      }
    }).catch((err) => {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        message: "startup_scan_error",
        error: err instanceof Error ? err.message : String(err),
      }));
    });
  });

  return watcher;
}
