import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { defaultAutoSyncSettings, defaultFeatureToggles } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { ToolsSidebar } from "./ToolsSidebar";

function makeRelicApi(overrides: Partial<typeof window.relic> = {}): typeof window.relic {
  return {
    applySearchAndReplace: vi.fn(),
    cloneGitHubRepository: vi.fn(),
    connectGitRemote: vi.fn(),
    connectGitHubAccount: vi.fn(),
    createFolder: vi.fn(),
    createGitBranch: vi.fn(),
    createGitCommit: vi.fn(),
    createGitTag: vi.fn(),
    createLinkedMarkdownFile: vi.fn(),
    createMarkdownFile: vi.fn(),
    createNewWorkspace: vi.fn(),
    deleteGitTag: vi.fn(),
    disconnectGitHubAccount: vi.fn(),
    duplicateMarkdownFile: vi.fn(),
    generateTableOfContents: vi.fn(),
    generateTitleList: vi.fn(),
    getAppInfo: vi.fn(),
    getAutoSyncSettings: vi.fn().mockResolvedValue({ ok: true, value: defaultAutoSyncSettings }),
    getBacklinks: vi.fn(),
    getEditorSettings: vi.fn(),
    getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: defaultFeatureToggles }),
    getGitBranches: vi.fn(),
    getGitCommitDiff: vi.fn(),
    getGitCommitHistory: vi.fn(),
    getGitConflicts: vi.fn(),
    getGitHubAuthStatus: vi.fn(),
    getGitRemotes: vi.fn(),
    getGitStatus: vi.fn(),
    getGitSyncPreview: vi.fn(),
    getGitTags: vi.fn(),
    getGitWorkingChanges: vi.fn(),
    getMarkdownTemplates: vi.fn(),
    getUserDefinedFields: vi.fn(),
    getWorkspaceState: vi.fn(),
    getWorkspaceTags: vi.fn(),
    initializeGitRepository: vi.fn(),
    mergeFiles: vi.fn().mockResolvedValue({ ok: true, value: "merged.md" }),
    moveFolder: vi.fn(),
    moveItemToTrash: vi.fn(),
    moveMarkdownFile: vi.fn(),
    openWorkspace: vi.fn(),
    pullGitBranch: vi.fn(),
    pushGitBranch: vi.fn(),
    pushGitTag: vi.fn(),
    readMarkdownFile: vi.fn(),
    removeWorkspace: vi.fn(),
    renameFolder: vi.fn(),
    renameMarkdownFile: vi.fn(),
    replaceInFile: vi.fn(),
    resolveGitConflict: vi.fn(),
    saveAutoSyncSettings: vi.fn(),
    saveEditorSettings: vi.fn(),
    saveFeatureToggles: vi.fn(),
    saveUserDefinedFields: vi.fn(),
    searchAndReplace: vi.fn(),
    searchWorkspace: vi.fn(),
    splitFileByHeading: vi.fn(),
    switchGitBranch: vi.fn(),
    switchWorkspace: vi.fn(),
    togglePin: vi.fn(),
    writeMarkdownFile: vi.fn(),
    ...overrides
  } as typeof window.relic;
}

describe("ToolsSidebar", () => {
  it("フロントマター条件を指定してマージできる", async () => {
    const mergeFiles = vi.fn().mockResolvedValue({ ok: true, value: "merged.md" });
    window.relic = makeRelicApi({ mergeFiles });

    render(
      <I18nProvider language="ja">
        <ToolsSidebar workspacePath="/tmp/notes" />
      </I18nProvider>
    );

    fireEvent.change(screen.getByLabelText("フィルター"), { target: { value: "frontmatter" } });
    fireEvent.change(screen.getByLabelText("フロントマターフィールド"), { target: { value: "status" } });
    fireEvent.change(screen.getByLabelText("フロントマター値"), { target: { value: "draft" } });
    fireEvent.click(screen.getByRole("button", { name: "条件指定マージ" }));

    await waitFor(() => {
      expect(mergeFiles).toHaveBeenCalledWith(expect.objectContaining({
        filterType: "frontmatter",
        filterValue: "draft",
        frontmatterField: "status"
      }));
    });
  });
});
