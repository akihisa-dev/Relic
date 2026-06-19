import * as yaml from "js-yaml";

import { fail, ok, type RelicResult } from "./result";

const relicDiagramTypes = ["diagram"] as const;
export type RelicDiagramType = typeof relicDiagramTypes[number];

export const relicFreeDrawingShapeTypes = ["terminator", "process", "decision", "input-output", "area"] as const;
export type RelicFreeDrawingShapeType = typeof relicFreeDrawingShapeTypes[number];
export const relicFreeDrawingAreaLayer = 0;
export const relicFreeDrawingShapeLayer = 1;
export const relicFreeDrawingLabelLayer = 2;
export const relicDiagramNodeColorPresets = ["blue", "green", "yellow", "red", "gray"] as const;
export type RelicDiagramNodeColorPreset = typeof relicDiagramNodeColorPresets[number];
export const relicDiagramTextSizes = ["small", "normal", "large"] as const;
export type RelicDiagramTextSize = typeof relicDiagramTextSizes[number];
export const relicDiagramHorizontalAlignments = ["left", "center", "right"] as const;
export type RelicDiagramHorizontalAlignment = typeof relicDiagramHorizontalAlignments[number];
export const relicDiagramVerticalAlignments = ["top", "center", "bottom"] as const;
export type RelicDiagramVerticalAlignment = typeof relicDiagramVerticalAlignments[number];
export const relicDiagramPaperSizes = ["A4", "A3", "Letter", "Legal"] as const;
export type RelicDiagramPaperSize = typeof relicDiagramPaperSizes[number];
export const relicDiagramPrintOrientations = ["portrait", "landscape"] as const;
export type RelicDiagramPrintOrientation = typeof relicDiagramPrintOrientations[number];
export const relicDiagramPrintMarginPresets = ["none", "small", "normal", "large"] as const;
export type RelicDiagramPrintMarginPreset = typeof relicDiagramPrintMarginPresets[number];
export const relicDiagramPrintScaleModes = ["fit", "width", "actual"] as const;
export type RelicDiagramPrintScaleMode = typeof relicDiagramPrintScaleModes[number];

export interface RelicDiagramPrintArea {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface RelicDiagramPrintSettings {
  marginPreset: RelicDiagramPrintMarginPreset;
  orientation: RelicDiagramPrintOrientation;
  paperSize: RelicDiagramPaperSize;
  scale: number;
  scaleMode: RelicDiagramPrintScaleMode;
}

export interface RelicFreeDrawingDiagramDocument {
  lines: RelicDiagramLine[];
  nodes: RelicFreeDrawingNode[];
  printArea?: RelicDiagramPrintArea;
  printSettings?: RelicDiagramPrintSettings;
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
  color?: RelicDiagramNodeColorPreset;
  layer: number;
  shape: RelicFreeDrawingShapeType;
  text: string;
  textAlign?: RelicDiagramHorizontalAlignment;
  textSize?: RelicDiagramTextSize;
  verticalAlign?: RelicDiagramVerticalAlignment;
}

export type RelicConnectedDiagramNode = RelicFreeDrawingNode;

export interface RelicDiagramLine {
  from: string;
  id: string;
  label: string;
  labelTextSize?: RelicDiagramTextSize;
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

export interface RelicDiagramLineEndpointUpdate {
  content: string;
  line: RelicDiagramLine;
}

export interface RelicFreeDrawingNodeTextUpdate {
  content: string;
  node: RelicFreeDrawingNode;
}

export interface RelicFreeDrawingNodeShapeUpdate {
  content: string;
  node: RelicFreeDrawingNode;
}

export interface RelicFreeDrawingNodeLayerUpdate {
  content: string;
  node: RelicFreeDrawingNode;
}

export interface RelicDiagramDuplicate {
  content: string;
  lineIds: string[];
  nodeIds: string[];
}

export interface RelicDiagramMultiNodeUpdate {
  content: string;
  nodeIds: string[];
}

export interface RelicDiagramPrintAreaUpdate {
  content: string;
  printArea?: RelicDiagramPrintArea;
}

export interface RelicDiagramPrintSettingsUpdate {
  content: string;
  printSettings: RelicDiagramPrintSettings;
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

const freeDrawingBodyKeys = new Set(["nodes", "lines", "printArea", "printSettings"]);
const freeDrawingNodeKeys = new Set(["id", "shape", "text", "x", "y", "width", "height", "layer", "color", "textSize", "textAlign", "verticalAlign"]);
const diagramLineKeys = new Set(["id", "from", "to", "label", "labelTextSize"]);
const currentDiagramFormatVersion = 1;
const diagramFrontmatterKeys = new Set(["type", "title", "formatVersion"]);
const diagramNodeGridSize = 32;
const defaultNodeWidth = diagramNodeGridSize * 5;
const defaultNodeHeight = diagramNodeGridSize * 2;
export const defaultRelicDiagramPrintSettings: RelicDiagramPrintSettings = {
  marginPreset: "normal",
  orientation: "portrait",
  paperSize: "A4",
  scale: 1,
  scaleMode: "fit"
};

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

export function isRelicDiagramMarkdownCandidate(content: string): boolean {
  if (isRelicDiagramMarkdownContent(content)) return true;

  const frontmatter = extractFrontmatterText(content);
  if (frontmatter === null) return false;

  return /^\s*type\s*:\s*["']?diagram["']?\s*$/m.test(frontmatter);
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
        layer: node.layer,
        ...(node.color ? { color: node.color } : {}),
        ...(node.textSize ? { textSize: node.textSize } : {}),
        ...(node.textAlign ? { textAlign: node.textAlign } : {}),
        ...(node.verticalAlign ? { verticalAlign: node.verticalAlign } : {})
      })),
      lines: validated.value.lines.map((line) => ({
        id: line.id,
        from: line.from,
        to: line.to,
        label: line.label,
        ...(line.labelTextSize ? { labelTextSize: line.labelTextSize } : {})
      })),
      ...(validated.value.printArea ? { printArea: validated.value.printArea } : {}),
      ...(validated.value.printSettings ? { printSettings: validated.value.printSettings } : {})
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

