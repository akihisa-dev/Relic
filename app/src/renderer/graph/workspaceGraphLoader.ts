import type { WorkspaceGraph } from "../../shared/ipc";
import {
  createWorkspaceResourceLoader,
  type WorkspaceResourceRequest
} from "../workspaceResourceLoader";

export type WorkspaceGraphRequest = WorkspaceResourceRequest;

// Graph and Sphere share raw workspace data through this small, bounded cache.
// New workspace-derived views should use this API instead of calling
// getWorkspaceGraph() directly or introducing another view-specific cache.
const graphLoader = createWorkspaceResourceLoader<WorkspaceGraph>((client) => client.getWorkspaceGraph());

export const loadWorkspaceGraph = graphLoader.load;

export const preloadWorkspaceGraph = graphLoader.preload;

export const resetWorkspaceGraphCache = graphLoader.reset;
