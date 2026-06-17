import * as yaml from "js-yaml";

import { hasMarkdownExtension } from "./markdownExtension";
import { fail, ok, type RelicResult } from "./result";

const relicDiagramTypes = ["relationship", "why-tree", "free-drawing"] as const;
export type RelicDiagramType = typeof relicDiagramTypes[number];

export const relicFreeDrawingShapeTypes = ["terminator", "process", "decision", "input-output", "note", "area"] as const;
export type RelicFreeDrawingShapeType = typeof relicFreeDrawingShapeTypes[number];

const relicWhyTreeSupplementKinds = ["fact", "solution", "action"] as const;
export type RelicWhyTreeSupplementKind = typeof relicWhyTreeSupplementKinds[number];

export type RelicWhyTreeSelectableKind = "phenomenon" | "why" | RelicWhyTreeSupplementKind;

export interface RelicRelationshipDiagramDocument {
  lines: RelicDiagramLine[];
  nodes: RelicRelationshipDiagramNode[];
  title?: string;
  type: "relationship";
}

export interface RelicFreeDrawingDiagramDocument {
  lines: RelicDiagramLine[];
  nodes: RelicFreeDrawingNode[];
  title?: string;
  type: "free-drawing";
}

export interface RelicWhyTreeDocument {
  labels: RelicWhyTreeLabels;
  phenomenon: RelicWhyTreeNode;
  title?: string;
  type: "why-tree";
}

export type RelicConnectedDiagramDocument = RelicRelationshipDiagramDocument | RelicFreeDrawingDiagramDocument;
export type RelicDiagramDocument = RelicConnectedDiagramDocument | RelicWhyTreeDocument;

export interface RelicDiagramNodeBase {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
}

export interface RelicRelationshipDiagramNode extends RelicDiagramNodeBase {
  file: string;
}

export interface RelicFreeDrawingNode extends RelicDiagramNodeBase {
  layer: number;
  shape: RelicFreeDrawingShapeType;
  text: string;
}

export type RelicConnectedDiagramNode = RelicRelationshipDiagramNode | RelicFreeDrawingNode;
export type RelicDiagramNode = RelicRelationshipDiagramNode;

export interface RelicDiagramLine {
  from: string;
  id: string;
  label: string;
  to: string;
}

export interface RelicWhyTreeNode {
  actions: string[];
  facts: string[];
  solutions: string[];
  title: string;
  whys: RelicWhyTreeNode[];
}

