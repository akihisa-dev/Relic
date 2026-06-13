import * as yaml from "js-yaml";

import { fail, ok, type RelicResult } from "./result";

export const relicDiagramTypes = ["relationship", "why-tree"] as const;
export type RelicDiagramType = typeof relicDiagramTypes[number];

export const relicWhyTreeRoles = ["phenomenon", "why", "fact", "solution", "action"] as const;
export type RelicWhyTreeRole = typeof relicWhyTreeRoles[number];

export interface RelicDiagramDocument {
  lines: RelicDiagramLine[];
  nodes: RelicDiagramNode[];
  title?: string;
  type: RelicDiagramType;
}

export interface RelicDiagramNode {
  file: string;
  height: number;
  id: string;
  role?: RelicWhyTreeRole;
  width: number;
  x: number;
  y: number;
}

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
  node: RelicDiagramNode;
}

export interface RelicDiagramNodeMove {
  content: string;
  node: RelicDiagramNode;
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

export interface RelicDiagramNodeRoleUpdate {
  content: string;
  node: RelicDiagramNode;
}

interface DiagramFrontmatter {
  title?: string;
  type: RelicDiagramType;
}

interface ParsedDiagramMarkdownParts {
  body: string;
  frontmatter: DiagramFrontmatter;
}

const diagramBodyKeys = new Set(["nodes", "lines"]);
const relationshipNodeKeys = new Set(["id", "file", "x", "y", "width", "height"]);
const whyTreeNodeKeys = new Set(["id", "file", "role", "x", "y", "width", "height"]);
const diagramLineKeys = new Set(["id", "from", "to", "label"]);
const diagramFrontmatterKeys = new Set(["type", "title"]);
const defaultNodeWidth = 180;
const defaultNodeHeight = 80;

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
  "title: 原因分析",
  "---",
  "",
  "nodes: []",
  "lines: []",
  ""
].join("\n");

export const emptyRelicDiagramMarkdownContent = emptyRelicRelationshipMarkdownContent;

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

  return validateRelicDiagramDocument({
    ...body,
    title: parts.value.frontmatter.title,
    type: parts.value.frontmatter.type
  });
}

