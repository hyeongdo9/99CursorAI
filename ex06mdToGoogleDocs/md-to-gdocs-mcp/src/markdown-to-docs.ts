import { remark } from "remark";
import remarkGfm from "remark-gfm";
import type { docs_v1 } from "googleapis";
import type { Root, Content, PhrasingContent, Table, TableCell } from "mdast";

type BatchRequest = docs_v1.Schema$Request;

interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export interface TextBlock {
  kind: "text";
  segments: TextSegment[];
  style: "NORMAL" | "HEADING_1" | "HEADING_2" | "HEADING_3" | "HEADING_4" | "HEADING_5" | "HEADING_6";
  bullet?: boolean;
  codeBlock?: boolean;
}

export interface TableBlock {
  kind: "table";
  rows: string[][];
  headerRow?: boolean;
}

export type DocElement = TextBlock | TableBlock;

function headingStyle(depth: number): TextBlock["style"] {
  const map: TextBlock["style"][] = [
    "HEADING_1",
    "HEADING_2",
    "HEADING_3",
    "HEADING_4",
    "HEADING_5",
    "HEADING_6",
  ];
  return map[Math.min(Math.max(depth, 1), 6) - 1];
}

function inlineToSegments(nodes: PhrasingContent[] | undefined): TextSegment[] {
  if (!nodes?.length) return [{ text: "" }];

  const segments: TextSegment[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "text":
        segments.push({ text: node.value });
        break;
      case "strong":
        for (const child of inlineToSegments(node.children as PhrasingContent[])) {
          segments.push({ ...child, bold: true });
        }
        break;
      case "emphasis":
        for (const child of inlineToSegments(node.children as PhrasingContent[])) {
          segments.push({ ...child, italic: true });
        }
        break;
      case "inlineCode":
        segments.push({ text: node.value, code: true });
        break;
      case "delete":
        for (const child of inlineToSegments(node.children as PhrasingContent[])) {
          segments.push({ ...child, text: `~${child.text}~` });
        }
        break;
      case "link":
        segments.push({
          text: inlineToSegments(node.children as PhrasingContent[])
            .map((s) => s.text)
            .join(""),
        });
        break;
      default:
        if ("children" in node && Array.isArray(node.children)) {
          segments.push(...inlineToSegments(node.children as PhrasingContent[]));
        } else if ("value" in node && typeof node.value === "string") {
          segments.push({ text: node.value });
        }
        break;
    }
  }

  return segments.length ? segments : [{ text: "" }];
}

function cellToText(cell: TableCell): string {
  return cell.children
    .flatMap((child) => {
      const node = child as Content;
      if (node.type === "paragraph") {
        return inlineToSegments(node.children as PhrasingContent[]).map((s) => s.text);
      }
      return inlineToSegments([child as PhrasingContent]).map((s) => s.text);
    })
    .join("");
}

function tableToBlock(node: Table): TableBlock {
  const rows: string[][] = [];
  for (const row of node.children) {
    rows.push(row.children.map((cell) => cellToText(cell)));
  }
  return { kind: "table", rows, headerRow: true };
}

export function parseMarkdownElements(markdown: string): DocElement[] {
  const tree = remark().use(remarkGfm).parse(markdown) as Root;
  const elements: DocElement[] = [];

  for (const node of tree.children) {
    switch (node.type) {
      case "heading":
        elements.push({
          kind: "text",
          style: headingStyle(node.depth),
          segments: inlineToSegments(node.children as PhrasingContent[]),
        });
        break;
      case "paragraph":
        elements.push({
          kind: "text",
          style: "NORMAL",
          segments: inlineToSegments(node.children as PhrasingContent[]),
        });
        break;
      case "list":
        for (const item of node.children) {
          const textParts: TextSegment[] = [];
          for (const child of item.children) {
            if (child.type === "paragraph") {
              textParts.push(...inlineToSegments(child.children as PhrasingContent[]));
            }
          }
          elements.push({ kind: "text", style: "NORMAL", segments: textParts, bullet: true });
        }
        break;
      case "code":
        elements.push({
          kind: "text",
          style: "NORMAL",
          segments: [{ text: node.value, code: true }],
          codeBlock: true,
        });
        break;
      case "blockquote":
        for (const child of node.children) {
          if (child.type === "paragraph") {
            elements.push({
              kind: "text",
              style: "NORMAL",
              segments: [{ text: "> " }, ...inlineToSegments(child.children as PhrasingContent[])],
            });
          }
        }
        break;
      case "table":
        elements.push(tableToBlock(node));
        break;
      case "thematicBreak":
        elements.push({ kind: "text", style: "NORMAL", segments: [{ text: "---" }] });
        break;
      default:
        break;
    }
  }

  return elements;
}

