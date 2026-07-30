import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { MarkdownFileContent, WorkspaceState } from "../shared/ipc";
import type { RelicResult } from "../shared/result";
import {
  installMatchMediaMock,
  makeRelicApi,
  resetRendererStores
} from "../test/rendererTestUtils";
import { renderApp } from "./appTestHelpers";

describe("App workspace request races", () => {
  beforeAll(installMatchMediaMock);

  afterEach(() => {
    vi.clearAllMocks();
    resetRendererStores();
  });

  it("旧workspaceの読込完了後も新workspaceの同一pathを1回で開く", async () => {
    const workspaces = [
      { id: "workspace-a", name: "Notes", path: "/tmp/Notes" },
      { id: "workspace-b", name: "Archive", path: "/tmp/Archive" }
    ];
    const stateA: WorkspaceState = {
      activeWorkspace: workspaces[0]!,
      fileTree: [{ name: "Same", path: "Same.md", type: "file" }],
      pinnedPaths: [],
      workspaces
    };
    const stateB: WorkspaceState = {
      activeWorkspace: workspaces[1]!,
      fileTree: [{ name: "Same", path: "Same.md", type: "file" }],
      pinnedPaths: [],
      workspaces
    };
    const staleRead = deferred<RelicResult<MarkdownFileContent>>();
    const readMarkdownFile = vi.fn()
      .mockReturnValueOnce(staleRead.promise)
      .mockResolvedValueOnce({
        ok: true,
        value: { content: "workspace-b", name: "Same", path: "Same.md" }
      });
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: stateA }),
      readMarkdownFile,
      switchWorkspace: vi.fn().mockResolvedValue({ ok: true, value: stateB })
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "· Same" }));
    await waitFor(() => expect(readMarkdownFile).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Notes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
    await waitFor(() => expect(window.relic?.switchWorkspace).toHaveBeenCalledWith({
      workspaceId: "workspace-b"
    }));

    await act(async () => staleRead.resolve({
      ok: true,
      value: { content: "workspace-a", name: "Same", path: "Same.md" }
    }));
    fireEvent.click(await screen.findByRole("button", { name: "· Same" }));

    await waitFor(() => expect(readMarkdownFile).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Same", { selector: ".pane-tab-name" })).toBeInTheDocument();
  });

  it("ワークスペース選択をキャンセルしても開いているタブを維持する", async () => {
    const currentState: WorkspaceState = {
      activeWorkspace: { id: "workspace-a", name: "Notes", path: "/tmp/Notes" },
      fileTree: [{ name: "Open", path: "Open.md", type: "file" }],
      pinnedPaths: [],
      workspaces: [{ id: "workspace-a", name: "Notes", path: "/tmp/Notes" }]
    };
    const openWorkspace = vi.fn().mockResolvedValue({ ok: true, value: currentState });
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: currentState }),
      openWorkspace,
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "current", name: "Open", path: "Open.md" }
      })
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "· Open" }));
    expect(await screen.findByText("Open", { selector: ".pane-tab-name" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ワークスペースを開く" }));
    await waitFor(() => expect(openWorkspace).toHaveBeenCalledOnce());

    expect(screen.getByText("Open", { selector: ".pane-tab-name" })).toBeInTheDocument();
  });

  it("初期workspace取得が先に完了しても選択中のworkspaceを後から適用する", async () => {
    const initialState = deferred<RelicResult<WorkspaceState>>();
    const openedState = deferred<RelicResult<WorkspaceState>>();
    const workspaceA: WorkspaceState = {
      activeWorkspace: { id: "workspace-a", name: "Notes", path: "/tmp/Notes" },
      fileTree: [],
      pinnedPaths: [],
      workspaces: [{ id: "workspace-a", name: "Notes", path: "/tmp/Notes" }]
    };
    const workspaceB: WorkspaceState = {
      activeWorkspace: { id: "workspace-b", name: "Archive", path: "/tmp/Archive" },
      fileTree: [{ name: "Selected", path: "Selected.md", type: "file" }],
      pinnedPaths: [],
      workspaces: [{ id: "workspace-b", name: "Archive", path: "/tmp/Archive" }]
    };
    const openWorkspace = vi.fn().mockReturnValue(openedState.promise);
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockReturnValue(initialState.promise),
      openWorkspace
    });

    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "ワークスペースを開く" }));
    await waitFor(() => expect(openWorkspace).toHaveBeenCalledOnce());

    await act(async () => initialState.resolve({ ok: true, value: workspaceA }));
    await screen.findByRole("button", { name: "Notes" });

    await act(async () => openedState.resolve({ ok: true, value: workspaceB }));

    expect(await screen.findByRole("button", { name: "· Selected" })).toBeInTheDocument();
  });
});

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}
