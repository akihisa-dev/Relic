export type MermaidDirection = "TD" | "LR";
export type MermaidNodeShape = "rectangle" | "diamond" | "circle";

export interface MermaidNode {
  id: string;
  label: string;
  shape: MermaidNodeShape;
}

export interface MermaidConnection {
  from: string;
  label?: string;
  to: string;
}

export interface MermaidFlowchartModel {
  connections: MermaidConnection[];
  direction: MermaidDirection;
  nodes: MermaidNode[];
}

export interface MermaidMarkdownBlock {
  from: number;
  index: number;
  source: string;
  to: number;
}

export type MermaidFlowchartParseResult =
  | { model: MermaidFlowchartModel; ok: true }
  | { ok: false; reason: "empty" | "unsupported" };

interface ParsedMermaidNode extends MermaidNode {
  explicit: boolean;
}

interface MarkdownLine {
  contentEnd: number;
  end: number;
  start: number;
  text: string;
}

const nodeIdPattern = "[A-Za-z_][A-Za-z0-9_-]*";
const nodeIdRegex = new RegExp(`^${nodeIdPattern}$`);
const edgeRegex = /^(.+?)\s*-->\s*(?:\|([^|]*)\|\s*)?(.+)$/;
const rectangleRegex = new RegExp(`^(${nodeIdPattern})\\s*\\[([^\\]]*)\\]$`);
const diamondRegex = new RegExp(`^(${nodeIdPattern})\\s*\\{([^}]*)\\}$`);
const circleRegex = new RegExp(`^(${nodeIdPattern})\\s*\\(\\(([^)]*)\\)\\)$`);

export function findMermaidMarkdownBlocks(markdown: string): MermaidMarkdownBlock[] {
  const lines = markdownLines(markdown);
  const blocks: MermaidMarkdownBlock[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const openingLine = lines[index];
    if (!/^\s*```\s*mermaid(?:\s|$)/i.test(openingLine.text)) continue;

    for (let closingIndex = index + 1; closingIndex < lines.length; closingIndex += 1) {
      const closingLine = lines[closingIndex];
      if (!/^\s*```\s*$/.test(closingLine.text)) continue;

      const sourceFrom = lines[index + 1]?.start ?? openingLine.contentEnd;
      const sourceTo = closingIndex > index + 1
        ? lines[closingIndex - 1].contentEnd
        : sourceFrom;

      blocks.push({
        from: openingLine.start,
        index: blocks.length,
        source: markdown.slice(sourceFrom, sourceTo),
        to: closingLine.contentEnd
      });
      index = closingIndex;
      break;
    }
  }

  return blocks;
}

export function parseMermaidFlowchart(source: string): MermaidFlowchartParseResult {
  const statements = mermaidStatements(source);
  if (statements.length === 0) return { ok: false, reason: "empty" };

  const headerMatch = /^(?:flowchart|graph)\s+(TD|LR)$/.exec(statements[0]);
  if (!headerMatch) return { ok: false, reason: "unsupported" };

  const nodes = new Map<string, ParsedMermaidNode>();
  const connections: MermaidConnection[] = [];

  for (const statement of statements.slice(1)) {
    const connection = parseConnectionStatement(statement);
    if (connection) {
      const from = parseNodeToken(connection.from);
      const to = parseNodeToken(connection.to);
      if (!from || !to) return { ok: false, reason: "unsupported" };
      if (!upsertMermaidNode(nodes, from)) return { ok: false, reason: "unsupported" };
      if (!upsertMermaidNode(nodes, to)) return { ok: false, reason: "unsupported" };
      connections.push(connection.label === undefined
        ? { from: from.id, to: to.id }
        : { from: from.id, label: connection.label, to: to.id });
      continue;
    }

    const node = parseNodeToken(statement);
    if (node) {
      if (!upsertMermaidNode(nodes, node)) return { ok: false, reason: "unsupported" };
      continue;
    }

    return { ok: false, reason: "unsupported" };
  }

  if (connections.some((connection) => !nodes.has(connection.from) || !nodes.has(connection.to))) {
    return { ok: false, reason: "unsupported" };
  }

  return {
    model: {
      connections,
      direction: headerMatch[1] as MermaidDirection,
      nodes: Array.from(nodes.values()).map(({ explicit: _explicit, ...node }) => node)
    },
    ok: true
  };
}

export function buildMermaidSource(model: MermaidFlowchartModel): string {
  return [
    `flowchart ${model.direction}`,
    ...model.nodes.map((node) => `  ${node.id}${shapeSource(node.shape, safeMermaidLabel(node.label))}`),
    ...model.connections.map((connection) => (
      connection.label === undefined || connection.label.trim().length === 0
        ? `  ${connection.from} --> ${connection.to}`
        : `  ${connection.from} -->|${safeMermaidConnectionLabel(connection.label)}| ${connection.to}`
    ))
  ].join("\n");
}

