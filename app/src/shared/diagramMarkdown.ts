import * as yaml from "js-yaml";

import { fail, ok, type RelicResult } from "./result";

const relicDiagramTypes = ["diagram"] as const;
export type RelicDiagramType = typeof relicDiagramTypes[number];

export const relicFreeDrawingShapeTypes = ["terminator", "process", "decision", "input-output", "label", "area"] as const;
export type RelicFreeDrawingShapeType = typeof relicFreeDrawingShapeTypes[number];
export const relicFreeDrawingAreaLayer = 0;
export const relicFreeDrawingShapeLayer = 1;
export const relicFreeDrawingLabelLayer = 2;

export interface RelicFreeDrawingDiagramDocument {
  lines: RelicDiagramLine[];
  nodes: RelicFreeDrawingNode[];
  title?: string;
  type: "diagram";
}

export type RelicConnectedDiagramDocument = RelicFreeDrawingDiagramDocument;
export type RelicDiagramDocument = RelicFreeDrawingDiagramDocument;

export interface RelicDiagramNodeBase {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
}

export interface RelicFreeDrawingNode extends RelicDiagramNodeBase {
  layer: number;
  shape: RelicFreeDrawingShapeType;
  text: string;
}

export type RelicConnectedDiagramNode = RelicFreeDrawingNode;

export interface RelicDiagramLine {
  from: string;
  id: string;
  label: string;
  to: string;
}

export interface RelicDiagramReferenceReplacement {
  content: string;
  count: number;
}

export type RelicDiagramReferenceReplacementKind = "file" | "folder";

export interface RelicDiagramNodeInsertion {
  content: string;
  node: RelicDiagramNodeBase;
}

export interface RelicDiagramNodeMove {
  content: string;
  node: RelicDiagramNodeBase;
}

export interface RelicDiagramNodeResize {
  content: string;
  node: RelicDiagramNodeBase;
}

export interface RelicDiagramLineInsertion {
  content: string;
  line: RelicDiagramLine;
}

export interface RelicDiagramDeletion {
  content: string;
  count: number;
}

export interface RelicDiagramLineLabelUpdate {
  content: string;
  line: RelicDiagramLine;
}

export interface RelicDiagramLineDirectionUpdate {
  content: string;
  line: RelicDiagramLine;
}

export interface RelicFreeDrawingNodeTextUpdate {
  content: string;
  node: RelicFreeDrawingNode;
}

export interface RelicFreeDrawingNodeLayerUpdate {
  content: string;
  node: RelicFreeDrawingNode;
}

interface DiagramFrontmatter {
  formatVersion: number;
  title?: string;
  type: string;
}

interface ParsedDiagramMarkdownParts {
  body: string;
  frontmatter: DiagramFrontmatter;
}

const freeDrawingBodyKeys = new Set(["nodes", "lines"]);
const freeDrawingNodeKeys = new Set(["id", "shape", "text", "x", "y", "width", "height", "layer"]);
const diagramLineKeys = new Set(["id", "from", "to", "label"]);
const currentDiagramFormatVersion = 1;
const diagramFrontmatterKeys = new Set(["type", "title", "formatVersion"]);
const diagramNodeGridSize = 32;
const defaultNodeWidth = diagramNodeGridSize * 5;
const defaultNodeHeight = diagramNodeGridSize * 2;

export const emptyRelicFreeDrawingMarkdownContent = [
  "---",
  "type: diagram",
  "formatVersion: 1",
  "title: 図解ファイル",
  "---",
  "",
  "nodes: []",
  "lines: []",
  ""
].join("\n");

export const emptyRelicDiagramMarkdownContent = emptyRelicFreeDrawingMarkdownContent;

export function isRelicDiagramType(value: unknown): value is RelicDiagramType {
  return typeof value === "string" && relicDiagramTypes.includes(value as typeof relicDiagramTypes[number]);
}

export function isRelicDiagramMarkdownContent(content: string): boolean {
  const parts = parseDiagramMarkdownParts(content);
  return parts.ok && isRelicDiagramType(parts.value.frontmatter.type);
}

export function diagramTypeFromMarkdownContent(content: string): RelicDiagramType | null {
  const parts = parseDiagramMarkdownParts(content);
  return parts.ok && isRelicDiagramType(parts.value.frontmatter.type) ? parts.value.frontmatter.type : null;
}

export function parseRelicDiagramMarkdown(content: string): RelicResult<RelicDiagramDocument> {
  const parts = parseDiagramMarkdownParts(content);
  if (!parts.ok) return parts;

  return parseRelicFreeDrawingMarkdown(content);
}

export function serializeRelicDiagramMarkdown(document: RelicDiagramDocument): RelicResult<string> {
  if (document.type !== "diagram") {
    return fail("DIAGRAM_TYPE_INVALID", "図解ファイルではありません。");
  }

  return serializeRelicFreeDrawingMarkdown(document);
}

