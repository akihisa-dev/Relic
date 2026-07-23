import {
  getFrontmatterValueCandidatesChannel,
  getWorkspaceAliasesChannel,
  getWorkspaceCardsChannel,
  getWorkspaceGraphChannel,
  getWorkspaceTagsChannel
} from "../../shared/ipc";
import { fail } from "../../shared/result";
import { readWorkspaceAliases } from "../files/aliases";
import { readWorkspaceCards } from "../files/cards";
import { readFrontmatterValueCandidates } from "../files/frontmatterCandidates";
import { readWorkspaceGraph } from "../files/workspaceGraph";
import { readWorkspaceTags } from "../files/tags";
import { workspaceDataProvider } from "../files/workspaceDataProvider";
import { getActiveWorkspaceContext, ipcErrorDetails } from "./activeWorkspace";
import { handleLocalizedIpc } from "./localizedIpcHandler";

export function registerWorkspaceIndexDataHandlers(): void {
  handleLocalizedIpc(getWorkspaceTagsChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;
      const data = await workspaceDataProvider.get({
        userDataPath: context.value.userDataPath,
        workspaceId: context.value.activeWorkspace.id,
        workspacePath: context.value.activeWorkspace.path
      });

      return readWorkspaceTags(data.workspacePath, data.options);
    } catch (error) {
      return fail(
        "TAGS_READ_FAILED",
        "タグを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  handleLocalizedIpc(getFrontmatterValueCandidatesChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;
      const data = await workspaceDataProvider.get({
        userDataPath: context.value.userDataPath,
        workspaceId: context.value.activeWorkspace.id,
        workspacePath: context.value.activeWorkspace.path
      });

      return readFrontmatterValueCandidates(data.workspacePath, data.options);
    } catch (error) {
      return fail(
        "FRONTMATTER_VALUE_CANDIDATES_READ_FAILED",
        "フロントマター候補を読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  handleLocalizedIpc(getWorkspaceAliasesChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;
      const data = await workspaceDataProvider.get({
        userDataPath: context.value.userDataPath,
        workspaceId: context.value.activeWorkspace.id,
        workspacePath: context.value.activeWorkspace.path
      });

      return readWorkspaceAliases(data.workspacePath, data.options);
    } catch (error) {
      return fail(
        "WORKSPACE_ALIASES_FAILED",
        "別名を読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  handleLocalizedIpc(getWorkspaceGraphChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;
      const data = await workspaceDataProvider.get({
        userDataPath: context.value.userDataPath,
        workspaceId: context.value.activeWorkspace.id,
        workspacePath: context.value.activeWorkspace.path
      });

      return readWorkspaceGraph(data.workspacePath, data.options);
    } catch (error) {
      return fail(
        "WORKSPACE_GRAPH_FAILED",
        "関係データを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });
  handleLocalizedIpc(getWorkspaceCardsChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;
      const data = await workspaceDataProvider.get({
        userDataPath: context.value.userDataPath,
        workspaceId: context.value.activeWorkspace.id,
        workspacePath: context.value.activeWorkspace.path
      });

      return readWorkspaceCards(data.workspacePath, data.options);
    } catch (error) {
      return fail(
        "WORKSPACE_CARDS_FAILED",
        "カードを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });
}
