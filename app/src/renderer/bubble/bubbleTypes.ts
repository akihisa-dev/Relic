import type { WorkspaceGraphLink, WorkspaceGraphNode } from "../../shared/ipc";

export interface BubbleOptions {
  centerStrength: number;
  lineSizeMultiplier: number;
  linkDistance: number;
  linkStrength: number;
  nodeSizeMultiplier: number;
  repelStrength: number;
  showArrows: boolean;
  textFadeMultiplier: number;
}

export const defaultBubbleOptions: BubbleOptions = {
  centerStrength: 0.1,
  lineSizeMultiplier: 1,
  linkDistance: 250,
  linkStrength: 0.72,
  nodeSizeMultiplier: 1,
  repelStrength: 10,
  showArrows: false,
  textFadeMultiplier: 0
};

export const bubbleSimulationVelocityDecay = 0.68;

export interface BubbleSimNode extends WorkspaceGraphNode {
  categoryCenterOffsetX?: number;
  categoryCenterOffsetY?: number;
  fx: number | null;
  fy: number | null;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

export interface BubbleSimLink extends WorkspaceGraphLink {
  sourceNode: BubbleSimNode;
  targetNode: BubbleSimNode;
}

export interface BubbleKeyboardState {
  down: boolean;
  left: boolean;
  right: boolean;
  shift: boolean;
  up: boolean;
  zoomIn: boolean;
  zoomOut: boolean;
}

export interface BubbleViewTransform {
  panX: number;
  panY: number;
  scale: number;
  targetScale: number;
  zoomCenterX: number;
  zoomCenterY: number;
}

export type BubbleLinkEndpointNode = Pick<WorkspaceGraphNode, "backlinkCount" | "linkCount"> & {
  x: number;
  y: number;
};

export interface BubbleSimulationNodeSnapshot {
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

export interface BubbleSimulationLinkSnapshot {
  count: number;
  source: string;
  target: string;
}

export interface BubbleSimulationSyncMessage {
  alpha?: number;
  links: BubbleSimulationLinkSnapshot[];
  nodes: BubbleSimulationNodeSnapshot[];
  options: BubbleOptions;
  type: "sync";
}

export interface BubbleSimulationOptionsMessage {
  alpha?: number;
  options: BubbleOptions;
  type: "options";
}

export interface BubbleSimulationFixedNodeMessage {
  alpha?: number;
  id: string;
  type: "fixedNode";
  velocityX?: number;
  velocityY?: number;
  x: number | null;
  y: number | null;
}

export interface BubbleSimulationCategoryCenterOffsetMessage {
  id: string;
  offsetX: number;
  offsetY: number;
  type: "categoryCenterOffset";
}

export interface BubbleSimulationRestartMessage {
  alpha?: number;
  type: "restart";
}

export interface BubbleSimulationDisposeMessage {
  type: "dispose";
}

export type BubbleSimulationRequest =
  | BubbleSimulationCategoryCenterOffsetMessage
  | BubbleSimulationDisposeMessage
  | BubbleSimulationFixedNodeMessage
  | BubbleSimulationOptionsMessage
  | BubbleSimulationRestartMessage
  | BubbleSimulationSyncMessage;

export interface BubbleSimulationPositionsMessage {
  buffer: ArrayBuffer;
  ids: string[];
  type: "positions";
}

export interface BubbleSimulationErrorMessage {
  message: string;
  type: "error";
}

export type BubbleSimulationResponse =
  | BubbleSimulationErrorMessage
  | BubbleSimulationPositionsMessage;