  const nodeById = new Map(parsed.value.nodes.map((node) => [node.id, node]));
  const fromNode = nodeById.get(from.value);
  const toNode = nodeById.get(to.value);
  if (!fromNode || !toNode) {
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

export function updateRelicDiagramLineEndpoints(
  content: string,
  lineId: string,
  fromNodeId: string,
  toNodeId: string
): RelicResult<RelicDiagramLineEndpointUpdate> {
  const parsed = parseRelicConnectedDiagramMarkdown(content);
  if (!parsed.ok) return parsed;

  const id = parseRequiredText(lineId, "DIAGRAM_LINE_ID_INVALID", "Lineの id を指定してください。");
  if (!id.ok) return id;
  const from = parseRequiredText(fromNodeId, "DIAGRAM_LINE_FROM_INVALID", "Lineの from を指定してください。");
  if (!from.ok) return from;
  const to = parseRequiredText(toNodeId, "DIAGRAM_LINE_TO_INVALID", "Lineの to を指定してください。");
  if (!to.ok) return to;
  const line = parsed.value.lines.find((item) => item.id === id.value);
  if (!line) {
    return fail("DIAGRAM_LINE_MISSING", "変更するLineが見つかりません。");
  }
  const validation = validateDiagramLineConnection(parsed.value, {
    from: from.value,
    ignoreLineId: id.value,
    to: to.value
  });
  if (!validation.ok) return validation;

  const nextLine = {
    ...line,
    from: from.value,
    to: to.value
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

export function updateRelicFreeDrawingNodeShape(
  content: string,
  nodeId: string,
  shape: RelicFreeDrawingShapeType
): RelicResult<RelicFreeDrawingNodeShapeUpdate> {
  const parsed = parseRelicFreeDrawingMarkdown(content);
  if (!parsed.ok) return parsed;

  const id = parseRequiredText(nodeId, "DIAGRAM_NODE_ID_INVALID", "Nodeの id を指定してください。");
  if (!id.ok) return id;
  if (shape === "area") {
    return fail("DIAGRAM_NODE_SHAPE_INVALID", "領域図形への種類変更はできません。");
  }

  const node = parsed.value.nodes.find((item) => item.id === id.value);
  if (!node) {
    return fail("DIAGRAM_NODE_MISSING", "変更するNodeが見つかりません。");
  }
  if (node.shape === "area") {
    return fail("DIAGRAM_NODE_SHAPE_INVALID", "領域図形から種類変更はできません。");
  }

  const nextNode = {
    ...node,
    layer: relicFreeDrawingShapeLayer,
    shape
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

export function moveRelicDiagramNodesByDelta(
  content: string,
  nodeIds: Iterable<string>,
  deltaX: number,
  deltaY: number
): RelicResult<RelicDiagramMultiNodeUpdate> {
  const parsed = parseRelicFreeDrawingMarkdown(content);
  if (!parsed.ok) return parsed;

  const ids = new Set([...nodeIds]);
  if (ids.size === 0) {
    return fail("DIAGRAM_NODE_MISSING", "移動するNodeが見つかりません。");
  }

  const movedIds: string[] = [];
  const nodes = parsed.value.nodes.map((node) => {
    if (!ids.has(node.id)) return node;
    movedIds.push(node.id);
    return {
      ...node,
      x: Math.round(node.x + deltaX),
      y: Math.round(node.y + deltaY)
    };
  });
  if (movedIds.length === 0) {
    return fail("DIAGRAM_NODE_MISSING", "移動するNodeが見つかりません。");
  }

  const serialized = serializeRelicFreeDrawingMarkdown({
    ...parsed.value,
    nodes
  });
  if (!serialized.ok) return serialized;

  return ok({ content: serialized.value, nodeIds: movedIds });
}

export function removeRelicDiagramNodes(
  content: string,
  nodeIds: Iterable<string>
): RelicResult<RelicDiagramDeletion> {
  const parsed = parseRelicFreeDrawingMarkdown(content);
  if (!parsed.ok) return parsed;

  const ids = new Set([...nodeIds]);
  if (ids.size === 0) {
    return fail("DIAGRAM_NODE_MISSING", "削除するNodeが見つかりません。");
  }

  const nextNodes = parsed.value.nodes.filter((node) => !ids.has(node.id));
  if (nextNodes.length === parsed.value.nodes.length) {
    return fail("DIAGRAM_NODE_MISSING", "削除するNodeが見つかりません。");
  }

  const existingNodeIds = new Set(nextNodes.map((node) => node.id));
  const nextLines = parsed.value.lines.filter((line) => existingNodeIds.has(line.from) && existingNodeIds.has(line.to));
  const serialized = serializeRelicFreeDrawingMarkdown({
    ...parsed.value,
    lines: nextLines,
    nodes: nextNodes
  });
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    count: parsed.value.nodes.length - nextNodes.length + parsed.value.lines.length - nextLines.length
  });
}

export function duplicateRelicDiagramNodes(
  content: string,
  nodeIds: Iterable<string>
): RelicResult<RelicDiagramDuplicate> {
  const parsed = parseRelicFreeDrawingMarkdown(content);
  if (!parsed.ok) return parsed;

  const selectedIds = new Set([...nodeIds]);
  const selectedNodes = parsed.value.nodes.filter((node) => selectedIds.has(node.id));
  if (selectedNodes.length === 0) {
    return fail("DIAGRAM_NODE_MISSING", "複製するNodeが見つかりません。");
  }

  const idMap = new Map<string, string>();
  let nextNodes = [...parsed.value.nodes];
  const duplicatedNodes = selectedNodes.map((node) => {
    const nextId = nextNodeId(nextNodes);
    idMap.set(node.id, nextId);
    const duplicate = {
      ...node,
      id: nextId,
      x: node.x + diagramNodeGridSize,
      y: node.y + diagramNodeGridSize
    };
    nextNodes = [...nextNodes, duplicate];
    return duplicate;
  });
  let nextLines = [...parsed.value.lines];
  const duplicatedLines = parsed.value.lines.flatMap((line): RelicDiagramLine[] => {
    const from = idMap.get(line.from);
    const to = idMap.get(line.to);
    if (!from || !to) return [];

    const duplicate = {
      ...line,
      from,
      id: nextLineId(nextLines),
      to
    };
    nextLines = [...nextLines, duplicate];
    return [duplicate];
  });
  const serialized = serializeRelicFreeDrawingMarkdown({
    ...parsed.value,
    lines: nextLines,
    nodes: nextNodes
  });
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    lineIds: duplicatedLines.map((line) => line.id),
    nodeIds: duplicatedNodes.map((node) => node.id)
  });
}

export function alignRelicDiagramNodes(
  content: string,
  nodeIds: Iterable<string>,
  direction: "horizontal" | "vertical"
): RelicResult<RelicDiagramMultiNodeUpdate> {
  const parsed = parseRelicFreeDrawingMarkdown(content);
  if (!parsed.ok) return parsed;

  const ids = new Set([...nodeIds]);
  const selected = parsed.value.nodes.filter((node) => ids.has(node.id));
  if (selected.length < 2) {
    return fail("DIAGRAM_NODE_SELECTION_TOO_SMALL", "整列するには2つ以上の図形を選択してください。");
  }

  const average = selected.reduce((sum, node) => sum + (direction === "horizontal" ? node.y : node.x), 0) / selected.length;
  const nodes = parsed.value.nodes.map((node) => {
    if (!ids.has(node.id)) return node;
    return direction === "horizontal"
      ? { ...node, y: Math.round(average) }
      : { ...node, x: Math.round(average) };
  });
  const serialized = serializeRelicFreeDrawingMarkdown({
    ...parsed.value,
    nodes
  });
  if (!serialized.ok) return serialized;

  return ok({ content: serialized.value, nodeIds: selected.map((node) => node.id) });
}

export function distributeRelicDiagramNodes(
  content: string,
  nodeIds: Iterable<string>,
  direction: "horizontal" | "vertical"
): RelicResult<RelicDiagramMultiNodeUpdate> {
  const parsed = parseRelicFreeDrawingMarkdown(content);
  if (!parsed.ok) return parsed;

  const ids = new Set([...nodeIds]);
  const selected = parsed.value.nodes
    .filter((node) => ids.has(node.id))
    .sort((a, b) => (direction === "horizontal" ? a.x - b.x : a.y - b.y));
  if (selected.length < 3) {
    return fail("DIAGRAM_NODE_SELECTION_TOO_SMALL", "等間隔配置するには3つ以上の図形を選択してください。");
  }

  const first = selected[0];
  const last = selected[selected.length - 1];
  const start = direction === "horizontal" ? first.x : first.y;
  const end = direction === "horizontal" ? last.x : last.y;
  const step = (end - start) / (selected.length - 1);
  const positionById = new Map(selected.map((node, index) => [node.id, Math.round(start + step * index)]));
  const nodes = parsed.value.nodes.map((node) => {
    const position = positionById.get(node.id);
    if (position === undefined) return node;
    return direction === "horizontal"
      ? { ...node, x: position }
      : { ...node, y: position };
  });
  const serialized = serializeRelicFreeDrawingMarkdown({
    ...parsed.value,
    nodes
  });
  if (!serialized.ok) return serialized;

  return ok({ content: serialized.value, nodeIds: selected.map((node) => node.id) });
}

export function updateRelicDiagramNodesAppearance(
  content: string,
  nodeIds: Iterable<string>,
  appearance: {
    color?: RelicDiagramNodeColorPreset | null;
    textAlign?: RelicDiagramHorizontalAlignment | null;
    textSize?: RelicDiagramTextSize | null;
    verticalAlign?: RelicDiagramVerticalAlignment | null;
  }
): RelicResult<RelicDiagramMultiNodeUpdate> {
  const parsed = parseRelicFreeDrawingMarkdown(content);
  if (!parsed.ok) return parsed;

  const ids = new Set([...nodeIds]);
  if (ids.size === 0) {
    return fail("DIAGRAM_NODE_MISSING", "変更するNodeが見つかりません。");
  }

  const color = parseNullableEnum(appearance.color, relicDiagramNodeColorPresets, "DIAGRAM_NODE_COLOR_INVALID", "Nodeの color は対応する色名にしてください。");
  if (!color.ok) return color;
  const textSize = parseNullableEnum(appearance.textSize, relicDiagramTextSizes, "DIAGRAM_NODE_TEXT_SIZE_INVALID", "Nodeの textSize は対応する文字サイズにしてください。");
  if (!textSize.ok) return textSize;
  const textAlign = parseNullableEnum(appearance.textAlign, relicDiagramHorizontalAlignments, "DIAGRAM_NODE_TEXT_ALIGN_INVALID", "Nodeの textAlign は対応する文字揃えにしてください。");
  if (!textAlign.ok) return textAlign;
  const verticalAlign = parseNullableEnum(appearance.verticalAlign, relicDiagramVerticalAlignments, "DIAGRAM_NODE_VERTICAL_ALIGN_INVALID", "Nodeの verticalAlign は対応する縦位置にしてください。");
  if (!verticalAlign.ok) return verticalAlign;

  const updatedIds: string[] = [];
  const nodes = parsed.value.nodes.map((node) => {
    if (!ids.has(node.id)) return node;
    updatedIds.push(node.id);
    let nextNode = { ...node };
    if (appearance.color !== undefined) {
      const { color: _removed, ...rest } = nextNode;
      nextNode = color.value ? { ...rest, color: color.value } : rest;
    }
    if (appearance.textSize !== undefined) {
      const { textSize: _removed, ...rest } = nextNode;
      nextNode = textSize.value ? { ...rest, textSize: textSize.value } : rest;
    }
    if (appearance.textAlign !== undefined) {
      const { textAlign: _removed, ...rest } = nextNode;
      nextNode = textAlign.value ? { ...rest, textAlign: textAlign.value } : rest;
    }
    if (appearance.verticalAlign !== undefined) {
      const { verticalAlign: _removed, ...rest } = nextNode;
      nextNode = verticalAlign.value ? { ...rest, verticalAlign: verticalAlign.value } : rest;
    }
    return nextNode;
  });
  if (updatedIds.length === 0) {
    return fail("DIAGRAM_NODE_MISSING", "変更するNodeが見つかりません。");
  }

  const serialized = serializeRelicFreeDrawingMarkdown({
    ...parsed.value,
    nodes
  });
  if (!serialized.ok) return serialized;

  return ok({ content: serialized.value, nodeIds: updatedIds });
}

export function updateRelicDiagramLineAppearance(
  content: string,
  lineId: string,
  appearance: { labelTextSize?: RelicDiagramTextSize | null }
): RelicResult<RelicDiagramLineLabelUpdate> {
  const parsed = parseRelicConnectedDiagramMarkdown(content);
  if (!parsed.ok) return parsed;

  const id = parseRequiredText(lineId, "DIAGRAM_LINE_ID_INVALID", "Lineの id を指定してください。");
  if (!id.ok) return id;
  const labelTextSize = parseNullableEnum(
    appearance.labelTextSize,
    relicDiagramTextSizes,
    "DIAGRAM_LINE_LABEL_TEXT_SIZE_INVALID",
    "Lineの labelTextSize は対応する文字サイズにしてください。"
  );
  if (!labelTextSize.ok) return labelTextSize;

  const line = parsed.value.lines.find((item) => item.id === id.value);
  if (!line) {
    return fail("DIAGRAM_LINE_MISSING", "変更するLineが見つかりません。");
  }

  let nextLine = { ...line };
  if (appearance.labelTextSize !== undefined) {
    const { labelTextSize: _removed, ...rest } = nextLine;
    nextLine = labelTextSize.value ? { ...rest, labelTextSize: labelTextSize.value } : rest;
  }
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

export function updateRelicDiagramPrintArea(
  content: string,
  printArea: RelicDiagramPrintArea | null
): RelicResult<RelicDiagramPrintAreaUpdate> {
  const parsed = parseRelicFreeDrawingMarkdown(content);
  if (!parsed.ok) return parsed;

  const nextPrintArea = parseNullablePrintArea(printArea);
  if (!nextPrintArea.ok) return nextPrintArea;
  const serialized = serializeRelicFreeDrawingMarkdown({
    ...parsed.value,
    ...(nextPrintArea.value ? { printArea: nextPrintArea.value } : { printArea: undefined })
  });
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    ...(nextPrintArea.value ? { printArea: nextPrintArea.value } : {})
  });
}

export function updateRelicDiagramPrintSettings(
  content: string,
  printSettings: RelicDiagramPrintSettings
): RelicResult<RelicDiagramPrintSettingsUpdate> {
  const parsed = parseRelicFreeDrawingMarkdown(content);
  if (!parsed.ok) return parsed;

  const nextPrintSettings = parsePrintSettings(printSettings);
  if (!nextPrintSettings.ok) return nextPrintSettings;
  const serialized = serializeRelicFreeDrawingMarkdown({
    ...parsed.value,
    printSettings: nextPrintSettings.value
  });
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    printSettings: nextPrintSettings.value
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
  const printArea = parseOptionalPrintArea(raw.printArea);
  if (!printArea.ok) return printArea;
  const printSettings = parseOptionalPrintSettings(raw.printSettings);
  if (!printSettings.ok) return printSettings;

  return ok({
    lines: lines.value,
    nodes: nodes.value,
    ...(printArea.value ? { printArea: printArea.value } : {}),
    ...(printSettings.value ? { printSettings: printSettings.value } : {}),
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

function extractFrontmatterText(content: string): string | null {
  const normalizedContent = content.replace(/\r\n/g, "\n");
  if (!normalizedContent.startsWith("---\n")) return null;

  const endIndex = normalizedContent.indexOf("\n---", 4);
  if (endIndex < 0) return normalizedContent.slice(4);

  return normalizedContent.slice(4, endIndex);
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
    const color = parseOptionalEnum(
      rawNode.color,
      relicDiagramNodeColorPresets,
      "DIAGRAM_NODE_COLOR_INVALID",
      "Nodeの color は対応する色名にしてください。"
    );
    if (!color.ok) return color;
    const textSize = parseOptionalEnum(
      rawNode.textSize,
      relicDiagramTextSizes,
      "DIAGRAM_NODE_TEXT_SIZE_INVALID",
      "Nodeの textSize は対応する文字サイズにしてください。"
    );
    if (!textSize.ok) return textSize;
    const textAlign = parseOptionalEnum(
      rawNode.textAlign,
      relicDiagramHorizontalAlignments,
      "DIAGRAM_NODE_TEXT_ALIGN_INVALID",
      "Nodeの textAlign は対応する文字揃えにしてください。"
    );
    if (!textAlign.ok) return textAlign;
    const verticalAlign = parseOptionalEnum(
      rawNode.verticalAlign,
      relicDiagramVerticalAlignments,
      "DIAGRAM_NODE_VERTICAL_ALIGN_INVALID",
      "Nodeの verticalAlign は対応する縦位置にしてください。"
    );
    if (!verticalAlign.ok) return verticalAlign;

    nodeIds.add(id.value);
    nodes.push({
      ...(color.value ? { color: color.value } : {}),
      height: height.value,
      id: id.value,
      layer: normalizeFreeDrawingNodeLayer(shape.value, layer.value),
      shape: shape.value,
      text: text.value,
      ...(textAlign.value ? { textAlign: textAlign.value } : {}),
      ...(textSize.value ? { textSize: textSize.value } : {}),
      ...(verticalAlign.value ? { verticalAlign: verticalAlign.value } : {}),
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
    const connection = validateRawLineConnection({
      from: from.value,
      lineDirections,
      linePairCounts,
      nodeIds,
      to: to.value
    });
    if (!connection.ok) return connection;

    const label = parseOptionalText(rawLine.label, "DIAGRAM_LINE_LABEL_INVALID", "Lineの label は文字にしてください。");
    if (!label.ok) return label;
    const labelTextSize = parseOptionalEnum(
      rawLine.labelTextSize,
      relicDiagramTextSizes,
      "DIAGRAM_LINE_LABEL_TEXT_SIZE_INVALID",
      "Lineの labelTextSize は対応する文字サイズにしてください。"
    );
    if (!labelTextSize.ok) return labelTextSize;

    lineIds.add(id.value);
    lines.push({
      from: from.value,
      id: id.value,
      label: label.value,
      ...(labelTextSize.value ? { labelTextSize: labelTextSize.value } : {}),
      to: to.value
    });
  }

  return ok(lines);
}

function validateDiagramLineConnection(
  diagram: RelicConnectedDiagramDocument,
  input: { from: string; ignoreLineId?: string; to: string }
): RelicResult<void> {
  if (input.from === input.to) {
    return fail("DIAGRAM_LINE_SELF_INVALID", "同じNode同士をLineでつなげません。");
  }

  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  const fromNode = nodeById.get(input.from);
  const toNode = nodeById.get(input.to);
  if (!fromNode || !toNode) {
    return fail("DIAGRAM_LINE_NODE_MISSING", "Lineが存在しないNodeを参照しています。");
  }
  if (diagram.lines.some((line) => line.id !== input.ignoreLineId && line.from === input.from && line.to === input.to)) {
    return fail("DIAGRAM_LINE_DUPLICATED", "同じ向きのLineはすでに存在します。");
  }
  const pairCount = diagram.lines.filter((line) => {
    if (line.id === input.ignoreLineId) return false;
    return diagramLinePairKey(line.from, line.to) === diagramLinePairKey(input.from, input.to);
  }).length;
  if (pairCount >= 2) {
    return fail("DIAGRAM_LINE_PAIR_LIMIT", "同じNode一対のLineは2本までにしてください。");
  }
  if ("shape" in fromNode && fromNode.shape === "decision") {
    const decisionOutgoingCount = diagram.lines.filter((line) => line.id !== input.ignoreLineId && line.from === input.from).length;
    if (decisionOutgoingCount >= 2) {
      return fail("DIAGRAM_LINE_DECISION_OUTPUT_LIMIT", "判断図形から出る通常Lineは2本までです。");
    }
  }

  return ok(undefined);
}

function validateRawLineConnection(input: {
  from: string;
  lineDirections: Set<string>;
  linePairCounts: Map<string, number>;
  nodeIds: Set<string>;
  to: string;
}): RelicResult<void> {
  if (!input.nodeIds.has(input.from) || !input.nodeIds.has(input.to)) {
    return fail("DIAGRAM_LINE_NODE_MISSING", "Lineが存在しないNodeを参照しています。");
  }
  const directionKey = diagramLineDirectionKey(input.from, input.to);
  if (input.lineDirections.has(directionKey)) {
    return fail("DIAGRAM_LINE_DUPLICATED", "同じ向きのLineはすでに存在します。");
  }
  const pairKey = diagramLinePairKey(input.from, input.to);
  const pairCount = input.linePairCounts.get(pairKey) ?? 0;
  if (pairCount >= 2) {
    return fail("DIAGRAM_LINE_PAIR_LIMIT", "同じNode一対のLineは2本までにしてください。");
  }

  input.lineDirections.add(directionKey);
  input.linePairCounts.set(pairKey, pairCount + 1);
  return ok(undefined);
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

function parseOptionalEnum<T extends string>(
  raw: unknown,
  values: readonly T[],
  code: string,
  message: string
): RelicResult<T | undefined> {
  if (raw === undefined) return ok(undefined);
  if (typeof raw !== "string" || !values.includes(raw as T)) return fail(code, message);

  return ok(raw as T);
}

function parseNullableEnum<T extends string>(
  raw: T | null | undefined,
  values: readonly T[],
  code: string,
  message: string
): RelicResult<T | undefined> {
  if (raw === undefined || raw === null) return ok(undefined);
  if (!values.includes(raw)) return fail(code, message);

  return ok(raw);
}

function parseOptionalPrintArea(raw: unknown): RelicResult<RelicDiagramPrintArea | undefined> {
  if (raw === undefined) return ok(undefined);
  return parseNullablePrintArea(raw);
}

function parseNullablePrintArea(raw: unknown): RelicResult<RelicDiagramPrintArea | undefined> {
  if (raw === null) return ok(undefined);
  if (!isRecord(raw)) {
    return fail("DIAGRAM_PRINT_AREA_INVALID", "印刷領域は x、y、width、height を持つ値にしてください。");
  }

  const unknownKey = firstUnknownKey(raw, new Set(["x", "y", "width", "height"]));
  if (unknownKey) {
    return fail("DIAGRAM_PRINT_AREA_UNKNOWN_FIELD", `印刷領域に未対応の項目があります: ${unknownKey}`);
  }

  const x = parseFiniteNumber(raw.x, "DIAGRAM_PRINT_AREA_X_INVALID", "印刷領域の x は数値にしてください。");
  if (!x.ok) return x;
  const y = parseFiniteNumber(raw.y, "DIAGRAM_PRINT_AREA_Y_INVALID", "印刷領域の y は数値にしてください。");
  if (!y.ok) return y;
  const width = parsePositiveNumber(raw.width, "DIAGRAM_PRINT_AREA_WIDTH_INVALID", "印刷領域の width は0より大きい数値にしてください。");
  if (!width.ok) return width;
  const height = parsePositiveNumber(raw.height, "DIAGRAM_PRINT_AREA_HEIGHT_INVALID", "印刷領域の height は0より大きい数値にしてください。");
  if (!height.ok) return height;

  if (width.value > 20000 || height.value > 20000) {
    return fail("DIAGRAM_PRINT_AREA_SIZE_INVALID", "印刷領域が大きすぎます。");
  }

  return ok({
    height: Math.round(height.value),
    width: Math.round(width.value),
    x: Math.round(x.value),
    y: Math.round(y.value)
  });
}

function parseOptionalPrintSettings(raw: unknown): RelicResult<RelicDiagramPrintSettings | undefined> {
  if (raw === undefined) return ok(undefined);
  return parsePrintSettings(raw);
}

function parsePrintSettings(raw: unknown): RelicResult<RelicDiagramPrintSettings> {
  if (!isRecord(raw)) {
    return fail("DIAGRAM_PRINT_SETTINGS_INVALID", "用紙設定の形式が正しくありません。");
  }

  const unknownKey = firstUnknownKey(raw, new Set(["paperSize", "orientation", "marginPreset", "scaleMode", "scale"]));
  if (unknownKey) {
    return fail("DIAGRAM_PRINT_SETTINGS_UNKNOWN_FIELD", `用紙設定に未対応の項目があります: ${unknownKey}`);
  }

  const paperSize = parseOptionalEnum(raw.paperSize, relicDiagramPaperSizes, "DIAGRAM_PRINT_PAPER_SIZE_INVALID", "用紙サイズは対応する値にしてください。");
  if (!paperSize.ok) return paperSize;
  const orientation = parseOptionalEnum(raw.orientation, relicDiagramPrintOrientations, "DIAGRAM_PRINT_ORIENTATION_INVALID", "用紙方向は縦または横にしてください。");
  if (!orientation.ok) return orientation;
  const marginPreset = parseOptionalEnum(raw.marginPreset, relicDiagramPrintMarginPresets, "DIAGRAM_PRINT_MARGIN_INVALID", "余白は対応する値にしてください。");
  if (!marginPreset.ok) return marginPreset;
  const scaleMode = parseOptionalEnum(raw.scaleMode, relicDiagramPrintScaleModes, "DIAGRAM_PRINT_SCALE_MODE_INVALID", "倍率の収め方は対応する値にしてください。");
  if (!scaleMode.ok) return scaleMode;
  const scale = raw.scale === undefined
    ? ok(defaultRelicDiagramPrintSettings.scale)
    : parseFiniteNumber(raw.scale, "DIAGRAM_PRINT_SCALE_INVALID", "倍率は数値にしてください。");
  if (!scale.ok) return scale;
  if (scale.value < 0.1 || scale.value > 2) {
    return fail("DIAGRAM_PRINT_SCALE_INVALID", "倍率は10%から200%の範囲にしてください。");
  }

  return ok({
    marginPreset: marginPreset.value ?? defaultRelicDiagramPrintSettings.marginPreset,
    orientation: orientation.value ?? defaultRelicDiagramPrintSettings.orientation,
    paperSize: paperSize.value ?? defaultRelicDiagramPrintSettings.paperSize,
    scale: Number(scale.value.toFixed(2)),
    scaleMode: scaleMode.value ?? defaultRelicDiagramPrintSettings.scaleMode
  });
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