export function parseRelicFreeDrawingMarkdown(content: string): RelicResult<RelicFreeDrawingDiagramDocument> {
  const parts = parseDiagramMarkdownParts(content);
  if (!parts.ok) return parts;
  if (parts.value.frontmatter.type !== "diagram") {
    return fail("DIAGRAM_TYPE_INVALID", "図解ファイルではありません。");
  }

  let body: unknown;
  try {
    body = parts.value.body.trim().length > 0
      ? yaml.load(parts.value.body, { schema: yaml.JSON_SCHEMA })
      : {};
  } catch (error) {
    return fail("DIAGRAM_YAML_INVALID", "図解ファイルを読み込めませんでした。", errorDetails(error));
  }

  if (body === null) body = {};
  if (!isRecord(body)) {
    return fail("DIAGRAM_FORMAT_INVALID", "図解ファイルの形式が正しくありません。");
  }

  const migrated = migrateRelicFreeDrawingDocument({
    ...body,
    formatVersion: parts.value.frontmatter.formatVersion,
    title: parts.value.frontmatter.title,
    type: "diagram"
  });
  if (!migrated.ok) return migrated;

  return validateRelicFreeDrawingDocument(migrated.value);
}

export function serializeRelicFreeDrawingMarkdown(document: RelicFreeDrawingDiagramDocument): RelicResult<string> {
  const validated = validateRelicFreeDrawingDocument(document);
  if (!validated.ok) return validated;

  const frontmatter = dumpFrontmatter(validated.value.type, validated.value.title);
  const body = yaml.dump(
    {
      nodes: validated.value.nodes.map((node) => ({
        id: node.id,
        shape: node.shape,
        text: node.text,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        layer: node.layer
      })),
      lines: validated.value.lines.map((line) => ({
        id: line.id,
        from: line.from,
        to: line.to,
        label: line.label
      }))
    },
    yamlDumpOptions()
  ).replace(/\n(\s*)'y':/g, "\n$1y:");

  return ok(`---\n${frontmatter}\n---\n\n${body}`);
}

export function replaceRelicDiagramNodeFileReferences(
  content: string,
  kind: RelicDiagramReferenceReplacementKind,
  oldPath: string,
  newPath: string
): RelicResult<RelicDiagramReferenceReplacement> {
  void kind;
  void oldPath;
  void newPath;
  return ok({ content, count: 0 });
}

export function addRelicFreeDrawingNode(
  content: string,
  shape: RelicFreeDrawingShapeType = "process",
  x?: number,
  y?: number
): RelicResult<RelicDiagramNodeInsertion> {
  const parsed = parseRelicFreeDrawingMarkdown(content);
  if (!parsed.ok) return parsed;

  const node = createFreeDrawingNode(parsed.value, shape, x, y);
  const serialized = serializeRelicFreeDrawingMarkdown({
    ...parsed.value,
    nodes: [...parsed.value.nodes, node]
  });
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    node
  });
}

export function moveRelicDiagramNode(
  content: string,
  nodeId: string,
  x: number,
  y: number
): RelicResult<RelicDiagramNodeMove> {
  const parsed = parseRelicConnectedDiagramMarkdown(content);
  if (!parsed.ok) return parsed;

  const nextX = parseFiniteNumber(x, "DIAGRAM_NODE_X_INVALID", "Nodeの x は数値にしてください。");
  if (!nextX.ok) return nextX;
  const nextY = parseFiniteNumber(y, "DIAGRAM_NODE_Y_INVALID", "Nodeの y は数値にしてください。");
  if (!nextY.ok) return nextY;

  const node = parsed.value.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return fail("DIAGRAM_NODE_MISSING", "移動するNodeが見つかりません。");
  }

  const nextNode = {
    ...node,
    x: Math.round(nextX.value),
    y: Math.round(nextY.value)
  };
  const serialized = serializeRelicConnectedDiagramMarkdown({
    ...parsed.value,
    nodes: parsed.value.nodes.map((item) => item.id === nodeId ? nextNode : item)
  } as RelicConnectedDiagramDocument);
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    node: nextNode
  });
}

