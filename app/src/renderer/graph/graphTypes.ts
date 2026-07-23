import type { WorkspaceGraphLink, WorkspaceGraphNode } from "../../shared/ipc";

export interface GraphOptions {
  centerStrength: number;
  lineSizeMultiplier: number;
  linkDistance: number;
  linkStrength: number;
  nodeSizeMultiplier: number;
  repelStrength: number;
  showArrows: boolean;
  textFadeMultiplier: number;
}

export const defaultGraphOptions: GraphOptions = {
  centerStrength: 0.1,
  lineSizeMultiplier: 1,
  linkDistance: 250,
  linkStrength: 0.72,
  nodeSizeMultiplier: 1,
  repelStrength: 10,
  showArrows: false,
  textFadeMultiplier: 0
};

export const graphSimulationVelocityDecay = 0.68;

export interface GraphDrawTheme {
  accent: string;
  background: string;
  border: string;
  borderStrong: string;
  primary: string;
  text: string;
  textMuted: string;
  textSecondary: string;
}

export const defaultGraphDrawTheme: GraphDrawTheme = {
  accent: "#f2691b",
  background: "#ffffff",
  border: "#3b3c33",
  borderStrong: "#5b5d52",
  primary: "#1a1b17",
  text: "#1e1e1e",
  textMuted: "#76756c",
  textSecondary: "#62625b"
};

export interface GraphSimNode extends WorkspaceGraphNode {
  categoryCenterOffsetX?: number;
  categoryCenterOffsetY?: number;
  fx: number | null;
  fy: number | null;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

export interface GraphSimLink extends WorkspaceGraphLink {
  sourceNode: GraphSimNode;
  targetNode: GraphSimNode;
}

export interface GraphKeyboardState {
  down: boolean;
  left: boolean;
  right: boolean;
  shift: boolean;
  up: boolean;
  zoomIn: boolean;
  zoomOut: boolean;
}

export interface GraphViewTransform {
  panX: number;
  panY: number;
  scale: number;
  targetScale: number;
  zoomCenterX: number;
  zoomCenterY: number;
}

export type GraphNodePrimaryAction =
  | { path: string; type: "file" }
  | { tag: string; type: "tagSearch" };

export type GraphLinkEndpointNode = Pick<WorkspaceGraphNode, "backlinkCount" | "linkCount"> & {
  x: number;
  y: number;
};

export interface GraphSimulationNodeSnapshot {
  backlinkCount: number;
  category: string | null;
  categoryCenterOffsetX: number;
  categoryCenterOffsetY: number;
  fx: number | null;
  fy: number | null;
  id: string;
  linkCount: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

export interface GraphSimulationLinkSnapshot {
  count: number;
  source: string;
  target: string;
}

export interface GraphSimulationSyncMessage {
  alpha?: number;
  links: GraphSimulationLinkSnapshot[];
  nodes: GraphSimulationNodeSnapshot[];
  options: GraphOptions;
  type: "sync";
}

export interface GraphSimulationOptionsMessage {
  alpha?: number;
  options: GraphOptions;
  type: "options";
}

export interface GraphSimulationFixedNodeMessage {
  alpha?: number;
  id: string;
  type: "fixedNode";
  velocityX?: number;
  velocityY?: number;
  x: number | null;
  y: number | null;
}

export interface GraphSimulationCategoryCenterOffsetMessage {
  id: string;
  offsetX: number;
  offsetY: number;
  type: "categoryCenterOffset";
}

export interface GraphSimulationRestartMessage {
  alpha?: number;
  type: "restart";
}

export interface GraphSimulationDisposeMessage {
  type: "dispose";
}

export type GraphSimulationRequest =
  | GraphSimulationCategoryCenterOffsetMessage
  | GraphSimulationDisposeMessage
  | GraphSimulationFixedNodeMessage
  | GraphSimulationOptionsMessage
  | GraphSimulationRestartMessage
  | GraphSimulationSyncMessage;

export interface GraphSimulationPositionsMessage {
  buffer: ArrayBuffer;
  ids: string[];
  type: "positions";
}

export interface GraphSimulationErrorMessage {
  message: string;
  type: "error";
}

export type GraphSimulationResponse =
  | GraphSimulationErrorMessage
  | GraphSimulationPositionsMessage;
