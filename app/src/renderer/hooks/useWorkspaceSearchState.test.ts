import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceState } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { I18nProvider } from "../i18n";
import type { AppLanguage } from "../../shared/ipc";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { useWorkspaceSearchState } from "./useWorkspaceSearchState";

describe("useWorkspaceSearchState", () => {
  afterEach(() => {
    window.relic = undefined;
    vi.clearAllMocks();
  });

  it.each(["pin", "refresh", "language"] as const)("%s更新中も保留中の検索結果を受け取る", async (change) => {
    const pending = deferred<Awaited<ReturnType<NonNullable<typeof window.relic>["searchWorkspace"]>>>();
    const searchWorkspace = vi.fn().mockReturnValue(pending.promise);
    window.relic = makeRelicApi({ searchWorkspace });
    const setWorkspaceError = vi.fn();
    let language: AppLanguage = "en";
    const initial = workspace("workspace-a");
    const { result, rerender } = renderHook(({ workspaceState }) => useWorkspaceSearchState({
      workspaceState, setWorkspaceError, userDefinedFields: []
    }), {
      initialProps: { workspaceState: initial },
      wrapper: ({ children }: { children: ReactNode }) => createElement(I18nProvider, { language, children })
    });
    act(() => { result.current.setSearchMode("tag"); result.current.setSearchQuery("tag"); });
    await waitFor(() => expect(searchWorkspace).toHaveBeenCalledOnce());
    if (change === "language") language = "ja";
    rerender({ workspaceState: change === "language" ? initial : {
      ...initial, fileTree: [...initial.fileTree], pinnedPaths: change === "pin" ? ["note.md"] : []
    } });
    await act(async () => pending.resolve({ ok: true, value: {
      results: [], truncated: false, skippedLargeFiles: 0, skippedLongLines: 0
    } }));
    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchError).toBeNull();
    expect(searchWorkspace).toHaveBeenCalledOnce();
  });

  it("表示言語変更後の通信失敗でも検索を終了し現在の言語で表示する", async () => {
    let reject!: (error: Error) => void;
    const pending = new Promise((_, fail) => { reject = fail; });
    const searchWorkspace = vi.fn().mockReturnValue(pending);
    window.relic = makeRelicApi({ searchWorkspace });
    const setWorkspaceError = vi.fn();
    let language: AppLanguage = "en";
    const initial = workspace("workspace-a");
    const { result, rerender } = renderHook(() => useWorkspaceSearchState({
      workspaceState: initial, setWorkspaceError, userDefinedFields: []
    }), { wrapper: ({ children }: { children: ReactNode }) => createElement(I18nProvider, { language, children }) });
    act(() => result.current.setSearchQuery("tag"));
    await waitFor(() => expect(searchWorkspace).toHaveBeenCalledOnce());
    language = "ja";
    rerender();
    await act(async () => reject(new Error("transport detail")));
    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchError).toBeTruthy();
    expect(result.current.searchError).not.toContain("transport detail");
    expect(result.current.searchError).not.toBe("The operation could not be completed.");
  });

  it.each(["query", "workspace"] as const)("%s変更後は旧検索の応答を表示しない", async (change) => {
    const first = deferred<Awaited<ReturnType<NonNullable<typeof window.relic>["searchWorkspace"]>>>();
    const second = deferred<Awaited<ReturnType<NonNullable<typeof window.relic>["searchWorkspace"]>>>();
    const searchWorkspace = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    window.relic = makeRelicApi({ searchWorkspace });
    const setWorkspaceError = vi.fn();
    const { result, rerender } = renderHook(({ workspaceState }) => useWorkspaceSearchState({
      workspaceState, setWorkspaceError, userDefinedFields: []
    }), { initialProps: { workspaceState: workspace("workspace-a") } });
    act(() => result.current.setSearchQuery("first"));
    await waitFor(() => expect(searchWorkspace).toHaveBeenCalledOnce());
    if (change === "query") act(() => result.current.setSearchQuery("second"));
    else rerender({ workspaceState: workspace("workspace-b") });
    await act(async () => first.resolve({ ok: false, error: { code: "SEARCH_FAILED", message: "stale error" } }));
    expect(result.current.searchError).toBeNull();
    expect(result.current.isSearching).toBe(true);
    await waitFor(() => expect(searchWorkspace).toHaveBeenCalledTimes(2));
    await act(async () => second.resolve({ ok: true, value: {
      results: [], truncated: false, skippedLargeFiles: 0, skippedLongLines: 0
    } }));
    expect(result.current.isSearching).toBe(false);
  });

  it("ワークスペース切替直後に前のフロントマター候補を返さない", async () => {
    const first = deferred<RelicResult<Record<string, string[]>>>();
    const second = deferred<RelicResult<Record<string, string[]>>>();
    window.relic = makeRelicApi({
      getFrontmatterValueCandidates: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
    });
    const setWorkspaceError = vi.fn();
    const workspaceA = workspace("workspace-a");
    const workspaceB = workspace("workspace-b");

    const { result, rerender } = renderHook(
      ({ workspaceState }) => useWorkspaceSearchState({
        setWorkspaceError,
        userDefinedFields: [],
        workspaceState
      }),
      { initialProps: { workspaceState: workspaceA } }
    );

    await act(async () => first.resolve({ ok: true, value: { status: ["Alpha"] } }));
    expect(result.current.frontmatterCandidates).toEqual({ status: ["Alpha"] });

    rerender({ workspaceState: workspaceB });
    expect(result.current.frontmatterCandidates).toEqual({});

    await act(async () => second.resolve({ ok: true, value: { status: ["Beta"] } }));
    expect(result.current.frontmatterCandidates).toEqual({ status: ["Beta"] });
  });

  it("検索IPC transport rejection keeps an error snapshot for the active key", async () => {
    const setWorkspaceError = vi.fn();
    window.relic = makeRelicApi({
      searchWorkspace: vi.fn().mockRejectedValue(new Error("secret transport detail"))
    });
    const initial = workspace("workspace-a");
    const { result } = renderHook(() => useWorkspaceSearchState({
      setWorkspaceError,
      userDefinedFields: [],
      workspaceState: initial
    }));

    act(() => result.current.setSearchQuery("needle"));
    await waitFor(() => expect(result.current.searchError).toBeTruthy(), { timeout: 1000 });

    expect(result.current.searchResults).toEqual([]);
    expect(result.current.searchError).toBeTruthy();
    expect(result.current.searchError).not.toContain("secret transport detail");
  });
});

function workspace(id: string): WorkspaceState {
  return {
    activeWorkspace: { id, name: id, path: `/tmp/${id}` },
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
