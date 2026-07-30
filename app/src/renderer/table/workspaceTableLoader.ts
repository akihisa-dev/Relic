import type { WorkspaceTable } from "../../shared/ipc";
import { createWorkspaceResourceLoader } from "../workspaceResourceLoader";

const tableLoader = createWorkspaceResourceLoader<WorkspaceTable>((client) => client.getWorkspaceTable());

export const loadWorkspaceTable = tableLoader.load;

export const resetWorkspaceTableCache = tableLoader.reset;
