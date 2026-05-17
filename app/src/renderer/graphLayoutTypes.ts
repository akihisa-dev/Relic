import type { WorkspaceGraph, WorkspaceGraphEdge, WorkspaceGraphNode } from "../shared/ipc";
import type { GraphLinkFilter } from "./store/graphStore";

export interface GraphPoint extends WorkspaceGraphNode {
  degree: number;
  incoming: number;
  outgoing: number;
  x: number;
  y: number;
}

export interface GraphSimPoint extends GraphPoint {
  vx: number;
  vy: number;
}

export type GraphLayoutMode = "standard" | "radial" | "cluster" | "scatter";

export interface GraphViewModel {
  edges: WorkspaceGraphEdge[];
  nodes: WorkspaceGraphNode[];
}

export interface GraphForceSettings {
  centerForce: number;
  linkDistance: number;
  linkForce: number;
  repelForce: number;
}

export interface GraphPan {
  x: number;
  y: number;
}

export interface GraphViewBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface NodeStats {
  incoming: number;
  outgoing: number;
}

export interface BuildFilteredGraphInput {
  activeFilePath: string | null;
  folderFilter: string;
  graph: WorkspaceGraph | null;
  linkFilter: GraphLinkFilter;
  localGraphDepth: number;
  minDegree: number;
  query: string;
  showOrphans: boolean;
  tagFilter: string;
}