export function serializeRelicDiagramMarkdown(document: RelicDiagramDocument): RelicResult<string> {
  const validated = validateRelicDiagramDocument(document);
  if (!validated.ok) return validated;

  const frontmatter = yaml.dump(
    {
      type: validated.value.type,
      ...(validated.value.title ? { title: validated.value.title } : {})
    },
    {
      lineWidth: -1,
      noRefs: true,
      schema: yaml.JSON_SCHEMA,
      sortKeys: false
    }
  ).trimEnd();
  const body = yaml.dump(
    {
      nodes: validated.value.nodes.map((node) => ({
        id: node.id,
        file: node.file,
        ...(validated.value.type === "why-tree" ? { role: node.role } : {}),
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

  return ok(`---\n${frontmatter}\n---\n\n${body}`);
}

export function replaceRelicDiagramNodeFileReferences(
  content: string,
  kind: RelicDiagramReferenceReplacementKind,
  oldPath: string,
  newPath: string
): RelicResult<RelicDiagramReferenceReplacement> {
  if (!isRelicDiagramMarkdownContent(content)) {
    return ok({ content, count: 0 });
  }

  const parsed = parseRelicDiagramMarkdown(content);
  if (!parsed.ok) return parsed;

  const replacement = replaceDiagramNodeFilePaths(parsed.value, kind, oldPath, newPath);
  if (replacement.count === 0) {
    return ok({ content, count: 0 });
  }

  const serialized = serializeRelicDiagramMarkdown(replacement.diagram);
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    count: replacement.count
  });
}

export function addRelicDiagramNodeForFile(
  content: string,
  filePath: string
): RelicResult<RelicDiagramNodeInsertion> {
  const parsed = parseRelicDiagramMarkdown(content);
  if (!parsed.ok) return parsed;

  const file = parseNodeFilePath(filePath);
  if (!file.ok) return file;

  const node = createNodeForFile(parsed.value, file.value);
  const serialized = serializeRelicDiagramMarkdown({
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
  const parsed = parseRelicDiagramMarkdown(content);
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
  const serialized = serializeRelicDiagramMarkdown({
    ...parsed.value,
    nodes: parsed.value.nodes.map((item) => item.id === nodeId ? nextNode : item)
  });
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    node: nextNode
  });
}

export function updateRelicDiagramNodeRole(
  content: string,
  nodeId: string,
  role: RelicWhyTreeRole
): RelicResult<RelicDiagramNodeRoleUpdate> {
  const parsed = parseRelicDiagramMarkdown(content);
  if (!parsed.ok) return parsed;
  if (parsed.value.type !== "why-tree") {
    return fail("DIAGRAM_ROLE_UNSUPPORTED", "roleはwhy-treeでだけ変更できます。");
  }

  const id = parseRequiredText(nodeId, "DIAGRAM_NODE_ID_INVALID", "Nodeの id を指定してください。");
  if (!id.ok) return id;
  const nextRole = parseWhyTreeRole(role);
  if (!nextRole.ok) return nextRole;

  const node = parsed.value.nodes.find((item) => item.id === id.value);
  if (!node) {
    return fail("DIAGRAM_NODE_MISSING", "roleを変更するNodeが見つかりません。");
  }

  const nextNode = {
    ...node,
    role: nextRole.value
  };
  const serialized = serializeRelicDiagramMarkdown({
    ...parsed.value,
    nodes: parsed.value.nodes.map((item) => item.id === id.value ? nextNode : item)
  });
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    node: nextNode
  });
}

export function addRelicDiagramLine(
  content: string,
  fromNodeId: string,
  toNodeId: string
): RelicResult<RelicDiagramLineInsertion> {
  const parsed = parseRelicDiagramMarkdown(content);
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

  const line = {
    from: from.value,
    id: nextLineId(parsed.value.lines),
    label: "",
    to: to.value
  };
  const nextDocument = {
    ...parsed.value,
    lines: [...parsed.value.lines, line]
  };
  const serialized = serializeRelicDiagramMarkdown(nextDocument);
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    line
  });
}