function buildInlineStyleRequests(textStart: number, block: TextBlock): BatchRequest[] {
  const requests: BatchRequest[] = [];
  let offset = 0;

  for (const segment of block.segments) {
    const segStart = textStart + offset;
    const segEnd = segStart + segment.text.length;
    offset += segment.text.length;

    if (segment.text.length === 0) continue;

    const fields: string[] = [];
    const style: docs_v1.Schema$TextStyle = {};

    if (segment.bold) {
      style.bold = true;
      fields.push("bold");
    }
    if (segment.italic) {
      style.italic = true;
      fields.push("italic");
    }
    if (segment.code || block.codeBlock) {
      style.weightedFontFamily = { fontFamily: "Courier New" };
      style.fontSize = { magnitude: 10, unit: "PT" };
      fields.push("weightedFontFamily", "fontSize");
    }

    if (fields.length > 0) {
      requests.push({
        updateTextStyle: {
          range: { startIndex: segStart, endIndex: segEnd },
          textStyle: style,
          fields: fields.join(","),
        },
      });
    }
  }

  return requests;
}

const REQUEST_CHUNK_SIZE = 80;

async function flushRequests(
  docs: docs_v1.Docs,
  documentId: string,
  requests: BatchRequest[]
): Promise<void> {
  for (let i = 0; i < requests.length; i += REQUEST_CHUNK_SIZE) {
    const chunk = requests.slice(i, i + REQUEST_CHUNK_SIZE);
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests: chunk },
    });
  }
}

/** Insert consecutive text paragraphs in one write, then apply styles in chunks. */
async function applyTextBlocks(
  docs: docs_v1.Docs,
  documentId: string,
  blocks: TextBlock[],
  insertIndex: number
): Promise<void> {
  if (blocks.length === 0) return;

  let fullText = "";
  let cursor = insertIndex;
  const styleRequests: BatchRequest[] = [];

  for (const block of blocks) {
    const paraText = block.segments.map((s) => s.text).join("") + "\n";
    const paraStart = cursor;
    const paraEnd = cursor + paraText.length - 1; // exclude trailing newline from style range

    styleRequests.push(...buildInlineStyleRequests(paraStart, block));

    if (block.style !== "NORMAL") {
      styleRequests.push({
        updateParagraphStyle: {
          range: { startIndex: paraStart, endIndex: paraEnd },
          paragraphStyle: { namedStyleType: block.style },
          fields: "namedStyleType",
        },
      });
    }

    if (block.bullet) {
      styleRequests.push({
        createParagraphBullets: {
          range: { startIndex: paraStart, endIndex: paraEnd },
          bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
        },
      });
    }

    fullText += paraText;
    cursor += paraText.length;
  }

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{ insertText: { location: { index: insertIndex }, text: fullText } }],
    },
  });

  await flushRequests(docs, documentId, styleRequests);
}

function findInsertedTable(
  content: docs_v1.Schema$StructuralElement[],
  atIndex: number
): docs_v1.Schema$StructuralElement | undefined {
  const exact = content.find((el) => el.table && el.startIndex === atIndex);
  if (exact) return exact;

  const nearby = content.find(
    (el) => el.table && el.startIndex != null && el.startIndex >= atIndex - 1 && el.startIndex <= atIndex + 1
  );
  if (nearby) return nearby;

  for (let i = content.length - 1; i >= 0; i--) {
    if (content[i]?.table) return content[i];
  }
  return undefined;
}

function buildTableCellInsertRequests(
  table: docs_v1.Schema$Table,
  rows: string[][]
): BatchRequest[] {
  const inserts: BatchRequest[] = [];

  table.tableRows?.forEach((row, rowIndex) => {
    row.tableCells?.forEach((cell, colIndex) => {
      const cellText = rows[rowIndex]?.[colIndex] ?? "";
      if (!cellText) return;

      const startIndex = cell.content?.[0]?.paragraph?.elements?.[0]?.startIndex;
      if (startIndex == null) return;

      inserts.push({
        insertText: { location: { index: startIndex }, text: cellText },
      });
    });
  });

  return inserts.reverse();
}