export function moveRelicFreeDrawingAreaWithContents(
  content: string,
  nodeId: string,
  x: number,
  y: number
): RelicResult<RelicDiagramNodeMove> {
  const parsed = parseRelicFreeDrawingMarkdown(content);
  if (!parsed.ok) return parsed;

  const nextX = parseFiniteNumber(x, "DIAGRAM_NODE_X_INVALID", "Nodeの x は数値にしてください。");
  if (!nextX.ok) return nextX;
  const nextY = parseFiniteNumber(y, "DIAGRAM_NODE_Y_INVALID", "Nodeの y は数値にしてください。");
  if (!nextY.ok) return nextY;

  const area = parsed.value.nodes.find((item) => item.id === nodeId);
  if (!area) {
    return fail("DIAGRAM_NODE_MISSING", "移動するNodeが見つかりません。");
  }
  if (area.shape !== "area") {
    return fail("DIAGRAM_NODE_SHAPE_INVALID", "領域図形ではありません。");
  }

  const roundedX = Math.round(nextX.value);
  const roundedY = Math.round(nextY.value);
  const deltaX = roundedX - area.x;
  const deltaY = roundedY - area.y;
  const containedNodeIds = new Set(parsed.value.nodes
    .filter((node) => node.id !== area.id && isNodeFullyInsideArea(node, area))
    .map((node) => node.id));
  const nextArea = {
    ...area,
    x: roundedX,
    y: roundedY
  };
  const serialized = serializeRelicFreeDrawingMarkdown({
    ...parsed.value,
    nodes: parsed.value.nodes.map((node) => {
      if (node.id === area.id) return nextArea;
      if (!containedNodeIds.has(node.id)) return node;

      return {
        ...node,
        x: node.x + deltaX,
        y: node.y + deltaY
      };
    })
  });
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    node: nextArea
  });
}

export function resizeRelicDiagramNode(
  content: string,
  nodeId: string,
  width: number,
  height: number
): RelicResult<RelicDiagramNodeResize> {
  const parsed = parseRelicConnectedDiagramMarkdown(content);
  if (!parsed.ok) return parsed;

  const nextWidth = parseFiniteNumber(width, "DIAGRAM_NODE_WIDTH_INVALID", "Nodeの width は数値にしてください。");
  if (!nextWidth.ok) return nextWidth;
  const nextHeight = parseFiniteNumber(height, "DIAGRAM_NODE_HEIGHT_INVALID", "Nodeの height は数値にしてください。");
  if (!nextHeight.ok) return nextHeight;
  if (nextWidth.value <= 0 || nextHeight.value <= 0) {
    return fail("DIAGRAM_NODE_SIZE_INVALID", "Nodeのサイズは0より大きい値にしてください。");
  }

  const node = parsed.value.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return fail("DIAGRAM_NODE_MISSING", "サイズ変更するNodeが見つかりません。");
  }

  const nextNode = {
    ...node,
    height: snapDiagramNodeSize(nextHeight.value),
    width: snapDiagramNodeSize(nextWidth.value)
  };
  const serialized = serializeRelicConnectedDiagramMarkdown({
    ...parsed.value,
    nodes: parsed.value.nodes.map((item) => item.id === nodeId ? nextNode : item)
  } as RelicConnectedDiagramDocument);
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    node: nextNode
  });
}

function snapDiagramNodeSize(value: number): number {
  return Math.max(diagramNodeGridSize, Math.round(value / diagramNodeGridSize) * diagramNodeGridSize);
}

function isNodeFullyInsideArea(node: RelicDiagramNodeBase, area: RelicDiagramNodeBase): boolean {
  return node.x >= area.x &&
    node.y >= area.y &&
    node.x + node.width <= area.x + area.width &&
    node.y + node.height <= area.y + area.height;
}

export function addRelicDiagramLine(
  content: string,
  fromNodeId: string,
  toNodeId: string,
  label = ""
): RelicResult<RelicDiagramLineInsertion> {
  const parsed = parseRelicConnectedDiagramMarkdown(content);
  if (!parsed.ok) return parsed;

  const from = parseRequiredText(fromNodeId, "DIAGRAM_LINE_FROM_INVALID", "Lineの from を指定してください。");
  if (!from.ok) return from;
  const to = parseRequiredText(toNodeId, "DIAGRAM_LINE_TO_INVALID", "Lineの to を指定してください。");
  if (!to.ok) return to;
  if (from.value === to.value) {
    return fail("DIAGRAM_LINE_SELF_INVALID", "同じNode同士をLineでつなげません。");
  }

  const nodeIds = new Set(parsed.value.nodes.map((node) => node.id));
  if (!nodeIds.has(from.value) || !nodeIds.has(to.value)) {
    return fail("DIAGRAM_LINE_NODE_MISSING", "Lineが存在しないNodeを参照しています。");
  }
  if (parsed.value.lines.some((line) => line.from === from.value && line.to === to.value)) {
    return fail("DIAGRAM_LINE_DUPLICATED", "同じ向きのLineはすでに存在します。");
  }
  const nextLabel = parseOptionalText(label, "DIAGRAM_LINE_LABEL_INVALID", "Lineの label は文字にしてください。");
  if (!nextLabel.ok) return nextLabel;

  const line = {
    from: from.value,
    id: nextLineId(parsed.value.lines),
    label: nextLabel.value,
    to: to.value
  };
  const serialized = serializeRelicConnectedDiagramMarkdown({
    ...parsed.value,
    lines: [...parsed.value.lines, line]
  } as RelicConnectedDiagramDocument);
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    line
  });
}

