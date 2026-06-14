import { type RelicWhyTreeNode } from "../../../shared/diagramMarkdown";

export interface WhyTreeConnectorPath {
  d: string;
  id: string;
  labelX: number;
  labelY: number;
}

export interface WhyTreeConnectorLayout {
  height: number;
  paths: WhyTreeConnectorPath[];
  width: number;
}

interface WhyTreeObstacleRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export function buildWhyTreeConnectorPaths(
  node: RelicWhyTreeNode,
  path: number[],
  nodeRefs: Map<string, HTMLDivElement>,
  containerRect: DOMRect,
  obstacles: WhyTreeObstacleRect[],
  collapsedPaths: ReadonlySet<string> = new Set(),
  scale = 1
): WhyTreeConnectorPath[] {
  const parentElement = nodeRefs.get(whyTreePathKey(path));
  if (!parentElement) return [];
  if (collapsedPaths.has(whyTreePathKey(path))) return [];

  const parentRect = parentElement.getBoundingClientRect();
  const parentX = (parentRect.left - containerRect.left + parentRect.width / 2) / scale;
  const parentY = (parentRect.bottom - containerRect.top) / scale;

  return node.whys.flatMap((why, index) => {
    const childPath = [...path, index];
    const childElement = nodeRefs.get(whyTreePathKey(childPath));
    const nestedPaths = buildWhyTreeConnectorPaths(why, childPath, nodeRefs, containerRect, obstacles, collapsedPaths, scale);
    if (!childElement) return nestedPaths;

    const childRect = childElement.getBoundingClientRect();
    const childX = (childRect.left - containerRect.left + childRect.width / 2) / scale;
    const childY = (childRect.top - containerRect.top) / scale;
    const connector = buildWhyTreeConnectorPath(parentX, parentY, childX, childY, obstacles);

    return [{
      ...connector,
      id: `${whyTreePathKey(path)}-${whyTreePathKey(childPath)}`
    }, ...nestedPaths];
  });
}

export function getWhyTreeObstacleRects(contentElement: HTMLElement, containerRect: DOMRect, scale = 1): WhyTreeObstacleRect[] {
  return [...contentElement.querySelectorAll(".why-tree-node-menu, .why-tree-support-item")].map((element) => {
    const rect = element.getBoundingClientRect();

    return {
      bottom: (rect.bottom - containerRect.top) / scale,
      left: (rect.left - containerRect.left) / scale,
      right: (rect.right - containerRect.left) / scale,
      top: (rect.top - containerRect.top) / scale
    };
  });
}

export function whyTreePathKey(path: number[]): string {
  return path.length === 0 ? "phenomenon" : path.join(".");
}

function buildWhyTreeConnectorPath(
  parentX: number,
  parentY: number,
  childX: number,
  childY: number,
  obstacles: WhyTreeObstacleRect[]
): Pick<WhyTreeConnectorPath, "d" | "labelX" | "labelY"> {
  const elbowY = parentY + Math.max(28, (childY - parentY) / 2);
  const blockingObstacle = obstacles.find((obstacle) => (
    verticalSegmentIntersectsRect(parentX, parentY, childY, obstacle) ||
    horizontalSegmentIntersectsRect(parentX, childX, elbowY, obstacle)
  ));
  if (!blockingObstacle) {
    return {
      d: `M ${parentX} ${parentY} V ${elbowY} H ${childX} V ${childY}`,
      labelX: (parentX + childX) / 2,
      labelY: elbowY - 8
    };
  }

  const topY = Math.max(parentY + 12, blockingObstacle.top - 12);
  const bottomY = Math.min(childY - 12, blockingObstacle.bottom + 12);
  if (bottomY <= topY) {
    return {
      d: `M ${parentX} ${parentY} V ${elbowY} H ${childX} V ${childY}`,
      labelX: (parentX + childX) / 2,
      labelY: elbowY - 8
    };
  }

  const candidates = [
    blockingObstacle.right + 16,
    blockingObstacle.left - 16
  ];
  const detourX = candidates.reduce((best, candidate) => (
    obstacleScoreForVerticalSegment(candidate, topY, bottomY, obstacles) < obstacleScoreForVerticalSegment(best, topY, bottomY, obstacles)
      ? candidate
      : best
  ));

  return {
    d: `M ${parentX} ${parentY} V ${topY} H ${detourX} V ${bottomY} H ${childX} V ${childY}`,
    labelX: (detourX + childX) / 2,
    labelY: bottomY - 8
  };
}

function verticalSegmentIntersectsRect(x: number, y1: number, y2: number, rect: WhyTreeObstacleRect): boolean {
  return x >= rect.left && x <= rect.right && Math.max(y1, rect.top) <= Math.min(y2, rect.bottom);
}

function horizontalSegmentIntersectsRect(x1: number, x2: number, y: number, rect: WhyTreeObstacleRect): boolean {
  return y >= rect.top && y <= rect.bottom && Math.max(Math.min(x1, x2), rect.left) <= Math.min(Math.max(x1, x2), rect.right);
}

function obstacleScoreForVerticalSegment(x: number, y1: number, y2: number, obstacles: WhyTreeObstacleRect[]): number {
  return obstacles.filter((obstacle) => verticalSegmentIntersectsRect(x, y1, y2, obstacle)).length;
}
