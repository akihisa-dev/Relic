import type { WorkspaceGraphEdge } from "../shared/ipc";
import type { GraphForceSettings, GraphSimPoint } from "./graphLayout";

export interface GraphSimulationWorkerRequest {
  edges: WorkspaceGraphEdge[];
  forceSettings: GraphForceSettings;
  pinnedPath: string | null;
  points: GraphSimPoint[];
  runId: number;
}

export interface GraphSimulationWorkerResponse {
  points: GraphSimPoint[];
  runId: number;
}