export function removeRelicDiagramNode(content: string, nodeId: string): RelicResult<RelicDiagramDeletion> {
  const parsed = parseRelicConnectedDiagramMarkdown(content);
  if (!parsed.ok) return parsed;

  const id = parseRequiredText(nodeId, "DIAGRAM_NODE_ID_INVALID", "Nodeの id を指定してください。");
  if (!id.ok) return id;

  const nextNodes = parsed.value.nodes.filter((node) => node.id !== id.value);
  if (nextNodes.length === parsed.value.nodes.length) {
    return fail("DIAGRAM_NODE_MISSING", "削除するNodeが見つかりません。");
  }

  const nextLines = parsed.value.lines.filter((line) => line.from !== id.value && line.to !== id.value);
  const serialized = serializeRelicConnectedDiagramMarkdown({
    ...parsed.value,
    lines: nextLines,
    nodes: nextNodes
  } as RelicConnectedDiagramDocument);
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    count: parsed.value.nodes.length - nextNodes.length + parsed.value.lines.length - nextLines.length
  });
}

export function removeRelicDiagramLine(content: string, lineId: string): RelicResult<RelicDiagramDeletion> {
  const parsed = parseRelicConnectedDiagramMarkdown(content);
  if (!parsed.ok) return parsed;

  const id = parseRequiredText(lineId, "DIAGRAM_LINE_ID_INVALID", "Lineの id を指定してください。");
  if (!id.ok) return id;

  const nextLines = parsed.value.lines.filter((line) => line.id !== id.value);
  if (nextLines.length === parsed.value.lines.length) {
    return fail("DIAGRAM_LINE_MISSING", "削除するLineが見つかりません。");
  }

  const serialized = serializeRelicConnectedDiagramMarkdown({
    ...parsed.value,
    lines: nextLines
  } as RelicConnectedDiagramDocument);
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    count: parsed.value.lines.length - nextLines.length
  });
}

export function updateRelicDiagramLineLabel(
  content: string,
  lineId: string,
  label: string
): RelicResult<RelicDiagramLineLabelUpdate> {
  const parsed = parseRelicConnectedDiagramMarkdown(content);
  if (!parsed.ok) return parsed;

  const id = parseRequiredText(lineId, "DIAGRAM_LINE_ID_INVALID", "Lineの id を指定してください。");
  if (!id.ok) return id;
  const nextLabel = parseOptionalText(label, "DIAGRAM_LINE_LABEL_INVALID", "Lineの label は文字にしてください。");
  if (!nextLabel.ok) return nextLabel;

  const line = parsed.value.lines.find((item) => item.id === id.value);
  if (!line) {
    return fail("DIAGRAM_LINE_MISSING", "Lineラベルを変更するLineが見つかりません。");
  }

  const nextLine = {
    ...line,
    label: nextLabel.value
  };
  const serialized = serializeRelicConnectedDiagramMarkdown({
    ...parsed.value,
    lines: parsed.value.lines.map((item) => item.id === id.value ? nextLine : item)
  } as RelicConnectedDiagramDocument);
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    line: nextLine
  });
}

export function reverseRelicDiagramLineDirection(
  content: string,
  lineId: string
): RelicResult<RelicDiagramLineDirectionUpdate> {
  const parsed = parseRelicConnectedDiagramMarkdown(content);
  if (!parsed.ok) return parsed;

  const id = parseRequiredText(lineId, "DIAGRAM_LINE_ID_INVALID", "Lineの id を指定してください。");
  if (!id.ok) return id;

  const line = parsed.value.lines.find((item) => item.id === id.value);
  if (!line) {
    return fail("DIAGRAM_LINE_MISSING", "向きを変更するLineが見つかりません。");
  }
  if (parsed.value.lines.some((item) => item.id !== id.value && item.from === line.to && item.to === line.from)) {
    return fail("DIAGRAM_LINE_DUPLICATED", "逆方向のLineはすでに存在します。");
  }

  const nextLine = {
    ...line,
    from: line.to,
    to: line.from
  };
  const serialized = serializeRelicConnectedDiagramMarkdown({
    ...parsed.value,
    lines: parsed.value.lines.map((item) => item.id === id.value ? nextLine : item)
  } as RelicConnectedDiagramDocument);
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    line: nextLine
  });
}

