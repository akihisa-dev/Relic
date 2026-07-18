import { describe, expect, it } from "vitest";

import { relicApiContractVersion, relicIpcContract } from "./ipc";

describe("IPC public contract", () => {
  it("契約バージョンと既存チャンネル文字列を維持する", () => {
    expect(relicApiContractVersion).toBe(1);
    expect(contractChannels()).toEqual({
      applySearchAndReplace: "workspace:applySearchAndReplace",
      applyUnlinkedReference: "workspace:applyUnlinkedReference",
      copyDiagramSvg: "output:copyDiagramSvg",
      copyEditorTextToClipboard: "editor:copyTextToClipboard",
      copyWorkspaceItemPath: "workspace:copyItemPath",
      createFolder: "workspace:createFolder",
      createLinkedMarkdownFile: "workspace:createLinkedMarkdownFile",
      createMarkdownFile: "workspace:createMarkdownFile",
      createNewWorkspace: "workspace:createNew",
      duplicateMarkdownFile: "workspace:duplicateMarkdownFile",
      generateTableOfContents: "tools:generateTableOfContents",
      generateTagIndex: "tools:generateTagIndex",
      generateTitleList: "tools:generateTitleList",
      getAppInfo: "app:getInfo",
      getBacklinks: "workspace:getBacklinks",
      getDroppedFilePath: null,
      getEditorSettings: "editor:getSettings",
      getFeatureToggles: "app:getFeatureToggles",
      getFrontmatterTemplates: "app:getFrontmatterTemplates",
      getFrontmatterValueCandidates: "workspace:getFrontmatterValueCandidates",
      getLinkUpdateImpact: "workspace:getLinkUpdateImpact",
      getUnlinkedReferences: "workspace:getUnlinkedReferences",
      getUserDefinedFields: "app:getUserDefinedFields",
      getWorkspaceAliases: "workspace:getAliases",
      getWorkspaceCharts: "workspace:getCharts",
      getWorkspaceCards: "workspace:getCards",
      getWorkspaceFrontmatterCategoryChoices: "workspace:getFrontmatterCategoryChoices",
      getWorkspaceGraph: "workspace:getGraph",
      getWorkspaceState: "workspace:getState",
      getWorkspaceTable: "workspace:getTable",
      getWorkspaceTags: "workspace:getTags",
      importImageFile: "workspace:importImageFile",
      importMarkdownFiles: "workspace:importMarkdownFiles",
      listFileRecoverySnapshots: "workspace:listFileRecoverySnapshots",
      mergeFiles: "tools:mergeFiles",
      moveFolder: "workspace:moveFolder",
      moveItemToTrash: "workspace:moveItemToTrash",
      moveMarkdownFile: "workspace:moveMarkdownFile",
      onWindowCloseRequested: "window:closeRequested",
      onWorkspaceChanged: "workspace:changed",
      onWorkspaceWatcherStatus: "workspace:watcherStatus",
      openWorkspace: "workspace:open",
      readEditorTextFromClipboard: "editor:readTextFromClipboard",
      readFileRecoverySnapshot: "workspace:readFileRecoverySnapshot",
      readImageFile: "workspace:readImageFile",
      readMarkdownFile: "workspace:readMarkdownFile",
      readPdfFile: "workspace:readPdfFile",
      refreshWorkspace: "workspace:refresh",
      removeWorkspace: "workspace:remove",
      renameFolder: "workspace:renameFolder",
      renameMarkdownFile: "workspace:renameMarkdownFile",
      renameWorkspace: "workspace:rename",
      replaceInFile: "workspace:replaceInFile",
      respondToWindowCloseRequest: "window:closeResponse",
      revealWorkspaceItem: "workspace:revealItem",
      saveDiagramSvg: "output:saveDiagramSvg",
      saveEditorSettings: "editor:saveSettings",
      saveFeatureToggles: "app:saveFeatureToggles",
      saveFrontmatterTemplates: "app:saveFrontmatterTemplates",
      savePreviewAsPdf: "output:savePreviewAsPdf",
      saveUserDefinedFields: "app:saveUserDefinedFields",
      saveWorkspaceCharts: "workspace:saveCharts",
      saveWorkspaceFrontmatterCategoryChoices: "workspace:saveFrontmatterCategoryChoices",
      saveWorkspaceTableProperties: "workspace:saveTableProperties",
      searchAndReplace: "workspace:searchAndReplace",
      searchWorkspace: "workspace:search",
      startWorkspaceFileDrag: "workspace:startFileDrag",
      switchWorkspace: "workspace:switch",
      togglePin: "workspace:togglePin",
      updateChartEntry: "workspace:updateChartEntry",
      writeMarkdownFile: "workspace:writeMarkdownFile"
    });
  });

  it("IPCチャンネルを複数のAPIメソッドで重複利用しない", () => {
    const channels = Object.values(contractChannels()).filter((channel) => channel !== null);
    expect(new Set(channels).size).toBe(channels.length);
  });
});

function contractChannels(): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(relicIpcContract).map(([method, entry]) => [method, entry.channel])
  );
}