function getCellTextRange(
  cell: docs_v1.Schema$TableCell
): { startIndex: number; endIndex: number } | null {
  const elements = cell.content?.[0]?.paragraph?.elements;
  if (!elements?.length) return null;

  const startIndex = elements[0]?.startIndex;
  const endIndex = elements[elements.length - 1]?.endIndex;
  if (startIndex == null || endIndex == null || endIndex <= startIndex) return null;

  return { startIndex, endIndex };
}

function buildTableHeaderStyleRequests(table: docs_v1.Schema$Table): BatchRequest[] {
  const styles: BatchRequest[] = [];
  const headerRow = table.tableRows?.[0];

  headerRow?.tableCells?.forEach((cell) => {
    const range = getCellTextRange(cell);
    if (!range) return;

    styles.push({
      updateTextStyle: {
        range,
        textStyle: { bold: true },
        fields: "bold",
      },
    });
  });

  return styles;
}

async function getNextInsertIndex(
  docs: docs_v1.Docs,
  documentId: string
): Promise<number> {
  const { data } = await docs.documents.get({ documentId });
  const content = data.body?.content ?? [];
  if (content.length === 0) return 1;

  // Google Docs body always ends with a paragraph; append there (never inside a table).
  for (let i = content.length - 1; i >= 0; i--) {
    const element = content[i];
    if (element.paragraph && element.endIndex != null) {
      return element.endIndex - 1;
    }
  }

  const last = content[content.length - 1];
  return (last.endIndex ?? 2) - 1;
}

export async function applyMarkdownContent(
  docs: docs_v1.Docs,
  documentId: string,
  markdown: string
): Promise<void> {
  const elements = parseMarkdownElements(markdown);
  let i = 0;

  while (i < elements.length) {
    if (elements[i].kind === "text") {
      const start = i;
      while (i < elements.length && elements[i].kind === "text") i++;
      const textBlocks = elements.slice(start, i) as TextBlock[];
      const index = await getNextInsertIndex(docs, documentId);
      await applyTextBlocks(docs, documentId, textBlocks, index);
      continue;
    }

    const element = elements[i];
    i += 1;
    if (element.kind !== "table") continue;

    const numRows = element.rows.length;
    const numCols = Math.max(0, ...element.rows.map((row) => row.length));
    if (numRows === 0 || numCols === 0) continue;

    const index = await getNextInsertIndex(docs, documentId);

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertTable: {
              rows: numRows,
              columns: numCols,
              location: { index },
            },
          },
        ],
      },
    });

    const { data } = await docs.documents.get({ documentId });
    const tableElement = findInsertedTable(data.body?.content ?? [], index);
    if (!tableElement?.table) {
      throw new Error("Failed to locate table after insertTable");
    }

    const insertRequests = buildTableCellInsertRequests(tableElement.table, element.rows);
    if (insertRequests.length > 0) {
      await docs.documents.batchUpdate({ documentId, requestBody: { requests: insertRequests } });
    }

    if (element.headerRow) {
      const { data: refreshed } = await docs.documents.get({ documentId });
      const refreshedTable = findInsertedTable(refreshed.body?.content ?? [], index);
      if (refreshedTable?.table) {
        const styleRequests = buildTableHeaderStyleRequests(refreshedTable.table);
        if (styleRequests.length > 0) {
          await docs.documents.batchUpdate({ documentId, requestBody: { requests: styleRequests } });
        }
      }
    }
  }
}

/** @deprecated Use applyMarkdownContent for documents containing tables. */
export function markdownToBatchRequests(markdown: string): BatchRequest[] {
  const elements = parseMarkdownElements(markdown);
  const requests: BatchRequest[] = [];
  let index = 1;

  for (const element of elements) {
    if (element.kind === "text") {
      const text = element.segments.map((s) => s.text).join("") + "\n";
      requests.push({ insertText: { location: { index }, text } });
      requests.push(...buildInlineStyleRequests(index, element));
      index += text.length;
    }
  }

  return requests;
}

export function extractTablesFromMarkdown(markdown: string): TableBlock[] {
  return parseMarkdownElements(markdown).filter((e): e is TableBlock => e.kind === "table");
}