export function updateRelicFreeDrawingNodeText(
  content: string,
  nodeId: string,
  text: string
): RelicResult<RelicFreeDrawingNodeTextUpdate> {
  const parsed = parseRelicFreeDrawingMarkdown(content);
  if (!parsed.ok) return parsed;

  const id = parseRequiredText(nodeId, "DIAGRAM_NODE_ID_INVALID", "Nodeの id を指定してください。");
  if (!id.ok) return id;
  const nextText = parseOptionalText(text, "DIAGRAM_NODE_TEXT_INVALID", "Nodeの text は文字にしてください。");
  if (!nextText.ok) return nextText;

  const node = parsed.value.nodes.find((item) => item.id === id.value);
  if (!node) {
    return fail("DIAGRAM_NODE_MISSING", "変更するNodeが見つかりません。");
  }

  const nextNode = {
    ...node,
    text: nextText.value
  };
  const serialized = serializeRelicFreeDrawingMarkdown({
    ...parsed.value,
    nodes: parsed.value.nodes.map((item) => item.id === id.value ? nextNode : item)
  });
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    node: nextNode
  });
}

export function updateRelicFreeDrawingNodeLayer(
  content: string,
  nodeId: string,
  layer: number
): RelicResult<RelicFreeDrawingNodeLayerUpdate> {
  const parsed = parseRelicFreeDrawingMarkdown(content);
  if (!parsed.ok) return parsed;

  const id = parseRequiredText(nodeId, "DIAGRAM_NODE_ID_INVALID", "Nodeの id を指定してください。");
  if (!id.ok) return id;
  const nextLayer = parseFiniteNumber(layer, "DIAGRAM_NODE_LAYER_INVALID", "Nodeの layer は数値にしてください。");
  if (!nextLayer.ok) return nextLayer;

  const node = parsed.value.nodes.find((item) => item.id === id.value);
  if (!node) {
    return fail("DIAGRAM_NODE_MISSING", "変更するNodeが見つかりません。");
  }

  const nextNode = {
    ...node,
    layer: normalizeFreeDrawingNodeLayer(node.shape, nextLayer.value)
  };
  const serialized = serializeRelicFreeDrawingMarkdown({
    ...parsed.value,
    nodes: parsed.value.nodes.map((item) => item.id === id.value ? nextNode : item)
  });
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    node: nextNode
  });
}

function validateRelicFreeDrawingDocument(raw: unknown): RelicResult<RelicFreeDrawingDiagramDocument> {
  if (!isRecord(raw)) {
    return fail("DIAGRAM_FORMAT_INVALID", "図解ファイルの形式が正しくありません。");
  }
  if (raw.type !== "diagram") {
    return fail("DIAGRAM_TYPE_INVALID", "図解ファイルではありません。");
  }

  const title = raw.title === undefined ? undefined : parseOptionalText(raw.title, "DIAGRAM_TITLE_INVALID", "図解の title は文字にしてください。");
  if (title && !title.ok) return title;

  const allowedTopLevelKeys = new Set([...freeDrawingBodyKeys, ...diagramFrontmatterKeys]);
  const unknownTopLevelKey = Object.keys(raw).find((key) => !allowedTopLevelKeys.has(key));
  if (unknownTopLevelKey) {
    return fail("DIAGRAM_UNKNOWN_FIELD", `図解ファイルに未対応の項目があります: ${unknownTopLevelKey}`);
  }

  const nodes = parseFreeDrawingNodes(raw.nodes);
  if (!nodes.ok) return nodes;

  const lines = parseLines(raw.lines, nodes.value);
  if (!lines.ok) return lines;

  return ok({
    lines: lines.value,
    nodes: nodes.value,
    ...(title?.value ? { title: title.value } : {}),
    type: "diagram"
  });
}

function parseDiagramMarkdownParts(content: string): RelicResult<ParsedDiagramMarkdownParts> {
  const normalizedContent = content.replace(/\r\n/g, "\n");
  if (!normalizedContent.startsWith("---\n")) {
    return fail("DIAGRAM_MARKER_MISSING", "図解ファイルの先頭にはYAMLフロントマターを置いてください。");
  }

  const endIndex = normalizedContent.indexOf("\n---", 4);
  if (endIndex < 0) {
    return fail("DIAGRAM_FRONTMATTER_INVALID", "図解ファイルのフロントマターを閉じてください。");
  }

  const endLineIndex = normalizedContent.indexOf("\n", endIndex + 4);
  const frontmatterRaw = normalizedContent.slice(4, endIndex);
  const body = endLineIndex < 0 ? "" : normalizedContent.slice(endLineIndex + 1);

  let parsed: unknown;
  try {
    parsed = yaml.load(frontmatterRaw, { schema: yaml.JSON_SCHEMA });
  } catch (error) {
    return fail("DIAGRAM_FRONTMATTER_YAML_INVALID", "図解ファイルのフロントマターを読み込めませんでした。", errorDetails(error));
  }

  if (!isRecord(parsed)) {
    return fail("DIAGRAM_FRONTMATTER_INVALID", "図解ファイルのフロントマターが正しくありません。");
  }

  const unknownKey = Object.keys(parsed).find((key) => !diagramFrontmatterKeys.has(key));
  if (unknownKey) {
    return fail("DIAGRAM_FRONTMATTER_UNKNOWN_FIELD", `図解フロントマターに未対応の項目があります: ${unknownKey}`);
  }

  const type = parseDiagramType(parsed.type);
  if (!type.ok) return type;
  const formatVersion = parseDiagramFormatVersion(parsed.formatVersion);
  if (!formatVersion.ok) return formatVersion;
  const title = parsed.title === undefined ? undefined : parseOptionalText(parsed.title, "DIAGRAM_TITLE_INVALID", "図解の title は文字にしてください。");
  if (title && !title.ok) return title;

  return ok({
    body,
    frontmatter: {
      formatVersion: formatVersion.value,
      ...(title?.value ? { title: title.value } : {}),
      type: type.value
    }
  });
}

