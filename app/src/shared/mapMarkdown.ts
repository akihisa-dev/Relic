import * as yaml from "js-yaml";

import { fail, ok, type RelicResult } from "./result";

export interface RelicMapDocument {
  lines: RelicMapLine[];
  nodes: RelicMapNode[];
  type: "map";
}

export interface RelicMapNode {
  file: string;
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
}

export interface RelicMapLine {
  from: string;
  id: string;
  label: string;
  to: string;
}

export interface RelicMapReferenceReplacement {
  content: string;
  count: number;
}

export type RelicMapReferenceReplacementKind = "file" | "folder";

const mapTopLevelKeys = new Set(["type", "nodes", "lines"]);
const mapNodeKeys = new Set(["id", "file", "x", "y", "width", "height"]);
const mapLineKeys = new Set(["id", "from", "to", "label"]);

export function isRelicMapMarkdownContent(content: string): boolean {
  return firstLine(content).trim() === "type: map";
}

export function parseRelicMapMarkdown(content: string): RelicResult<RelicMapDocument> {
  const normalizedContent = content.replace(/\r\n/g, "\n");
  if (!isRelicMapMarkdownContent(normalizedContent)) {
    return fail("MAP_MARKER_MISSING", "Mapファイルの先頭行は type: map にしてください。");
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(normalizedContent, { schema: yaml.JSON_SCHEMA });
  } catch (error) {
    return fail("MAP_YAML_INVALID", "Mapファイルを読み込めませんでした。", errorDetails(error));
  }

  if (!isRecord(parsed)) {
    return fail("MAP_FORMAT_INVALID", "Mapファイルの形式が正しくありません。");
  }

  return validateRelicMapDocument(parsed);
}

export function serializeRelicMapMarkdown(document: RelicMapDocument): RelicResult<string> {
  const validated = validateRelicMapDocument(document);
  if (!validated.ok) return validated;

  const body = yaml.dump(
    {
      nodes: validated.value.nodes.map((node) => ({
        id: node.id,
        file: node.file,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height
      })),
      lines: validated.value.lines.map((line) => ({
        id: line.id,
        from: line.from,
        to: line.to,
        label: line.label
      }))
    },
    {
      lineWidth: -1,
      noRefs: true,
      schema: yaml.JSON_SCHEMA,
      sortKeys: false
    }
  ).replace(/\n(\s*)'y':/g, "\n$1y:");

  return ok(`type: map\n\n${body}`);
}

export function replaceRelicMapNodeFileReferences(
  content: string,
  kind: RelicMapReferenceReplacementKind,
  oldPath: string,
  newPath: string
): RelicResult<RelicMapReferenceReplacement> {
  if (!isRelicMapMarkdownContent(content)) {
    return ok({ content, count: 0 });
  }

  const parsed = parseRelicMapMarkdown(content);
  if (!parsed.ok) return parsed;

  const replacement = replaceMapNodeFilePaths(parsed.value, kind, oldPath, newPath);
  if (replacement.count === 0) {
    return ok({ content, count: 0 });
  }

  const serialized = serializeRelicMapMarkdown(replacement.map);
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    count: replacement.count
  });
}

export function validateRelicMapDocument(raw: unknown): RelicResult<RelicMapDocument> {
  if (!isRecord(raw)) {
    return fail("MAP_FORMAT_INVALID", "Mapファイルの形式が正しくありません。");
  }

  const unknownTopLevelKey = Object.keys(raw).find((key) => !mapTopLevelKeys.has(key));
  if (unknownTopLevelKey) {
    return fail("MAP_UNKNOWN_FIELD", `Mapファイルに未対応の項目があります: ${unknownTopLevelKey}`);
  }

  if (raw.type !== "map") {
    return fail("MAP_TYPE_INVALID", "Mapファイルの type は map にしてください。");
  }

  const nodes = parseNodes(raw.nodes);
  if (!nodes.ok) return nodes;

  const lines = parseLines(raw.lines, nodes.value);
  if (!lines.ok) return lines;

  return ok({
    lines: lines.value,
    nodes: nodes.value,
    type: "map"
  });
}

