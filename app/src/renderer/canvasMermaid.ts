export type CanvasDirection = "TD" | "LR";
export type CanvasShape = "rectangle" | "diamond" | "circle";

export interface CanvasNode {
  id: string;
  label: string;
  shape: CanvasShape;
  x: number;
  y: number;
}

export interface CanvasEdge {
  from: string;
  label?: string;
  to: string;
}

export interface CanvasDiagram {
  direction: CanvasDirection;
  edges: CanvasEdge[];
  nodes: CanvasNode[];
}

export interface MermaidMarkdownBlock {
  from: number;
  index: number;
  source: string;
  to: number;
}

export type CanvasParseResult =
  | { diagram: CanvasDiagram; ok: true }
  | { ok: false; reason: "empty" | "unsupported" };

interface RelicCanvasMetadata {
  nodes?: Record<string, {
    x?: unknown;
    y?: unknown;
  }>;
}

interface ParsedCanvasNode extends Omit<CanvasNode, "x" | "y"> {
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
const relicCanvasMetadataPrefix = "%% relic:canvas ";

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

export function parseCanvasMermaid(source: string): CanvasParseResult {
  const metadata = parseRelicCanvasMetadata(source);
  const statements = mermaidStatements(source);
  if (statements.length === 0) return { ok: false, reason: "empty" };

  const headerMatch = /^(?:flowchart|graph)\s+(TD|LR)$/.exec(statements[0]);
  if (!headerMatch) return { ok: false, reason: "unsupported" };

  const nodes = new Map<string, ParsedCanvasNode>();
  const edges: CanvasEdge[] = [];

  for (const statement of statements.slice(1)) {
    const edge = parseEdgeStatement(statement);
    if (edge) {
      const from = parseNodeToken(edge.from);
      const to = parseNodeToken(edge.to);
      if (!from || !to) return { ok: false, reason: "unsupported" };
      if (!upsertCanvasNode(nodes, from)) return { ok: false, reason: "unsupported" };
      if (!upsertCanvasNode(nodes, to)) return { ok: false, reason: "unsupported" };
      edges.push(edge.label === undefined
        ? { from: from.id, to: to.id }
        : { from: from.id, label: edge.label, to: to.id });
      continue;
    }

    const node = parseNodeToken(statement);
    if (node) {
      if (!upsertCanvasNode(nodes, node)) return { ok: false, reason: "unsupported" };
      continue;
    }

    return { ok: false, reason: "unsupported" };
  }

  if (edges.some((edge) => !nodes.has(edge.from) || !nodes.has(edge.to))) {
    return { ok: false, reason: "unsupported" };
  }

  return {
    diagram: {
      direction: headerMatch[1] as CanvasDirection,
      edges,
      nodes: layoutNodes(Array.from(nodes.values()), headerMatch[1] as CanvasDirection, metadata)
    },
    ok: true
  };
}

export function buildCanvasMermaidSource(diagram: CanvasDiagram): string {
  const lines = [
    `flowchart ${diagram.direction}`,
    ...diagram.nodes.map((node) => `  ${node.id}${shapeSource(node.shape, safeMermaidLabel(node.label))}`),
    ...diagram.edges.map((edge) => (
      edge.label === undefined
        ? `  ${edge.from} --> ${edge.to}`
        : `  ${edge.from} -->|${safeMermaidEdgeLabel(edge.label)}| ${edge.to}`
    ))
  ];

  if (diagram.nodes.length > 0) {
    lines.push("", `${relicCanvasMetadataPrefix}${JSON.stringify(buildRelicCanvasMetadata(diagram))}`);
  }

  return lines.join("\n");
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

export function createEmptyCanvasDiagram(direction: CanvasDirection = "TD"): CanvasDiagram {
  return {
    direction,
    edges: [],
    nodes: []
  };
}

export function nextCanvasNodeId(nodes: Pick<CanvasNode, "id">[]): string {
  const usedIds = new Set(nodes.map((node) => node.id));
  let number = nodes.reduce((max, node) => {
    const match = /^node(\d+)$/.exec(node.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;

  while (usedIds.has(`node${number}`)) number += 1;
  return `node${number}`;
}

function parseEdgeStatement(statement: string): { from: string; label?: string; to: string } | null {
  const edgeMatch = edgeRegex.exec(statement);
  if (!edgeMatch) return null;

  const label = edgeMatch[2];
  if (label !== undefined && (label.trim().length === 0 || !isSafeMermaidLabel(label))) return null;

  return label === undefined
    ? { from: edgeMatch[1], to: edgeMatch[3] }
    : { from: edgeMatch[1], label, to: edgeMatch[3] };
}

function parseNodeToken(token: string): ParsedCanvasNode | null {
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

function parseNodeMatch(match: RegExpExecArray, shape: CanvasShape): ParsedCanvasNode | null {
  if (!nodeIdRegex.test(match[1])) return null;
  if (!isSafeMermaidLabel(match[2])) return null;
  return {
    explicit: true,
    id: match[1],
    label: match[2],
    shape
  };
}

function upsertCanvasNode(nodes: Map<string, ParsedCanvasNode>, node: ParsedCanvasNode): boolean {
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

function layoutNodes(
  nodes: ParsedCanvasNode[],
  direction: CanvasDirection,
  metadata: RelicCanvasMetadata | null
): CanvasNode[] {
  return nodes.map((node, index) => {
    const column = direction === "LR" ? index % 4 : index % 3;
    const row = direction === "LR" ? Math.floor(index / 4) : Math.floor(index / 3);
    const position = metadata?.nodes?.[node.id];
    const x = typeof position?.x === "number" && Number.isFinite(position.x)
      ? Math.max(12, position.x)
      : 72 + column * (direction === "LR" ? 172 : 188);
    const y = typeof position?.y === "number" && Number.isFinite(position.y)
      ? Math.max(12, position.y)
      : 72 + row * 112;

    return {
      id: node.id,
      label: node.label,
      shape: node.shape,
      x,
      y
    };
  });
}

function mermaidStatements(source: string): string[] {
  return source
    .split(/\r?\n/)
    .flatMap((line) => line.split(";"))
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("%%"));
}

function parseRelicCanvasMetadata(source: string): RelicCanvasMetadata | null {
  const metadataLine = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith(relicCanvasMetadataPrefix));

  if (!metadataLine) return null;

  try {
    const parsed = JSON.parse(metadataLine.slice(relicCanvasMetadataPrefix.length)) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as RelicCanvasMetadata;
  } catch {
    return null;
  }
}

function buildRelicCanvasMetadata(diagram: CanvasDiagram): RelicCanvasMetadata {
  return {
    nodes: Object.fromEntries(
      diagram.nodes.map((node) => [
        node.id,
        {
          x: Math.round(node.x),
          y: Math.round(node.y)
        }
      ])
    )
  };
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

function shapeSource(shape: CanvasShape, label: string): string {
  if (shape === "diamond") return `{${label}}`;
  if (shape === "circle") return `((${label}))`;

  return `[${label}]`;
}

function safeMermaidLabel(label: string): string {
  return label.replace(/[()[\]{}|]/g, " ").replace(/\s+/g, " ").trim() || "Node";
}

function safeMermaidEdgeLabel(label: string): string {
  const safeLabel = label.replace(/[<>|]/g, " ");
  return safeLabel.trim().length > 0 ? safeLabel : "Label";
}

function isSafeMermaidLabel(label: string): boolean {
  return !/[<>]/.test(label);
}