function parseRelicConnectedDiagramMarkdown(content: string): RelicResult<RelicConnectedDiagramDocument> {
  const type = diagramTypeFromMarkdownContent(content);
  if (type === "diagram") return parseRelicFreeDrawingMarkdown(content);
  return fail("DIAGRAM_TYPE_INVALID", "図解ファイルではありません。");
}

function migrateRelicFreeDrawingDocument(raw: Record<string, unknown>): RelicResult<Record<string, unknown>> {
  if (raw.formatVersion === currentDiagramFormatVersion) return ok(raw);
  if (raw.formatVersion !== 0) {
    return fail("DIAGRAM_FORMAT_VERSION_UNSUPPORTED", "このRelicでは対応していないDiagram形式です。");
  }

  return ok({
    ...raw,
    formatVersion: currentDiagramFormatVersion,
    lines: raw.lines ?? [],
    nodes: migrateV0DiagramNodes(raw.nodes)
  });
}

function migrateV0DiagramNodes(rawNodes: unknown): unknown {
  if (rawNodes === undefined) return [];
  if (!Array.isArray(rawNodes)) return rawNodes;

  return rawNodes.map((rawNode) => {
    if (!isRecord(rawNode)) return rawNode;

    const shape = rawNode.shape ?? "process";
    return {
      ...rawNode,
      shape,
      layer: shape === "area" ? relicFreeDrawingAreaLayer : relicFreeDrawingShapeLayer
    };
  });
}

function serializeRelicConnectedDiagramMarkdown(document: RelicConnectedDiagramDocument): RelicResult<string> {
  if (document.type !== "diagram") {
    return fail("DIAGRAM_TYPE_INVALID", "図解ファイルではありません。");
  }

  return serializeRelicFreeDrawingMarkdown(document);
}

function parseFreeDrawingNodes(rawNodes: unknown): RelicResult<RelicFreeDrawingNode[]> {
  if (rawNodes === undefined) return ok([]);
  if (!Array.isArray(rawNodes)) {
    return fail("DIAGRAM_NODES_INVALID", "図解ファイルのnodesは一覧にしてください。");
  }

  const nodeIds = new Set<string>();
  const nodes: RelicFreeDrawingNode[] = [];

  for (const [index, rawNode] of rawNodes.entries()) {
    if (!isRecord(rawNode)) {
      return fail("DIAGRAM_NODE_INVALID", `nodes の ${index + 1} 件目が正しくありません。`);
    }

    const unknownKey = firstUnknownKey(rawNode, freeDrawingNodeKeys);
    if (unknownKey) {
      return fail("DIAGRAM_NODE_UNKNOWN_FIELD", `Nodeに未対応の項目があります: ${unknownKey}`);
    }

    const id = parseRequiredText(rawNode.id, "DIAGRAM_NODE_ID_INVALID", "Nodeの id を指定してください。");
    if (!id.ok) return id;
    if (nodeIds.has(id.value)) {
      return fail("DIAGRAM_NODE_DUPLICATED", `同じNode idが使われています: ${id.value}`);
    }

    const text = parseOptionalText(rawNode.text, "DIAGRAM_NODE_TEXT_INVALID", "Nodeの text は文字にしてください。");
    if (!text.ok) return text;
    const shape = parseFreeDrawingShapeType(rawNode.shape);
    if (!shape.ok) return shape;
    const x = parseFiniteNumber(rawNode.x, "DIAGRAM_NODE_X_INVALID", "Nodeの x は数値にしてください。");
    if (!x.ok) return x;
    const y = parseFiniteNumber(rawNode.y, "DIAGRAM_NODE_Y_INVALID", "Nodeの y は数値にしてください。");
    if (!y.ok) return y;
    const width = parsePositiveNumber(rawNode.width, "DIAGRAM_NODE_WIDTH_INVALID", "Nodeの width は0より大きい数値にしてください。");
    if (!width.ok) return width;
    const height = parsePositiveNumber(rawNode.height, "DIAGRAM_NODE_HEIGHT_INVALID", "Nodeの height は0より大きい数値にしてください。");
    if (!height.ok) return height;
    const layer = parseOptionalLayer(rawNode.layer);
    if (!layer.ok) return layer;

    nodeIds.add(id.value);
    nodes.push({
      height: height.value,
      id: id.value,
      layer: normalizeFreeDrawingNodeLayer(shape.value, layer.value),
      shape: shape.value,
      text: text.value,
      width: width.value,
      x: x.value,
      y: y.value
    });
  }

  return ok(nodes);
}