function replaceMapNodeFilePaths(
  map: RelicMapDocument,
  kind: RelicMapReferenceReplacementKind,
  oldPath: string,
  newPath: string
): { count: number; map: RelicMapDocument } {
  const normalizedOldPath = oldPath.replace(/\\/g, "/");
  const normalizedNewPath = newPath.replace(/\\/g, "/");
  const oldFolderPrefix = `${normalizedOldPath.replace(/\/$/, "")}/`;
  const newFolderPrefix = `${normalizedNewPath.replace(/\/$/, "")}/`;
  let count = 0;

  const nodes = map.nodes.map((node) => {
    const nextFile = kind === "file"
      ? node.file === normalizedOldPath ? normalizedNewPath : node.file
      : node.file.startsWith(oldFolderPrefix) ? `${newFolderPrefix}${node.file.slice(oldFolderPrefix.length)}` : node.file;

    if (nextFile === node.file) return node;
    count += 1;
    return {
      ...node,
      file: nextFile
    };
  });

  return {
    count,
    map: {
      ...map,
      nodes
    }
  };
}

function parseNodes(rawNodes: unknown): RelicResult<RelicMapNode[]> {
  if (rawNodes === undefined) return ok([]);
  if (!Array.isArray(rawNodes)) {
    return fail("MAP_NODES_INVALID", "Mapファイルの nodes は一覧にしてください。");
  }

  const nodeIds = new Set<string>();
  const nodes: RelicMapNode[] = [];

  for (const [index, rawNode] of rawNodes.entries()) {
    if (!isRecord(rawNode)) {
      return fail("MAP_NODE_INVALID", `nodes の ${index + 1} 件目が正しくありません。`);
    }

    const unknownKey = Object.keys(rawNode).find((key) => !mapNodeKeys.has(key));
    if (unknownKey) {
      return fail("MAP_NODE_UNKNOWN_FIELD", `Nodeに未対応の項目があります: ${unknownKey}`);
    }

    const id = parseRequiredText(rawNode.id, "MAP_NODE_ID_INVALID", "Nodeの id を指定してください。");
    if (!id.ok) return id;
    if (nodeIds.has(id.value)) {
      return fail("MAP_NODE_DUPLICATED", `同じNode idが使われています: ${id.value}`);
    }

    const file = parseNodeFilePath(rawNode.file);
    if (!file.ok) return file;

    const x = parseFiniteNumber(rawNode.x, "MAP_NODE_X_INVALID", "Nodeの x は数値にしてください。");
    if (!x.ok) return x;
    const y = parseFiniteNumber(rawNode.y, "MAP_NODE_Y_INVALID", "Nodeの y は数値にしてください。");
    if (!y.ok) return y;
    const width = parsePositiveNumber(rawNode.width, "MAP_NODE_WIDTH_INVALID", "Nodeの width は0より大きい数値にしてください。");
    if (!width.ok) return width;
    const height = parsePositiveNumber(rawNode.height, "MAP_NODE_HEIGHT_INVALID", "Nodeの height は0より大きい数値にしてください。");
    if (!height.ok) return height;

    nodeIds.add(id.value);
    nodes.push({
      file: file.value,
      height: height.value,
      id: id.value,
      width: width.value,
      x: x.value,
      y: y.value
    });
  }

  return ok(nodes);
}