export interface RelicWhyTreeLabels {
  action: string;
  fact: string;
  node: string;
  root: string;
  solution: string;
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

export interface RelicWhyTreeUpdate {
  content: string;
  tree: RelicWhyTreeDocument;
}

export type RelicWhyTreeMoveDirection = "down" | "up";

interface DiagramFrontmatter {
  title?: string;
  type: RelicDiagramType;
}

interface ParsedDiagramMarkdownParts {
  body: string;
  frontmatter: DiagramFrontmatter;
}

const relationshipBodyKeys = new Set(["nodes", "lines"]);
const relationshipNodeKeys = new Set(["id", "file", "x", "y", "width", "height"]);
const freeDrawingBodyKeys = new Set(["nodes", "lines"]);
const freeDrawingNodeKeys = new Set(["id", "shape", "text", "x", "y", "width", "height", "layer"]);
const diagramLineKeys = new Set(["id", "from", "to", "label"]);
const diagramFrontmatterKeys = new Set(["type", "title"]);
export const defaultRelicWhyTreeLabels: RelicWhyTreeLabels = {
  action: "アクション",
  fact: "メモ",
  node: "ノード",
  root: "ルート",
  solution: "関連項目"
};

const whyTreeBodyKeys = new Set(["labels", "phenomenon"]);
const whyTreeLabelKeys = new Set(["action", "fact", "node", "root", "solution"]);
const whyTreeNodeKeys = new Set(["title", "facts", "solutions", "actions", "whys"]);
const relationshipNodeGridSize = 32;
const defaultNodeWidth = 192;
const defaultNodeHeight = 96;

export const emptyRelicRelationshipMarkdownContent = [
  "---",
  "type: relationship",
  "title: 関係図",
  "---",
  "",
  "nodes: []",
  "lines: []",
  ""
].join("\n");

export const emptyRelicWhyTreeMarkdownContent = [
  "---",
  "type: why-tree",
  "title: 構造ツリー",
  "---",
  "",
  "labels:",
  "  root: ルート",
  "  node: ノード",
  "  fact: メモ",
  "  solution: 関連項目",
  "  action: アクション",
  "phenomenon:",
  "  title: ルート",
  "  facts: []",
  "  solutions: []",
  "  actions: []",
  ""
].join("\n");

export const emptyRelicFreeDrawingMarkdownContent = [
  "---",
  "type: free-drawing",
  "title: 自由図",
  "---",
  "",
  "nodes: []",
  "lines: []",
  ""
].join("\n");

export function isRelicDiagramType(value: unknown): value is RelicDiagramType {
  return typeof value === "string" && relicDiagramTypes.includes(value as RelicDiagramType);
}

export function isRelicDiagramMarkdownContent(content: string): boolean {
  const parts = parseDiagramMarkdownParts(content);
  return parts.ok && isRelicDiagramType(parts.value.frontmatter.type);
}

export function diagramTypeFromMarkdownContent(content: string): RelicDiagramType | null {
  const parts = parseDiagramMarkdownParts(content);
  return parts.ok ? parts.value.frontmatter.type : null;
}

export function parseRelicDiagramMarkdown(content: string): RelicResult<RelicDiagramDocument> {
  const parts = parseDiagramMarkdownParts(content);
  if (!parts.ok) return parts;

  if (parts.value.frontmatter.type === "why-tree") return parseRelicWhyTreeMarkdown(content);
  if (parts.value.frontmatter.type === "free-drawing") return parseRelicFreeDrawingMarkdown(content);
  return parseRelicRelationshipMarkdown(content);
}

export function serializeRelicDiagramMarkdown(document: RelicDiagramDocument): RelicResult<string> {
  if (document.type === "why-tree") return serializeRelicWhyTreeMarkdown(document);
  if (document.type === "free-drawing") return serializeRelicFreeDrawingMarkdown(document);
  return serializeRelicRelationshipMarkdown(document);
}

export function parseRelicRelationshipMarkdown(content: string): RelicResult<RelicRelationshipDiagramDocument> {
  const parts = parseDiagramMarkdownParts(content);
  if (!parts.ok) return parts;
  if (parts.value.frontmatter.type !== "relationship") {
    return fail("DIAGRAM_TYPE_INVALID", "relationship Diagramではありません。");
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

  return validateRelicRelationshipDocument({
    ...body,
    title: parts.value.frontmatter.title,
    type: "relationship"
  });
}

export function serializeRelicRelationshipMarkdown(document: RelicRelationshipDiagramDocument): RelicResult<string> {
  const validated = validateRelicRelationshipDocument(document);
  if (!validated.ok) return validated;

  const frontmatter = dumpFrontmatter(validated.value.type, validated.value.title);
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
    yamlDumpOptions()
  ).replace(/\n(\s*)'y':/g, "\n$1y:");

  return ok(`---\n${frontmatter}\n---\n\n${body}`);
}

export function parseRelicFreeDrawingMarkdown(content: string): RelicResult<RelicFreeDrawingDiagramDocument> {
  const parts = parseDiagramMarkdownParts(content);
  if (!parts.ok) return parts;
  if (parts.value.frontmatter.type !== "free-drawing") {
    return fail("DIAGRAM_TYPE_INVALID", "free-drawing Diagramではありません。");
  }

  let body: unknown;
  try {
    body = parts.value.body.trim().length > 0
      ? yaml.load(parts.value.body, { schema: yaml.JSON_SCHEMA })
      : {};
  } catch (error) {
    return fail("DIAGRAM_YAML_INVALID", "自由図を読み込めませんでした。", errorDetails(error));
  }

  if (body === null) body = {};
  if (!isRecord(body)) {
    return fail("DIAGRAM_FORMAT_INVALID", "自由図ファイルの形式が正しくありません。");
  }

  return validateRelicFreeDrawingDocument({
    ...body,
    title: parts.value.frontmatter.title,
    type: "free-drawing"
  });
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

export function parseRelicWhyTreeMarkdown(content: string): RelicResult<RelicWhyTreeDocument> {
  const parts = parseDiagramMarkdownParts(content);
  if (!parts.ok) return parts;
  if (parts.value.frontmatter.type !== "why-tree") {
    return fail("DIAGRAM_TYPE_INVALID", "why-tree Diagramではありません。");
  }

  let body: unknown;
  try {
    body = parts.value.body.trim().length > 0
      ? yaml.load(parts.value.body, { schema: yaml.JSON_SCHEMA })
      : {};
  } catch (error) {
    return fail("WHY_TREE_YAML_INVALID", "構造ツリーを読み込めませんでした。", errorDetails(error));
  }

  if (!isRecord(body)) {
    return fail("WHY_TREE_FORMAT_INVALID", "構造ツリーの形式が正しくありません。");
  }

  return validateRelicWhyTreeDocument({
    ...body,
    title: parts.value.frontmatter.title,
    type: "why-tree"
  });
}

export function serializeRelicWhyTreeMarkdown(document: RelicWhyTreeDocument): RelicResult<string> {
  const validated = validateRelicWhyTreeDocument(document);
  if (!validated.ok) return validated;

  const frontmatter = dumpFrontmatter(validated.value.type, validated.value.title);
  const body = yaml.dump(
    {
      labels: validated.value.labels,
      phenomenon: serializeWhyTreeNodeValue(validated.value.phenomenon)
    },
    yamlDumpOptions()
  );

  return ok(`---\n${frontmatter}\n---\n\n${body}`);
}

export function updateRelicWhyTreeTitle(
  content: string,
  whyPath: number[],
  title: string
): RelicResult<RelicWhyTreeUpdate> {
  const parsed = parseRelicWhyTreeMarkdown(content);
  if (!parsed.ok) return parsed;

  const nextTitle = parseWhyTreeText(title);
  if (!nextTitle.ok) return nextTitle;

  const updated = updateWhyTreeNodeAtPath(parsed.value.phenomenon, whyPath, (node) => ({
    ...node,
    title: nextTitle.value
  }));
  if (!updated.ok) return updated;

  return serializeWhyTreeUpdate({ ...parsed.value, phenomenon: updated.value });
}

export function addRelicWhyTreeWhy(content: string, whyPath: number[]): RelicResult<RelicWhyTreeUpdate> {
  const parsed = parseRelicWhyTreeMarkdown(content);
  if (!parsed.ok) return parsed;

  const updated = updateWhyTreeNodeAtPath(parsed.value.phenomenon, whyPath, (node) => ({
    ...node,
    whys: [...node.whys, {
      actions: [],
      facts: [],
      solutions: [],
      title: parsed.value.labels.node,
      whys: []
    }]
  }));
  if (!updated.ok) return updated;

  return serializeWhyTreeUpdate({ ...parsed.value, phenomenon: updated.value });
}

export function addRelicWhyTreeSupplement(
  content: string,
  whyPath: number[],
  kind: RelicWhyTreeSupplementKind
): RelicResult<RelicWhyTreeUpdate> {
  const parsed = parseRelicWhyTreeMarkdown(content);
  if (!parsed.ok) return parsed;

  const key = whyTreeSupplementKey(kind);
  const updated = updateWhyTreeNodeAtPath(parsed.value.phenomenon, whyPath, (node) => ({
    ...node,
    [key]: [...node[key], defaultSupplementTitle(kind, parsed.value.labels)]
  }));
  if (!updated.ok) return updated;

  return serializeWhyTreeUpdate({ ...parsed.value, phenomenon: updated.value });
}

export function updateRelicWhyTreeLabels(
  content: string,
  labels: RelicWhyTreeLabels
): RelicResult<RelicWhyTreeUpdate> {
  const parsed = parseRelicWhyTreeMarkdown(content);
  if (!parsed.ok) return parsed;
  const nextLabels = parseWhyTreeLabels(labels, parsed.value.labels);
  if (!nextLabels.ok) return nextLabels;

  return serializeWhyTreeUpdate({ ...parsed.value, labels: nextLabels.value });
}

export function removeRelicWhyTreeWhy(content: string, whyPath: number[]): RelicResult<RelicWhyTreeUpdate> {
  const parsed = parseRelicWhyTreeMarkdown(content);
  if (!parsed.ok) return parsed;
  if (whyPath.length === 0) {
    return fail("WHY_TREE_PHENOMENON_REQUIRED", "ルートは削除できません。");
  }
  if (whyPath.some((index) => !Number.isInteger(index) || index < 0)) {
    return fail("WHY_TREE_PATH_INVALID", "構造ツリーのパスが正しくありません。");
  }

  const updated = updateWhyTreeNodeAtPath(parsed.value.phenomenon, whyPath.slice(0, -1), (node) => {
    const targetIndex = whyPath[whyPath.length - 1];
    if (targetIndex === undefined || targetIndex >= node.whys.length) {
      return fail("WHY_TREE_NODE_MISSING", "削除するノードが見つかりません。");
    }

    return ok({
      ...node,
      whys: node.whys.filter((_, index) => index !== targetIndex)
    });
  });
  if (!updated.ok) return updated;

  return serializeWhyTreeUpdate({ ...parsed.value, phenomenon: updated.value });
}

export function removeRelicWhyTreeSupplement(
  content: string,
  whyPath: number[],
  kind: RelicWhyTreeSupplementKind,
  index: number
): RelicResult<RelicWhyTreeUpdate> {
  const parsed = parseRelicWhyTreeMarkdown(content);
  if (!parsed.ok) return parsed;

  const key = whyTreeSupplementKey(kind);
  const updated = updateWhyTreeNodeAtPath(parsed.value.phenomenon, whyPath, (node) => {
    if (!Number.isInteger(index) || index < 0 || index >= node[key].length) {
      return fail("WHY_TREE_ITEM_MISSING", "削除する項目が見つかりません。");
    }

    return ok({
      ...node,
      [key]: node[key].filter((_, itemIndex) => itemIndex !== index)
    });
  });
  if (!updated.ok) return updated;

  return serializeWhyTreeUpdate({ ...parsed.value, phenomenon: updated.value });
}

export function updateRelicWhyTreeSupplement(
  content: string,
  whyPath: number[],
  kind: RelicWhyTreeSupplementKind,
  index: number,
  value: string
): RelicResult<RelicWhyTreeUpdate> {
  const parsed = parseRelicWhyTreeMarkdown(content);
  if (!parsed.ok) return parsed;

  const key = whyTreeSupplementKey(kind);
  const nextText = parseWhyTreeText(value);
  if (!nextText.ok) return nextText;

  const updated = updateWhyTreeNodeAtPath(parsed.value.phenomenon, whyPath, (node) => {
    if (!Number.isInteger(index) || index < 0 || index >= node[key].length) {
      return fail("WHY_TREE_ITEM_MISSING", "更新する項目が見つかりません。");
    }

    return ok({
      ...node,
      [key]: node[key].map((item, itemIndex) => itemIndex === index ? nextText.value : item)
    });
  });
  if (!updated.ok) return updated;

  return serializeWhyTreeUpdate({ ...parsed.value, phenomenon: updated.value });
}

export function moveRelicWhyTreeWhy(
  content: string,
  whyPath: number[],
  direction: RelicWhyTreeMoveDirection
): RelicResult<RelicWhyTreeUpdate> {
  const parsed = parseRelicWhyTreeMarkdown(content);
  if (!parsed.ok) return parsed;
  if (whyPath.length === 0) {
    return fail("WHY_TREE_PHENOMENON_REQUIRED", "ルートは並べ替えできません。");
  }
  if (whyPath.some((index) => !Number.isInteger(index) || index < 0)) {
    return fail("WHY_TREE_PATH_INVALID", "構造ツリーのパスが正しくありません。");
  }

  const updated = updateWhyTreeNodeAtPath(parsed.value.phenomenon, whyPath.slice(0, -1), (node) => {
    const index = whyPath[whyPath.length - 1];
    if (index === undefined || index >= node.whys.length) {
      return fail("WHY_TREE_NODE_MISSING", "並べ替えるノードが見つかりません。");
    }

    const moved = moveArrayItem(node.whys, index, moveDirectionOffset(direction));
    if (!moved.ok) return moved;

    return ok({
      ...node,
      whys: moved.value
    });
  });
  if (!updated.ok) return updated;

  return serializeWhyTreeUpdate({ ...parsed.value, phenomenon: updated.value });
}

export function moveRelicWhyTreeSupplement(
  content: string,
  whyPath: number[],
  kind: RelicWhyTreeSupplementKind,
  index: number,
  direction: RelicWhyTreeMoveDirection
): RelicResult<RelicWhyTreeUpdate> {
  const parsed = parseRelicWhyTreeMarkdown(content);
  if (!parsed.ok) return parsed;

  const key = whyTreeSupplementKey(kind);
  const updated = updateWhyTreeNodeAtPath(parsed.value.phenomenon, whyPath, (node) => {
    const moved = moveArrayItem(node[key], index, moveDirectionOffset(direction));
    if (!moved.ok) return moved;

    return ok({
      ...node,
      [key]: moved.value
    });
  });
  if (!updated.ok) return updated;

  return serializeWhyTreeUpdate({ ...parsed.value, phenomenon: updated.value });
}

export function replaceRelicDiagramNodeFileReferences(
  content: string,
  kind: RelicDiagramReferenceReplacementKind,
  oldPath: string,
  newPath: string
): RelicResult<RelicDiagramReferenceReplacement> {
  if (diagramTypeFromMarkdownContent(content) !== "relationship") {
    return ok({ content, count: 0 });
  }

  const parsed = parseRelicRelationshipMarkdown(content);
  if (!parsed.ok) return parsed;

  const replacement = replaceDiagramNodeFilePaths(parsed.value, kind, oldPath, newPath);
  if (replacement.count === 0) {
    return ok({ content, count: 0 });
  }

  const serialized = serializeRelicRelationshipMarkdown(replacement.diagram);
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    count: replacement.count
  });
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

export function addRelicDiagramNodeForFile(
  content: string,
  filePath: string
): RelicResult<RelicDiagramNodeInsertion> {
  const parsed = parseRelicRelationshipMarkdown(content);
  if (!parsed.ok) return parsed;

  const file = parseNodeFilePath(filePath);
  if (!file.ok) return file;

  const node = createNodeForFile(parsed.value, file.value);
  const serialized = serializeRelicRelationshipMarkdown({
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
    height: snapRelationshipNodeSize(nextHeight.value),
    width: snapRelationshipNodeSize(nextWidth.value)
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

function snapRelationshipNodeSize(value: number): number {
  return Math.max(relationshipNodeGridSize, Math.round(value / relationshipNodeGridSize) * relationshipNodeGridSize);
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
    return fail("DIAGRAM_LINE_MISSING", "Labelを変更するLineが見つかりません。");
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
    layer: Math.round(nextLayer.value)
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

function validateRelicRelationshipDocument(raw: unknown): RelicResult<RelicRelationshipDiagramDocument> {
  if (!isRecord(raw)) {
    return fail("DIAGRAM_FORMAT_INVALID", "図解ファイルの形式が正しくありません。");
  }
  if (raw.type !== "relationship") {
    return fail("DIAGRAM_TYPE_INVALID", "relationship Diagramではありません。");
  }

  const title = raw.title === undefined ? undefined : parseOptionalText(raw.title, "DIAGRAM_TITLE_INVALID", "図解の title は文字にしてください。");
  if (title && !title.ok) return title;

  const allowedTopLevelKeys = new Set([...relationshipBodyKeys, ...diagramFrontmatterKeys]);
  const unknownTopLevelKey = Object.keys(raw).find((key) => !allowedTopLevelKeys.has(key));
  if (unknownTopLevelKey) {
    return fail("DIAGRAM_UNKNOWN_FIELD", `relationshipに未対応の項目があります: ${unknownTopLevelKey}`);
  }

  const nodes = parseNodes(raw.nodes);
  if (!nodes.ok) return nodes;

  const lines = parseLines(raw.lines, nodes.value);
  if (!lines.ok) return lines;

  return ok({
    lines: lines.value,
    nodes: nodes.value,
    ...(title?.value ? { title: title.value } : {}),
    type: "relationship"
  });
}

function validateRelicFreeDrawingDocument(raw: unknown): RelicResult<RelicFreeDrawingDiagramDocument> {
  if (!isRecord(raw)) {
    return fail("DIAGRAM_FORMAT_INVALID", "自由図ファイルの形式が正しくありません。");
  }
  if (raw.type !== "free-drawing") {
    return fail("DIAGRAM_TYPE_INVALID", "free-drawing Diagramではありません。");
  }

  const title = raw.title === undefined ? undefined : parseOptionalText(raw.title, "DIAGRAM_TITLE_INVALID", "図解の title は文字にしてください。");
  if (title && !title.ok) return title;

  const allowedTopLevelKeys = new Set([...freeDrawingBodyKeys, ...diagramFrontmatterKeys]);
  const unknownTopLevelKey = Object.keys(raw).find((key) => !allowedTopLevelKeys.has(key));
  if (unknownTopLevelKey) {
    return fail("DIAGRAM_UNKNOWN_FIELD", `free-drawingに未対応の項目があります: ${unknownTopLevelKey}`);
  }

  const nodes = parseFreeDrawingNodes(raw.nodes);
  if (!nodes.ok) return nodes;

  const lines = parseLines(raw.lines, nodes.value);
  if (!lines.ok) return lines;

  return ok({
    lines: lines.value,
    nodes: nodes.value,
    ...(title?.value ? { title: title.value } : {}),
    type: "free-drawing"
  });
}

function validateRelicWhyTreeDocument(raw: unknown): RelicResult<RelicWhyTreeDocument> {
  if (!isRecord(raw)) {
    return fail("WHY_TREE_FORMAT_INVALID", "構造ツリーの形式が正しくありません。");
  }
  if (raw.type !== "why-tree") {
    return fail("DIAGRAM_TYPE_INVALID", "why-tree Diagramではありません。");
  }

  const title = raw.title === undefined ? undefined : parseOptionalText(raw.title, "DIAGRAM_TITLE_INVALID", "図解の title は文字にしてください。");
  if (title && !title.ok) return title;

  const allowedTopLevelKeys = new Set([...whyTreeBodyKeys, ...diagramFrontmatterKeys]);
  const unknownTopLevelKey = Object.keys(raw).find((key) => !allowedTopLevelKeys.has(key));
  if (unknownTopLevelKey) {
    return fail("WHY_TREE_UNKNOWN_FIELD", `構造ツリーに未対応の項目があります: ${unknownTopLevelKey}`);
  }

  const phenomenon = parseWhyTreeNode(raw.phenomenon, "phenomenon");
  if (!phenomenon.ok) return phenomenon;
  const labels = parseWhyTreeLabels(raw.labels);
  if (!labels.ok) return labels;

  return ok({
    labels: labels.value,
    phenomenon: phenomenon.value,
    ...(title?.value ? { title: title.value } : {}),
    type: "why-tree"
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
  const title = parsed.title === undefined ? undefined : parseOptionalText(parsed.title, "DIAGRAM_TITLE_INVALID", "図解の title は文字にしてください。");
  if (title && !title.ok) return title;

  return ok({
    body,
    frontmatter: {
      ...(title?.value ? { title: title.value } : {}),
      type: type.value
    }
  });
}

function parseRelicConnectedDiagramMarkdown(content: string): RelicResult<RelicConnectedDiagramDocument> {
  const type = diagramTypeFromMarkdownContent(content);
  if (type === "relationship") return parseRelicRelationshipMarkdown(content);
  if (type === "free-drawing") return parseRelicFreeDrawingMarkdown(content);
  return fail("DIAGRAM_TYPE_INVALID", "relationship または free-drawing Diagramではありません。");
}

function serializeRelicConnectedDiagramMarkdown(document: RelicConnectedDiagramDocument): RelicResult<string> {
  return document.type === "free-drawing"
    ? serializeRelicFreeDrawingMarkdown(document)
    : serializeRelicRelationshipMarkdown(document);
}

function parseNodes(rawNodes: unknown): RelicResult<RelicRelationshipDiagramNode[]> {
  if (rawNodes === undefined) return ok([]);
  if (!Array.isArray(rawNodes)) {
    return fail("DIAGRAM_NODES_INVALID", "relationshipのnodesは一覧にしてください。");
  }

  const nodeIds = new Set<string>();
  const nodes: RelicRelationshipDiagramNode[] = [];

  for (const [index, rawNode] of rawNodes.entries()) {
    if (!isRecord(rawNode)) {
      return fail("DIAGRAM_NODE_INVALID", `nodes の ${index + 1} 件目が正しくありません。`);
    }

    const unknownKey = firstUnknownKey(rawNode, relationshipNodeKeys);
    if (unknownKey) {
      return fail("DIAGRAM_NODE_UNKNOWN_FIELD", `Nodeに未対応の項目があります: ${unknownKey}`);
    }

    const id = parseRequiredText(rawNode.id, "DIAGRAM_NODE_ID_INVALID", "Nodeの id を指定してください。");
    if (!id.ok) return id;
    if (nodeIds.has(id.value)) {
      return fail("DIAGRAM_NODE_DUPLICATED", `同じNode idが使われています: ${id.value}`);
    }

    const file = parseNodeFilePath(rawNode.file);
    if (!file.ok) return file;
    const x = parseFiniteNumber(rawNode.x, "DIAGRAM_NODE_X_INVALID", "Nodeの x は数値にしてください。");
    if (!x.ok) return x;
    const y = parseFiniteNumber(rawNode.y, "DIAGRAM_NODE_Y_INVALID", "Nodeの y は数値にしてください。");
    if (!y.ok) return y;
    const width = parsePositiveNumber(rawNode.width, "DIAGRAM_NODE_WIDTH_INVALID", "Nodeの width は0より大きい数値にしてください。");
    if (!width.ok) return width;
    const height = parsePositiveNumber(rawNode.height, "DIAGRAM_NODE_HEIGHT_INVALID", "Nodeの height は0より大きい数値にしてください。");
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

function parseFreeDrawingNodes(rawNodes: unknown): RelicResult<RelicFreeDrawingNode[]> {
  if (rawNodes === undefined) return ok([]);
  if (!Array.isArray(rawNodes)) {
    return fail("DIAGRAM_NODES_INVALID", "free-drawingのnodesは一覧にしてください。");
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
      layer: layer.value,
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
    return fail("DIAGRAM_LINES_INVALID", "relationshipのlinesは一覧にしてください。");
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

function parseWhyTreeNode(raw: unknown, label: string): RelicResult<RelicWhyTreeNode> {
  if (!isRecord(raw)) {
    return fail("WHY_TREE_NODE_INVALID", `${label} が正しくありません。`);
  }

  const unknownKey = Object.keys(raw).find((key) => !whyTreeNodeKeys.has(key));
  if (unknownKey) {
    return fail("WHY_TREE_NODE_UNKNOWN_FIELD", `構造ツリー要素に未対応の項目があります: ${unknownKey}`);
  }

  const title = parseWhyTreeText(raw.title);
  if (!title.ok) return title;
  const facts = parseWhyTreeTextList(raw.facts, "facts");
  if (!facts.ok) return facts;
  const solutions = parseWhyTreeTextList(raw.solutions, "solutions");
  if (!solutions.ok) return solutions;
  const actions = parseWhyTreeTextList(raw.actions, "actions");
  if (!actions.ok) return actions;
  const whys = parseWhyTreeNodeList(raw.whys, "whys");
  if (!whys.ok) return whys;
  return ok({
    actions: actions.value,
    facts: facts.value,
    solutions: solutions.value,
    title: title.value,
    whys: whys.value
  });
}

function parseWhyTreeNodeList(raw: unknown, field: string): RelicResult<RelicWhyTreeNode[]> {
  if (raw === undefined) return ok([]);
  if (!Array.isArray(raw)) {
    return fail("WHY_TREE_LIST_INVALID", `${field} は一覧にしてください。`);
  }

  const nodes: RelicWhyTreeNode[] = [];
  for (const [index, item] of raw.entries()) {
    const node = parseWhyTreeNode(item, `${field} の ${index + 1} 件目`);
    if (!node.ok) return node;
    nodes.push(node.value);
  }

  return ok(nodes);
}

function parseWhyTreeTextList(raw: unknown, field: string): RelicResult<string[]> {
  if (raw === undefined) return ok([]);
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    return fail("WHY_TREE_LIST_INVALID", `${field} は文字の一覧にしてください。`);
  }

  return ok(raw);
}

function parseLabelText(raw: unknown, fallback: string, field: string): RelicResult<string> {
  if (raw === undefined) return ok(fallback);
  if (typeof raw !== "string") {
    return fail("WHY_TREE_LABEL_INVALID", `labels.${field} は文字にしてください。`);
  }

  return ok(raw);
}

function parseWhyTreeLabels(raw: unknown, fallback: RelicWhyTreeLabels = defaultRelicWhyTreeLabels): RelicResult<RelicWhyTreeLabels> {
  if (raw === undefined) {
    return fail("WHY_TREE_LABELS_MISSING", "構造ツリーの labels を指定してください。");
  }
  if (!isRecord(raw)) {
    return fail("WHY_TREE_LABELS_INVALID", "構造ツリーの labels は項目ごとの文字にしてください。");
  }

  const unknownKey = Object.keys(raw).find((key) => !whyTreeLabelKeys.has(key));
  if (unknownKey) {
    return fail("WHY_TREE_LABELS_UNKNOWN_FIELD", `構造ツリーの labels に未対応の項目があります: ${unknownKey}`);
  }

  const root = parseLabelText(raw.root, fallback.root, "root");
  if (!root.ok) return root;
  const node = parseLabelText(raw.node, fallback.node, "node");
  if (!node.ok) return node;
  const fact = parseLabelText(raw.fact, fallback.fact, "fact");
  if (!fact.ok) return fact;
  const solution = parseLabelText(raw.solution, fallback.solution, "solution");
  if (!solution.ok) return solution;
  const action = parseLabelText(raw.action, fallback.action, "action");
  if (!action.ok) return action;

  return ok({
    action: action.value,
    fact: fact.value,
    node: node.value,
    root: root.value,
    solution: solution.value
  });
}

function serializeWhyTreeNodeValue(node: RelicWhyTreeNode): Record<string, unknown> {
  return {
    title: node.title,
    facts: node.facts,
    solutions: node.solutions,
    actions: node.actions,
    ...(node.whys.length > 0 ? { whys: node.whys.map(serializeWhyTreeNodeValue) } : {})
  };
}

function serializeWhyTreeUpdate(tree: RelicWhyTreeDocument): RelicResult<RelicWhyTreeUpdate> {
  const serialized = serializeRelicWhyTreeMarkdown(tree);
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    tree
  });
}

function updateWhyTreeNodeAtPath(
  phenomenon: RelicWhyTreeNode,
  whyPath: number[],
  update: (node: RelicWhyTreeNode) => RelicWhyTreeNode | RelicResult<RelicWhyTreeNode>
): RelicResult<RelicWhyTreeNode> {
  if (whyPath.length === 0) return normalizeNodeUpdate(update(phenomenon));
  if (whyPath.some((index) => !Number.isInteger(index) || index < 0)) {
    return fail("WHY_TREE_PATH_INVALID", "構造ツリーのパスが正しくありません。");
  }
  const [nextIndex, ...restPath] = whyPath;
  if (nextIndex === undefined || nextIndex >= phenomenon.whys.length) {
    return fail("WHY_TREE_NODE_MISSING", "対象のノードが見つかりません。");
  }

  const nextWhy = updateWhyTreeNodeAtPath(phenomenon.whys[nextIndex], restPath, update);
  if (!nextWhy.ok) return nextWhy;

  return ok({
    ...phenomenon,
    whys: phenomenon.whys.map((why, index) => index === nextIndex ? nextWhy.value : why)
  });
}

function normalizeNodeUpdate(value: RelicWhyTreeNode | RelicResult<RelicWhyTreeNode>): RelicResult<RelicWhyTreeNode> {
  if (isRecord(value) && typeof value.ok === "boolean") return value as RelicResult<RelicWhyTreeNode>;
  return ok(value as RelicWhyTreeNode);
}

function moveArrayItem<T>(items: T[], index: number, offset: number): RelicResult<T[]> {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    return fail("WHY_TREE_ITEM_MISSING", "並べ替える項目が見つかりません。");
  }

  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return fail("WHY_TREE_MOVE_OUT_OF_RANGE", "これ以上並べ替えできません。");
  }

  const nextItems = [...items];
  const [item] = nextItems.splice(index, 1);
  if (item === undefined) {
    return fail("WHY_TREE_ITEM_MISSING", "並べ替える項目が見つかりません。");
  }
  nextItems.splice(nextIndex, 0, item);

  return ok(nextItems);
}

function moveDirectionOffset(direction: RelicWhyTreeMoveDirection): -1 | 1 {
  return direction === "up" ? -1 : 1;
}

function whyTreeSupplementKey(kind: RelicWhyTreeSupplementKind): "facts" | "solutions" | "actions" {
  if (kind === "fact") return "facts";
  if (kind === "solution") return "solutions";
  return "actions";
}

function defaultSupplementTitle(kind: RelicWhyTreeSupplementKind, labels: RelicWhyTreeLabels): string {
  if (kind === "fact") return labels.fact;
  if (kind === "solution") return labels.solution;
  return labels.action;
}

function createNodeForFile(diagram: RelicRelationshipDiagramDocument, filePath: string): RelicDiagramNode {
  return {
    file: filePath,
    height: defaultNodeHeight,
    id: nextNodeId(diagram.nodes),
    width: defaultNodeWidth,
    ...nextNodePosition(diagram.nodes)
  };
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
  if (shape === "note") return "メモ";
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
  return shape === "area" ? -1 : 0;
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

function replaceDiagramNodeFilePaths(
  diagram: RelicRelationshipDiagramDocument,
  kind: RelicDiagramReferenceReplacementKind,
  oldPath: string,
  newPath: string
): { count: number; diagram: RelicRelationshipDiagramDocument } {
  const normalizedOldPath = oldPath.replace(/\\/g, "/");
  const normalizedNewPath = newPath.replace(/\\/g, "/");
  const oldFolderPrefix = `${normalizedOldPath.replace(/\/$/, "")}/`;
  const newFolderPrefix = `${normalizedNewPath.replace(/\/$/, "")}/`;
  let count = 0;

  const nodes = diagram.nodes.map((node) => {
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
    diagram: {
      ...diagram,
      nodes
    }
  };
}

function nextLineId(lines: RelicDiagramLine[]): string {
  const usedIds = new Set(lines.map((line) => line.id));
  let index = 1;

  while (usedIds.has(`line-${index}`)) {
    index += 1;
  }

  return `line-${index}`;
}

function parseDiagramType(raw: unknown): RelicResult<RelicDiagramType> {
  if (!isRelicDiagramType(raw)) {
    return fail("DIAGRAM_TYPE_INVALID", "図解ファイルの type は relationship、why-tree、free-drawing のいずれかにしてください。");
  }

  return ok(raw);
}

function parseRequiredText(raw: unknown, code: string, message: string): RelicResult<string> {
  if (typeof raw !== "string" || raw.trim() !== raw || raw.length === 0) {
    return fail(code, message);
  }

  return ok(raw);
}

function parseWhyTreeText(raw: unknown): RelicResult<string> {
  if (typeof raw !== "string") {
    return fail("WHY_TREE_TEXT_INVALID", "構造ツリーのテキストは文字にしてください。");
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
    return fail("DIAGRAM_NODE_SHAPE_INVALID", "自由図Nodeの shape は対応する図形名にしてください。");
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

function parseNodeFilePath(raw: unknown): RelicResult<string> {
  const parsed = parseRequiredText(raw, "DIAGRAM_NODE_FILE_INVALID", "Nodeの file はMarkdownファイルの相対パスにしてください。");
  if (!parsed.ok) return parsed;
  const filePath = parsed.value;

  if (
    filePath.includes("\0") ||
    filePath.includes("\\") ||
    filePath.startsWith("/") ||
    filePath.split("/").some((segment) => segment === "." || segment === "..") ||
    !hasMarkdownExtension(filePath)
  ) {
    return fail("DIAGRAM_NODE_FILE_INVALID", "Nodeの file はMarkdownファイルの相対パスにしてください。");
  }

  return ok(filePath);
}

function dumpFrontmatter(type: RelicDiagramType, title: string | undefined): string {
  return yaml.dump(
    {
      type,
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