function parseLines(rawLines: unknown, nodes: RelicDiagramNodeBase[]): RelicResult<RelicDiagramLine[]> {
  if (rawLines === undefined) return ok([]);
  if (!Array.isArray(rawLines)) {
    return fail("DIAGRAM_LINES_INVALID", "図解ファイルのlinesは一覧にしてください。");
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const lineIds = new Set<string>();
  const lineDirections = new Set<string>();
  const linePairCounts = new Map<string, number>();
  const lines: RelicDiagramLine[] = [];

  for (const [index, rawLine] of rawLines.entries()) {
    if (!isRecord(rawLine)) {
      return fail("DIAGRAM_LINE_INVALID", `lines の ${index + 1} 件目が正しくありません。`);
    }

    const unknownKey = firstUnknownKey(rawLine, diagramLineKeys);
    if (unknownKey) {
      return fail("DIAGRAM_LINE_UNKNOWN_FIELD", `Lineに未対応の項目があります: ${unknownKey}`);
    }

    const id = parseRequiredText(rawLine.id, "DIAGRAM_LINE_ID_INVALID", "Lineの id を指定してください。");
    if (!id.ok) return id;
    if (lineIds.has(id.value)) {
      return fail("DIAGRAM_LINE_DUPLICATED", `同じLine idが使われています: ${id.value}`);
    }

    const from = parseRequiredText(rawLine.from, "DIAGRAM_LINE_FROM_INVALID", "Lineの from を指定してください。");
    if (!from.ok) return from;
    const to = parseRequiredText(rawLine.to, "DIAGRAM_LINE_TO_INVALID", "Lineの to を指定してください。");
    if (!to.ok) return to;
    if (from.value === to.value) {
      return fail("DIAGRAM_LINE_SELF_INVALID", "同じNode同士をLineでつなげません。");
    }
    if (!nodeIds.has(from.value) || !nodeIds.has(to.value)) {
      return fail("DIAGRAM_LINE_NODE_MISSING", "Lineが存在しないNodeを参照しています。");
    }
    const directionKey = diagramLineDirectionKey(from.value, to.value);
    if (lineDirections.has(directionKey)) {
      return fail("DIAGRAM_LINE_DUPLICATED", "同じ向きのLineはすでに存在します。");
    }
    const pairKey = diagramLinePairKey(from.value, to.value);
    const pairCount = linePairCounts.get(pairKey) ?? 0;
    if (pairCount >= 2) {
      return fail("DIAGRAM_LINE_PAIR_LIMIT", "同じNode一対のLineは2本までにしてください。");
    }

    const label = parseOptionalText(rawLine.label, "DIAGRAM_LINE_LABEL_INVALID", "Lineの label は文字にしてください。");
    if (!label.ok) return label;

    lineIds.add(id.value);
    lineDirections.add(directionKey);
    linePairCounts.set(pairKey, pairCount + 1);
    lines.push({
      from: from.value,
      id: id.value,
      label: label.value,
      to: to.value
    });
  }

  return ok(lines);
}

function diagramLineDirectionKey(from: string, to: string): string {
  return `${from}\u0000${to}`;
}

function diagramLinePairKey(from: string, to: string): string {
  return from < to ? diagramLineDirectionKey(from, to) : diagramLineDirectionKey(to, from);
}

function createFreeDrawingNode(
  diagram: RelicFreeDrawingDiagramDocument,
  shape: RelicFreeDrawingShapeType,
  x?: number,
  y?: number
): RelicFreeDrawingNode {
  const size = defaultFreeDrawingShapeSize(shape);
  const position = x === undefined || y === undefined
    ? nextNodePosition(diagram.nodes)
    : { x, y };

  return {
    height: size.height,
    id: nextNodeId(diagram.nodes),
    layer: defaultFreeDrawingShapeLayer(shape),
    shape,
    text: defaultFreeDrawingShapeText(shape),
    width: size.width,
    ...position
  };
}

function defaultFreeDrawingShapeText(shape: RelicFreeDrawingShapeType): string {
  if (shape === "area") return "領域";
  if (shape === "terminator") return "開始/終了";
  if (shape === "decision") return "判断";
  if (shape === "input-output") return "入出力";
  if (shape === "label") return "ラベル";
  return "処理";
}

function defaultFreeDrawingShapeSize(shape: RelicFreeDrawingShapeType): Pick<RelicDiagramNodeBase, "height" | "width"> {
  if (shape === "area") {
    return {
      height: 224,
      width: 384
    };
  }

  return {
    height: defaultNodeHeight,
    width: defaultNodeWidth
  };
}

function defaultFreeDrawingShapeLayer(shape: RelicFreeDrawingShapeType): number {
  return shape === "area" ? relicFreeDrawingAreaLayer : relicFreeDrawingShapeLayer;
}

function normalizeFreeDrawingNodeLayer(shape: RelicFreeDrawingShapeType, _layer: number): number {
  if (shape === "area") return relicFreeDrawingAreaLayer;

  return relicFreeDrawingShapeLayer;
}

function nextNodeId(nodes: RelicDiagramNodeBase[]): string {
  const usedIds = new Set(nodes.map((node) => node.id));
  let index = 1;

  while (usedIds.has(`node-${index}`)) {
    index += 1;
  }

  return `node-${index}`;
}

function nextNodePosition(nodes: RelicDiagramNodeBase[]): Pick<RelicDiagramNodeBase, "x" | "y"> {
  if (nodes.length === 0) {
    return { x: 360, y: 270 };
  }

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  const base = {
    x: Math.round((minX + maxX) / 2 - defaultNodeWidth / 2),
    y: Math.round((minY + maxY) / 2 - defaultNodeHeight / 2)
  };

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = {
      x: base.x + attempt * 32,
      y: base.y + attempt * 24
    };
    if (!nodes.some((node) => rectanglesOverlap(
      candidate.x,
      candidate.y,
      defaultNodeWidth,
      defaultNodeHeight,
      node.x,
      node.y,
      node.width,
      node.height
    ))) {
      return candidate;
    }
  }

  return {
    x: base.x + nodes.length * 32,
    y: base.y + nodes.length * 24
  };
}