function parseLines(rawLines: unknown, nodes: RelicMapNode[]): RelicResult<RelicMapLine[]> {
  if (rawLines === undefined) return ok([]);
  if (!Array.isArray(rawLines)) {
    return fail("MAP_LINES_INVALID", "Mapファイルの lines は一覧にしてください。");
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const lineIds = new Set<string>();
  const nodePairs = new Set<string>();
  const lines: RelicMapLine[] = [];

  for (const [index, rawLine] of rawLines.entries()) {
    if (!isRecord(rawLine)) {
      return fail("MAP_LINE_INVALID", `lines の ${index + 1} 件目が正しくありません。`);
    }

    const unknownKey = Object.keys(rawLine).find((key) => !mapLineKeys.has(key));
    if (unknownKey) {
      return fail("MAP_LINE_UNKNOWN_FIELD", `Lineに未対応の項目があります: ${unknownKey}`);
    }

    const id = parseRequiredText(rawLine.id, "MAP_LINE_ID_INVALID", "Lineの id を指定してください。");
    if (!id.ok) return id;
    if (lineIds.has(id.value)) {
      return fail("MAP_LINE_DUPLICATED", `同じLine idが使われています: ${id.value}`);
    }

    const from = parseRequiredText(rawLine.from, "MAP_LINE_FROM_INVALID", "Lineの from を指定してください。");
    if (!from.ok) return from;
    const to = parseRequiredText(rawLine.to, "MAP_LINE_TO_INVALID", "Lineの to を指定してください。");
    if (!to.ok) return to;
    if (from.value === to.value) {
      return fail("MAP_LINE_SELF_INVALID", "同じNode同士をLineでつなげません。");
    }
    if (!nodeIds.has(from.value) || !nodeIds.has(to.value)) {
      return fail("MAP_LINE_NODE_MISSING", "Lineが存在しないNodeを参照しています。");
    }

    const pairKey = [from.value, to.value].sort().join("\0");
    if (nodePairs.has(pairKey)) {
      return fail("MAP_LINE_PAIR_DUPLICATED", "同じNode同士のLineが重複しています。");
    }

    const label = parseOptionalText(rawLine.label, "MAP_LINE_LABEL_INVALID", "Lineの label は文字にしてください。");
    if (!label.ok) return label;

    lineIds.add(id.value);
    nodePairs.add(pairKey);
    lines.push({
      from: from.value,
      id: id.value,
      label: label.value,
      to: to.value
    });
  }

  return ok(lines);
}

function parseRequiredText(raw: unknown, code: string, message: string): RelicResult<string> {
  if (typeof raw !== "string" || raw.trim() !== raw || raw.length === 0) {
    return fail(code, message);
  }

  return ok(raw);
}

function parseOptionalText(raw: unknown, code: string, message: string): RelicResult<string> {
  if (raw === undefined) return ok("");
  if (typeof raw !== "string") return fail(code, message);

  return ok(raw);
}

function parseFiniteNumber(raw: unknown, code: string, message: string): RelicResult<number> {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fail(code, message);
  }

  return ok(raw);
}

function parsePositiveNumber(raw: unknown, code: string, message: string): RelicResult<number> {
  const parsed = parseFiniteNumber(raw, code, message);
  if (!parsed.ok) return parsed;
  if (parsed.value <= 0) return fail(code, message);

  return parsed;
}

function parseNodeFilePath(raw: unknown): RelicResult<string> {
  const parsed = parseRequiredText(raw, "MAP_NODE_FILE_INVALID", "Nodeの file はMarkdownファイルの相対パスにしてください。");
  if (!parsed.ok) return parsed;
  const filePath = parsed.value;

  if (
    filePath.includes("\0") ||
    filePath.includes("\\") ||
    filePath.startsWith("/") ||
    filePath.split("/").some((segment) => segment === "" || segment === "." || segment === "..") ||
    !filePath.toLowerCase().endsWith(".md")
  ) {
    return fail("MAP_NODE_FILE_INVALID", "Nodeの file はMarkdownファイルの相対パスにしてください。");
  }

  return ok(filePath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstLine(content: string): string {
  const newlineIndex = content.indexOf("\n");
  return newlineIndex < 0 ? content : content.slice(0, newlineIndex);
}

function errorDetails(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