export function replaceMermaidMarkdownBlock(
  markdown: string,
  block: Pick<MermaidMarkdownBlock, "from" | "to">,
  source: string
): string {
  return `${markdown.slice(0, block.from)}\`\`\`mermaid\n${source}\n\`\`\`${markdown.slice(block.to)}`;
}

export function appendMermaidMarkdownBlock(markdown: string, source: string): string {
  const separator = markdown.length === 0
    ? ""
    : markdown.endsWith("\n\n")
      ? ""
      : markdown.endsWith("\n")
        ? "\n"
        : "\n\n";

  return `${markdown}${separator}\`\`\`mermaid\n${source}\n\`\`\`\n`;
}

export function createEmptyMermaidFlowchart(direction: MermaidDirection = "TD"): MermaidFlowchartModel {
  return {
    connections: [],
    direction,
    nodes: []
  };
}

export function nextMermaidNodeId(nodes: Pick<MermaidNode, "id">[]): string {
  const usedIds = new Set(nodes.map((node) => node.id));
  let number = nodes.reduce((max, node) => {
    const match = /^node(\d+)$/.exec(node.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;

  while (usedIds.has(`node${number}`)) number += 1;
  return `node${number}`;
}

export function isValidMermaidNodeId(id: string): boolean {
  return nodeIdRegex.test(id);
}

export function mermaidConnectionKey(connection: MermaidConnection): string {
  return `${connection.from}->${connection.label ?? ""}->${connection.to}`;
}

function parseConnectionStatement(statement: string): { from: string; label?: string; to: string } | null {
  const connectionMatch = edgeRegex.exec(statement);
  if (!connectionMatch) return null;

  const label = connectionMatch[2];
  if (label !== undefined && (label.trim().length === 0 || !isSafeMermaidLabel(label))) return null;

  return label === undefined
    ? { from: connectionMatch[1], to: connectionMatch[3] }
    : { from: connectionMatch[1], label, to: connectionMatch[3] };
}

function parseNodeToken(token: string): ParsedMermaidNode | null {
  const trimmed = token.trim();

  const rectangleMatch = rectangleRegex.exec(trimmed);
  if (rectangleMatch) return parseNodeMatch(rectangleMatch, "rectangle");

  const diamondMatch = diamondRegex.exec(trimmed);
  if (diamondMatch) return parseNodeMatch(diamondMatch, "diamond");

  const circleMatch = circleRegex.exec(trimmed);
  if (circleMatch) return parseNodeMatch(circleMatch, "circle");

  if (nodeIdRegex.test(trimmed)) {
    return {
      explicit: false,
      id: trimmed,
      label: trimmed,
      shape: "rectangle"
    };
  }

  return null;
}

function parseNodeMatch(match: RegExpExecArray, shape: MermaidNodeShape): ParsedMermaidNode | null {
  if (!nodeIdRegex.test(match[1])) return null;
  if (!isSafeMermaidLabel(match[2])) return null;
  return {
    explicit: true,
    id: match[1],
    label: match[2],
    shape
  };
}

function upsertMermaidNode(nodes: Map<string, ParsedMermaidNode>, node: ParsedMermaidNode): boolean {
  const current = nodes.get(node.id);
  if (!current) {
    nodes.set(node.id, node);
    return true;
  }

  if (!node.explicit) return true;

  if (!current.explicit) {
    nodes.set(node.id, node);
    return true;
  }

  return current.label === node.label && current.shape === node.shape;
}

function mermaidStatements(source: string): string[] {
  return source
    .split(/\r?\n/)
    .flatMap((line) => line.split(";"))
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("%%"));
}

function markdownLines(markdown: string): MarkdownLine[] {
  const lines: MarkdownLine[] = [];
  const regex = /[^\n]*(?:\n|$)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    if (match[0] === "" && match.index === markdown.length) break;

    const rawLine = match[0];
    const lineEndingLength = rawLine.endsWith("\n")
      ? rawLine.endsWith("\r\n") ? 2 : 1
      : 0;
    const text = lineEndingLength > 0 ? rawLine.slice(0, -lineEndingLength) : rawLine;

    lines.push({
      contentEnd: match.index + text.length,
      end: match.index + rawLine.length,
      start: match.index,
      text
    });
  }

  return lines;
}

function shapeSource(shape: MermaidNodeShape, label: string): string {
  if (shape === "diamond") return `{${label}}`;
  if (shape === "circle") return `((${label}))`;

  return `[${label}]`;
}

function safeMermaidLabel(label: string): string {
  return label.replace(/[()[\]{}|]/g, " ").replace(/\s+/g, " ").trim() || "Node";
}

function safeMermaidConnectionLabel(label: string): string {
  const safeLabel = label.replace(/[<>|]/g, " ");
  return safeLabel.trim().length > 0 ? safeLabel : "Label";
}

function isSafeMermaidLabel(label: string): boolean {
  return !/[<>]/.test(label);
}
