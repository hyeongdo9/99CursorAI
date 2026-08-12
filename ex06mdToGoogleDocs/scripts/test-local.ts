import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractTablesFromMarkdown,
  markdownToBatchRequests,
  parseMarkdownElements,
} from "../md-to-gdocs-mcp/src/markdown-to-docs.ts";
import { parseMdFile } from "../cli/src/processor.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function testMarkdownConverter(): void {
  const requests = markdownToBatchRequests("# Title\n\n**bold** and *italic*");
  assert.ok(requests.length >= 2);
  assert.equal(requests[0]?.insertText?.text?.includes("Title"), true);
  console.log("OK markdown converter");
}

function testTableConverter(): void {
  const md = "| A | B |\n|---|---|\n| 1 | 2 |";
  const elements = parseMarkdownElements(md);
  const table = elements.find((e) => e.kind === "table");
  assert.ok(table && table.kind === "table");
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0]?.join("|"), "A|B");
  assert.equal(table.rows[1]?.join("|"), "1|2");
  console.log("OK table converter");
}

function testFrontmatterParser(): void {
  const sample = path.join(projectRoot, "job", "completed", "spec-excerpt.md");
  const parsed = parseMdFile(sample);
  assert.equal(parsed.title, "SPEC 발췌 — MD to Google Docs (섹션 1~4)");
  assert.ok(parsed.markdown.includes("확정 요구사항"));
  const tables = extractTablesFromMarkdown(parsed.markdown);
  assert.ok(tables.length >= 2, "spec excerpt should contain tables");
  console.log("OK frontmatter parser");
}

testMarkdownConverter();
testTableConverter();
testFrontmatterParser();
console.log("All local tests passed");
