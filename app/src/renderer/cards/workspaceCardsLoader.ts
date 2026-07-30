import type { WorkspaceCard } from "../../shared/ipc";
import {
  createWorkspaceResourceLoader,
  type WorkspaceResourceRequest
} from "../workspaceResourceLoader";

export type WorkspaceCardsRequest = WorkspaceResourceRequest;

const cardsLoader = createWorkspaceResourceLoader<WorkspaceCard[]>((client) => client.getWorkspaceCards());

export const loadWorkspaceCards = cardsLoader.load;

export const resetWorkspaceCardsCache = cardsLoader.reset;