export function removeRelicDiagramNode(content: string, nodeId: string): RelicResult<RelicDiagramDeletion> {
  const parsed = parseRelicDiagramMarkdown(content);
  if (!parsed.ok) return parsed;

  const id = parseRequiredText(nodeId, "DIAGRAM_NODE_ID_INVALID", "Nodeの id を指定してください。");
  if (!id.ok) return id;

  const nextNodes = parsed.value.nodes.filter((node) => node.id !== id.value);
  if (nextNodes.length === parsed.value.nodes.length) {
    return fail("DIAGRAM_NODE_MISSING", "削除するNodeが見つかりません。");
  }

  const nextLines = parsed.value.lines.filter((line) => line.from !== id.value && line.to !== id.value);
  const serialized = serializeRelicDiagramMarkdown({
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

export function removeRelicDiagramLine(content: string, lineId: string): RelicResult<RelicDiagramDeletion> {
  const parsed = parseRelicDiagramMarkdown(content);
  if (!parsed.ok) return parsed;

  const id = parseRequiredText(lineId, "DIAGRAM_LINE_ID_INVALID", "Lineの id を指定してください。");
  if (!id.ok) return id;

  const nextLines = parsed.value.lines.filter((line) => line.id !== id.value);
  if (nextLines.length === parsed.value.lines.length) {
    return fail("DIAGRAM_LINE_MISSING", "削除するLineが見つかりません。");
  }

  const serialized = serializeRelicDiagramMarkdown({
    ...parsed.value,
    lines: nextLines
  });
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
  const parsed = parseRelicDiagramMarkdown(content);
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
  const serialized = serializeRelicDiagramMarkdown({
    ...parsed.value,
    lines: parsed.value.lines.map((item) => item.id === id.value ? nextLine : item)
  });
  if (!serialized.ok) return serialized;

  return ok({
    content: serialized.value,
    line: nextLine
  });
}

export function validateRelicDiagramDocument(raw: unknown): RelicResult<RelicDiagramDocument> {
  if (!isRecord(raw)) {
    return fail("DIAGRAM_FORMAT_INVALID", "図解ファイルの形式が正しくありません。");
  }

  const type = parseDiagramType(raw.type);
  if (!type.ok) return type;
  const title = raw.title === undefined ? undefined : parseOptionalText(raw.title, "DIAGRAM_TITLE_INVALID", "図解の title は文字にしてください。");
  if (title && !title.ok) return title;

  const allowedTopLevelKeys = new Set([...diagramBodyKeys, ...diagramFrontmatterKeys]);
  const unknownTopLevelKey = Object.keys(raw).find((key) => !allowedTopLevelKeys.has(key));
  if (unknownTopLevelKey) {
    return fail("DIAGRAM_UNKNOWN_FIELD", `図解ファイルに未対応の項目があります: ${unknownTopLevelKey}`);
  }

  const nodes = parseNodes(raw.nodes, type.value);
  if (!nodes.ok) return nodes;

  const lines = parseLines(raw.lines, nodes.value);
  if (!lines.ok) return lines;

  const document = {
    lines: lines.value,
    nodes: nodes.value,
    ...(title?.value ? { title: title.value } : {}),
    type: type.value
  };
  const treeValidation = type.value === "why-tree" ? validateWhyTree(document) : ok(document);
  if (!treeValidation.ok) return treeValidation;

  return ok(document);
}

function createNodeForFile(diagram: RelicDiagramDocument, filePath: string): RelicDiagramNode {
  return {
    file: filePath,
    height: defaultNodeHeight,
    id: nextNodeId(diagram.nodes),
    ...(diagram.type === "why-tree" ? { role: diagram.nodes.length === 0 ? "phenomenon" as const : "why" as const } : {}),
    width: defaultNodeWidth,
    ...nextNodePosition(diagram.nodes)
  };
}

function nextNodeId(nodes: RelicDiagramNode[]): string {
  const usedIds = new Set(nodes.map((node) => node.id));
  let index = 1;

  while (usedIds.has(`node-${index}`)) {
    index += 1;
  }

  return `node-${index}`;
}

function nextNodePosition(nodes: RelicDiagramNode[]): Pick<RelicDiagramNode, "x" | "y"> {
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
  diagram: RelicDiagramDocument,
  kind: RelicDiagramReferenceReplacementKind,
  oldPath: string,
  newPath: string
): { count: number; diagram: RelicDiagramDocument } {
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

function parseNodes(rawNodes: unknown, type: RelicDiagramType): RelicResult<RelicDiagramNode[]> {
  if (rawNodes === undefined) return ok([]);
  if (!Array.isArray(rawNodes)) {
    return fail("DIAGRAM_NODES_INVALID", "図解ファイルの nodes は一覧にしてください。");
  }

  const nodeIds = new Set<string>();
  const nodes: RelicDiagramNode[] = [];
  const allowedNodeKeys = type === "why-tree" ? whyTreeNodeKeys : relationshipNodeKeys;

  for (const [index, rawNode] of rawNodes.entries()) {
    if (!isRecord(rawNode)) {
      return fail("DIAGRAM_NODE_INVALID", `nodes の ${index + 1} 件目が正しくありません。`);
    }

    const unknownKey = Object.keys(rawNode).find((key) => !allowedNodeKeys.has(key));
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

    const role = type === "why-tree" ? parseWhyTreeRole(rawNode.role) : ok(undefined);
    if (!role.ok) return role;
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
      ...(role.value ? { role: role.value } : {}),
      width: width.value,
      x: x.value,
      y: y.value
    });
  }

  return ok(nodes);
}

function parseLines(rawLines: unknown, nodes: RelicDiagramNode[]): RelicResult<RelicDiagramLine[]> {
  if (rawLines === undefined) return ok([]);
  if (!Array.isArray(rawLines)) {
    return fail("DIAGRAM_LINES_INVALID", "図解ファイルの lines は一覧にしてください。");
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const lineIds = new Set<string>();
  const lines: RelicDiagramLine[] = [];

  for (const [index, rawLine] of rawLines.entries()) {
    if (!isRecord(rawLine)) {
      return fail("DIAGRAM_LINE_INVALID", `lines の ${index + 1} 件目が正しくありません。`);
    }

    const unknownKey = Object.keys(rawLine).find((key) => !diagramLineKeys.has(key));
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

    const label = parseOptionalText(rawLine.label, "DIAGRAM_LINE_LABEL_INVALID", "Lineの label は文字にしてください。");
    if (!label.ok) return label;

    lineIds.add(id.value);
    lines.push({
      from: from.value,
      id: id.value,
      label: label.value,
      to: to.value
    });
  }

  return ok(lines);
}

function validateWhyTree(document: RelicDiagramDocument): RelicResult<RelicDiagramDocument> {
  if (document.nodes.length === 0) return ok(document);
  const incomingCounts = new Map(document.nodes.map((node) => [node.id, 0]));

  for (const line of document.lines) {
    incomingCounts.set(line.to, (incomingCounts.get(line.to) ?? 0) + 1);
  }

  const multipleParentNode = [...incomingCounts.entries()].find(([, count]) => count > 1);
  if (multipleParentNode) {
    return fail("DIAGRAM_WHY_TREE_MULTI_PARENT", "why-treeでは1つのNodeに複数の親を持たせられません。");
  }

  if (hasDirectedCycle(document.nodes.map((node) => node.id), document.lines)) {
    return fail("DIAGRAM_WHY_TREE_CYCLE", "why-treeでは循環するLineを作れません。");
  }

  return ok(document);
}

function hasDirectedCycle(nodeIds: string[], lines: RelicDiagramLine[]): boolean {
  const outgoing = new Map(nodeIds.map((id) => [id, [] as string[]]));
  for (const line of lines) {
    outgoing.get(line.from)?.push(line.to);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visiting.add(nodeId);
    for (const next of outgoing.get(nodeId) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  return nodeIds.some((nodeId) => visit(nodeId));
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
    return fail("DIAGRAM_TYPE_INVALID", "図解ファイルの type は relationship または why-tree にしてください。");
  }

  return ok(raw);
}

function parseWhyTreeRole(raw: unknown): RelicResult<RelicWhyTreeRole> {
  if (typeof raw !== "string" || !relicWhyTreeRoles.includes(raw as RelicWhyTreeRole)) {
    return fail("DIAGRAM_NODE_ROLE_INVALID", "why-treeのNode roleはphenomenon、why、fact、solution、actionのいずれかにしてください。");
  }

  return ok(raw as RelicWhyTreeRole);
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
  const parsed = parseRequiredText(raw, "DIAGRAM_NODE_FILE_INVALID", "Nodeの file はMarkdownファイルの相対パスにしてください。");
  if (!parsed.ok) return parsed;
  const filePath = parsed.value;

  if (
    filePath.includes("\0") ||
    filePath.includes("\\") ||
    filePath.startsWith("/") ||
    filePath.split("/").some((segment) => segment === "." || segment === "..") ||
    !filePath.endsWith(".md")
  ) {
    return fail("DIAGRAM_NODE_FILE_INVALID", "Nodeの file はMarkdownファイルの相対パスにしてください。");
  }

  return ok(filePath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorDetails(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
