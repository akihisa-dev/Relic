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

interface MarkdownLine {
  contentEnd: number;
  end: number;
  start: number;
  text: string;
}

const nodeIdPattern = "[A-Za-z_][A-Za-z0-9_-]*";
const nodeIdRegex = new RegExp(`^${nodeIdPattern}$`);
const edgeRegex = new RegExp(`^(${nodeIdPattern})\\s*-->\\s*(${nodeIdPattern})$`);
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

export function parseCanvasMermaid(source: string): CanvasParseResult {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { ok: false, reason: "empty" };

  const headerMatch = /^flowchart\s+(TD|LR)$/.exec(lines[0]);
  if (!headerMatch) return { ok: false, reason: "unsupported" };

  const nodes = new Map<string, Omit<CanvasNode, "x" | "y">>();
  const edges: CanvasEdge[] = [];

  for (const line of lines.slice(1)) {
    const node = parseNodeLine(line);
    if (node) {
      if (nodes.has(node.id)) return { ok: false, reason: "unsupported" };
      nodes.set(node.id, node);
      continue;
    }

    const edgeMatch = edgeRegex.exec(line);
    if (edgeMatch) {
      edges.push({ from: edgeMatch[1], to: edgeMatch[2] });
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
      nodes: layoutNodes(Array.from(nodes.values()), headerMatch[1] as CanvasDirection)
    },
    ok: true
  };
}

export function buildCanvasMermaidSource(diagram: CanvasDiagram): string {
  return [
    `flowchart ${diagram.direction}`,
    ...diagram.nodes.map((node) => `  ${node.id}${shapeSource(node.shape, safeMermaidLabel(node.label))}`),
    ...diagram.edges.map((edge) => `  ${edge.from} --> ${edge.to}`)
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

function parseNodeLine(line: string): Omit<CanvasNode, "x" | "y"> | null {
  const rectangleMatch = rectangleRegex.exec(line);
  if (rectangleMatch) return parseNodeMatch(rectangleMatch, "rectangle");

  const diamondMatch = diamondRegex.exec(line);
  if (diamondMatch) return parseNodeMatch(diamondMatch, "diamond");

  const circleMatch = circleRegex.exec(line);
  if (circleMatch) return parseNodeMatch(circleMatch, "circle");

  return null;
}

function parseNodeMatch(match: RegExpExecArray, shape: CanvasShape): Omit<CanvasNode, "x" | "y"> | null {
  if (!nodeIdRegex.test(match[1])) return null;
  return { id: match[1], label: match[2], shape };
}

function layoutNodes(nodes: Array<Omit<CanvasNode, "x" | "y">>, direction: CanvasDirection): CanvasNode[] {
  return nodes.map((node, index) => {
    const column = direction === "LR" ? index % 4 : index % 3;
    const row = direction === "LR" ? Math.floor(index / 4) : Math.floor(index / 3);

    return {
      ...node,
      x: 72 + column * (direction === "LR" ? 172 : 188),
      y: 72 + row * 112
    };
  });
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
