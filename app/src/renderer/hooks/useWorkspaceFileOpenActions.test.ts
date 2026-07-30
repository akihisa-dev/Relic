import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MarkdownFileContent, WorkspaceState } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { useWorkspaceFileOpenActions } from "./useWorkspaceFileOpenActions";
import { useWorkspaceRegistryActions } from "./useWorkspaceRegistryActions";
import { useWorkspaceRequestGuard } from "./useWorkspaceRequestGuard";

describe("useWorkspaceFileOpenActions", () => {
  afterEach(() => {
    window.relic = undefined;
  });

  it("ワークスペース切替後に完了した旧読込をタブへ適用しない", async () => {
    const first = deferred<RelicResult<MarkdownFileContent>>();
    const second = deferred<RelicResult<MarkdownFileContent>>();
    const openFileInPane = vi.fn();
    window.relic = makeRelicApi({
      readMarkdownFile: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
    });
    const pane = { activeTabId: null, history: [], tabIds: [] };
    const callbacks = {
      openFileInPane,
      openImageInPane: vi.fn(),
      openPdfInPane: vi.fn(),
      setLeftPaneScrollHeading: vi.fn(),
      setRightPaneScrollHeading: vi.fn(),
      setWorkspaceError: vi.fn(),
      setWorkspaceState: vi.fn()
    };

    const { result, rerender } = renderHook(
      ({ activeWorkspaceId }) => {
        const guard = useWorkspaceRequestGuard(activeWorkspaceId);
        return useWorkspaceFileOpenActions({
          ...guard,
          activeWorkspaceId,
          aliasesByPath: {},
          existingMarkdownPaths: ["A.md", "B.md"],
          focusedPane: "left",
          leftPane: pane,
          rightPane: pane,
          tabs: {},
          ...callbacks
        });
      },
      { initialProps: { activeWorkspaceId: "workspace-a" as string | null } }
    );

    act(() => result.current.handleOpenFile("A.md"));
    rerender({ activeWorkspaceId: "workspace-b" });
    act(() => result.current.handleOpenFile("B.md"));

    await act(async () => first.resolve({ ok: true, value: file("A.md") }));
    expect(openFileInPane).not.toHaveBeenCalled();

    await act(async () => second.resolve({ ok: true, value: file("B.md") }));
    expect(openFileInPane).toHaveBeenCalledWith("left", file("B.md"));
  });

  it("切替成功と同じbatchで旧読込が完了しても閉じたタブを開き直さない", async () => {
    const read = deferred<RelicResult<MarkdownFileContent>>();
    const switched = deferred<RelicResult<WorkspaceState>>();
    const openFileInPane = vi.fn();
    const setWorkspaceState = vi.fn();
    const closeAllTabs = vi.fn();
    window.relic = makeRelicApi({
      readMarkdownFile: vi.fn().mockReturnValue(read.promise),
      switchWorkspace: vi.fn().mockReturnValue(switched.promise)
    });
    const pane = { activeTabId: null, history: [], tabIds: [] };
    const { result } = renderHook(() => {
      const guard = useWorkspaceRequestGuard("workspace-a");
      const openActions = useWorkspaceFileOpenActions({
        ...guard,
        activeWorkspaceId: "workspace-a",
        aliasesByPath: {},
        existingMarkdownPaths: ["A.md"],
        focusedPane: "left",
        leftPane: pane,
        openFileInPane,
        openImageInPane: vi.fn(),
        openPdfInPane: vi.fn(),
        rightPane: pane,
        setLeftPaneScrollHeading: vi.fn(),
        setRightPaneScrollHeading: vi.fn(),
        setWorkspaceError: vi.fn(),
        setWorkspaceState,
        tabs: {}
      });
      const registryActions = useWorkspaceRegistryActions({
        ...guard,
        activeWorkspaceId: "workspace-a",
        closeAllTabs,
        setWorkspaceError: vi.fn(),
        setWorkspaceState
      });
      return { ...openActions, ...registryActions };
    });

    act(() => {
      result.current.handleOpenFile("A.md");
      result.current.handleSwitchWorkspace("workspace-b");
    });
    await act(async () => {
      switched.resolve({ ok: true, value: workspaceState("workspace-b") });
      await Promise.resolve();
      read.resolve({ ok: true, value: file("A.md") });
      await Promise.resolve();
    });

    expect(setWorkspaceState).toHaveBeenCalledWith(workspaceState("workspace-b"));
    expect(closeAllTabs).toHaveBeenCalledOnce();
    expect(openFileInPane).not.toHaveBeenCalled();
  });
});

function file(path: string): MarkdownFileContent {
  return { content: `# ${path}`, name: path.replace(/\.md$/u, ""), path };
}

function workspaceState(id: string): WorkspaceState {
  return {
    activeWorkspace: { id, name: id, path: `/workspace/${id}` },
    fileTree: [],
    pinnedPaths: [],
    workspaces: []
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