function rectanglesOverlap(
  leftX: number,
  leftY: number,
  leftWidth: number,
  leftHeight: number,
  rightX: number,
  rightY: number,
  rightWidth: number,
  rightHeight: number
): boolean {
  return leftX < rightX + rightWidth &&
    leftX + leftWidth > rightX &&
    leftY < rightY + rightHeight &&
    leftY + leftHeight > rightY;
}

function nextLineId(lines: RelicDiagramLine[]): string {
  const usedIds = new Set(lines.map((line) => line.id));
  let index = 1;

  while (usedIds.has(`line-${index}`)) {
    index += 1;
  }

  return `line-${index}`;
}

function parseDiagramType(raw: unknown): RelicResult<string> {
  if (!isRelicDiagramType(raw)) {
    return fail("DIAGRAM_TYPE_INVALID", "図解ファイルの type は diagram にしてください。");
  }

  return ok(raw);
}

function parseDiagramFormatVersion(raw: unknown): RelicResult<number> {
  if (raw === undefined) return ok(0);
  if (!Number.isInteger(raw) || Number(raw) < 0) {
    return fail("DIAGRAM_FORMAT_VERSION_INVALID", "図解ファイルの formatVersion は0以上の整数にしてください。");
  }
  if (Number(raw) > currentDiagramFormatVersion) {
    return fail("DIAGRAM_FORMAT_VERSION_UNSUPPORTED", "このRelicでは対応していないDiagram形式です。");
  }

  return ok(Number(raw));
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

function parseFreeDrawingShapeType(raw: unknown): RelicResult<RelicFreeDrawingShapeType> {
  if (raw === undefined) return ok("process");
  if (typeof raw !== "string" || !relicFreeDrawingShapeTypes.includes(raw as RelicFreeDrawingShapeType)) {
    return fail("DIAGRAM_NODE_SHAPE_INVALID", "図解ファイルのNode shape は対応する図形名にしてください。");
  }

  return ok(raw as RelicFreeDrawingShapeType);
}

function parseOptionalLayer(raw: unknown): RelicResult<number> {
  if (raw === undefined) return ok(0);
  const parsed = parseFiniteNumber(raw, "DIAGRAM_NODE_LAYER_INVALID", "Nodeの layer は数値にしてください。");
  if (!parsed.ok) return parsed;

  return ok(Math.round(parsed.value));
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

function dumpFrontmatter(type: string, title: string | undefined): string {
  return yaml.dump(
    {
      type,
      formatVersion: currentDiagramFormatVersion,
      ...(title ? { title } : {})
    },
    yamlDumpOptions()
  ).trimEnd();
}

function yamlDumpOptions(): yaml.DumpOptions {
  return {
    lineWidth: -1,
    noRefs: true,
    schema: yaml.JSON_SCHEMA,
    sortKeys: false
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstUnknownKey(record: Record<string, unknown>, knownKeys: Set<string>): string | null {
  for (const key of Object.keys(record)) {
    if (!knownKeys.has(key)) return key;
  }

  return null;
}

function errorDetails(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
