import { type ReactElement, useMemo } from "react";

import {
  parseRelicMapMarkdown,
  type RelicMapDocument,
  type RelicMapLine,
  type RelicMapNode
} from "../../shared/mapMarkdown";
import { useT } from "../i18n";

interface MapCanvasProps {
  content: string;
  fileName: string;
}

interface MapCanvasLayout {
  height: number;
  lines: MapCanvasLineLayout[];
  nodes: MapCanvasNodeLayout[];
  width: number;
}

interface MapCanvasNodeLayout {
  node: RelicMapNode;
  x: number;
  y: number;
}

interface MapCanvasLineLayout {
  label: string;
  line: RelicMapLine;
  labelX: number;
  labelY: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

const canvasPadding = 180;
const minCanvasWidth = 900;
const minCanvasHeight = 620;

export function MapCanvas({ content, fileName }: MapCanvasProps): ReactElement {
  const t = useT();
  const parsed = useMemo(() => parseRelicMapMarkdown(content), [content]);

  if (!parsed.ok) {
    return (
      <div className="map-canvas map-canvas--invalid" role="alert">
        <p>{t("map.invalidFile")}</p>
      </div>
    );
  }

  const layout = buildMapCanvasLayout(parsed.value);

  return (
    <div aria-label={fileName} className="map-canvas" role="img">
      {layout.nodes.length === 0 ? (
        <p className="map-canvas-empty">{t("map.emptyCanvas")}</p>
      ) : null}
      <div
        className="map-canvas-space"
        style={{
          height: layout.height,
          width: layout.width
        }}
      >
        <svg
          aria-hidden="true"
          className="map-canvas-lines"
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
        >
          {layout.lines.map((line) => (
            <g key={line.line.id}>
              <path className="map-canvas-line" d={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`} />
              {line.label ? (
                <text className="map-canvas-line-label" x={line.labelX} y={line.labelY}>
                  {line.label}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
        <div className="map-canvas-nodes">
          {layout.nodes.map(({ node, x, y }) => (
            <div
              className="map-canvas-node"
              key={node.id}
              style={{
                height: node.height,
                left: x,
                top: y,
                width: node.width
              }}
              title={node.file}
            >
              <span className="map-canvas-node-name">{nodeFileName(node.file)}</span>
              <span className="map-canvas-node-path">{node.file}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function mapCanvasStatus(content: string, t: ReturnType<typeof useT>): string {
  const parsed = parseRelicMapMarkdown(content);
  if (!parsed.ok) return t("map.invalidStatus");

  return t("map.status", {
    lines: parsed.value.lines.length,
    nodes: parsed.value.nodes.length
  });
}

function buildMapCanvasLayout(map: RelicMapDocument): MapCanvasLayout {
  if (map.nodes.length === 0) {
    return {
      height: minCanvasHeight,
      lines: [],
      nodes: [],
      width: minCanvasWidth
    };
  }

  const minX = Math.min(...map.nodes.map((node) => node.x));
  const minY = Math.min(...map.nodes.map((node) => node.y));
  const maxX = Math.max(...map.nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...map.nodes.map((node) => node.y + node.height));
  const originX = minX - canvasPadding;
  const originY = minY - canvasPadding;
  const nodes = map.nodes.map((node) => ({
    node,
    x: node.x - originX,
    y: node.y - originY
  }));
  const nodeById = new Map(nodes.map((node) => [node.node.id, node]));

  return {
    height: Math.max(minCanvasHeight, maxY - minY + canvasPadding * 2),
    lines: map.lines.flatMap((line) => {
      const from = nodeById.get(line.from);
      const to = nodeById.get(line.to);
      if (!from || !to) return [];

      const x1 = from.x + from.node.width / 2;
      const y1 = from.y + from.node.height / 2;
      const x2 = to.x + to.node.width / 2;
      const y2 = to.y + to.node.height / 2;

      return [{
        label: line.label,
        labelX: (x1 + x2) / 2,
        labelY: (y1 + y2) / 2 - 8,
        line,
        x1,
        x2,
        y1,
        y2
      }];
    }),
    nodes,
    width: Math.max(minCanvasWidth, maxX - minX + canvasPadding * 2)
  };
}

function nodeFileName(filePath: string): string {
  const name = filePath.split("/").at(-1) ?? filePath;
  return name.endsWith(".md") ? name.slice(0, -3) : name;
}
