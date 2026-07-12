import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FileRecoveryEntry, RelicApi } from "../../shared/ipc";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import type { FileTab } from "../store/editorStore";
import { RightPanelRecoveryList } from "./RightPanelRecoveryList";

type ListResult = Awaited<ReturnType<RelicApi["listFileRecoverySnapshots"]>>;
type ReadResult = Awaited<ReturnType<RelicApi["readFileRecoverySnapshot"]>>;

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function fileTab(id: string, path: string): FileTab {
  return {
    content: "current",
    id,
    kind: "file",
    name: path.replace(/\.md$/, ""),
    path,
    savedContent: "current"
  };
}

function recoveryEntry(id: string, path: string, size = 2048): FileRecoveryEntry {
  return {
    createdAt: "2026-07-13T00:00:00.000Z",
    id,
    path,
    size
  };
}

function successfulSnapshot(content: string, path: string): ReadResult {
  return {
    ok: true,
    value: {
      content,
      createdAt: "2026-07-13T00:00:00.000Z",
      path,
      size: content.length,
      workspaceId: "workspace"
    }
  };
}

function recoveryView(activeFileTab: FileTab | null, onRecoverContent: (tabId: string, content: string) => void) {
  return (
    <I18nProvider language="en">
      <RightPanelRecoveryList activeFileTab={activeFileTab} onRecoverContent={onRecoverContent} />
    </I18nProvider>
  );
}

afterEach(() => {
  cleanup();
  window.relic = undefined;
  vi.restoreAllMocks();
});

describe("RightPanelRecoveryList", () => {
  it("loads entries and restores the selected snapshot into its originating tab", async () => {
    const tab = fileTab("tab-a", "A.md");
    const entry = recoveryEntry("snapshot-a", tab.path);
    const onRecoverContent = vi.fn();
    const listFileRecoverySnapshots = vi.fn().mockResolvedValue({ ok: true, value: [entry] });
    const readFileRecoverySnapshot = vi.fn().mockResolvedValue(successfulSnapshot("recovered", tab.path));
    window.relic = makeRelicApi({ listFileRecoverySnapshots, readFileRecoverySnapshot });

    render(recoveryView(tab, onRecoverContent));

    fireEvent.click(await screen.findByRole("button", { name: "Load into editor" }));

    await waitFor(() => expect(onRecoverContent).toHaveBeenCalledWith(tab.id, "recovered"));
    expect(listFileRecoverySnapshots).toHaveBeenCalledWith({ path: tab.path });
    expect(readFileRecoverySnapshot).toHaveBeenCalledWith({ path: tab.path, snapshotId: entry.id });
  });

  it("shows list and restore failures without changing editor content", async () => {
    const tab = fileTab("tab-a", "A.md");
    const onRecoverContent = vi.fn();
    const listFileRecoverySnapshots = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { code: "list_failed", message: "List failed" } })
      .mockResolvedValueOnce({ ok: true, value: [recoveryEntry("snapshot-a", tab.path)] });
    const readFileRecoverySnapshot = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: "read_failed", message: "Restore failed" }
    });
    window.relic = makeRelicApi({ listFileRecoverySnapshots, readFileRecoverySnapshot });

    const { rerender } = render(recoveryView(tab, onRecoverContent));
    expect(await screen.findByText("List failed")).toBeInTheDocument();

    rerender(recoveryView(fileTab("tab-b", "B.md"), onRecoverContent));
    fireEvent.click(await screen.findByRole("button", { name: "Load into editor" }));

    expect(await screen.findByText("Restore failed")).toBeInTheDocument();
    expect(onRecoverContent).not.toHaveBeenCalled();
  });

  it("ignores an old list response after switching tabs", async () => {
    const tabA = fileTab("tab-a", "A.md");
    const tabB = fileTab("tab-b", "B.md");
    const pendingA = deferred<ListResult>();
    const pendingB = deferred<ListResult>();
    const listFileRecoverySnapshots = vi.fn(({ path }: { path: string }) => (
      path === tabA.path ? pendingA.promise : pendingB.promise
    ));
    window.relic = makeRelicApi({ listFileRecoverySnapshots });

    const { rerender } = render(recoveryView(tabA, vi.fn()));
    rerender(recoveryView(tabB, vi.fn()));

    await act(async () => {
      pendingB.resolve({ ok: true, value: [recoveryEntry("snapshot-b", tabB.path, 2048)] });
      await pendingB.promise;
    });
    expect(await screen.findByText("2 KB")).toBeInTheDocument();

    await act(async () => {
      pendingA.resolve({ ok: true, value: [recoveryEntry("snapshot-a", tabA.path, 1024)] });
      await pendingA.promise;
    });

    expect(screen.getByText("2 KB")).toBeInTheDocument();
    expect(screen.queryByText("1 KB")).not.toBeInTheDocument();
  });

  it("does not apply a restore response after the active tab changes", async () => {
    const tabA = fileTab("tab-a", "A.md");
    const tabB = fileTab("tab-b", "B.md");
    const pendingRead = deferred<ReadResult>();
    const onRecoverContent = vi.fn();
    const listFileRecoverySnapshots = vi.fn(({ path }: { path: string }) => Promise.resolve({
      ok: true as const,
      value: path === tabA.path ? [recoveryEntry("snapshot-a", tabA.path)] : []
    }));
    const readFileRecoverySnapshot = vi.fn(() => pendingRead.promise);
    window.relic = makeRelicApi({ listFileRecoverySnapshots, readFileRecoverySnapshot });

    const { rerender } = render(recoveryView(tabA, onRecoverContent));
    fireEvent.click(await screen.findByRole("button", { name: "Load into editor" }));

    rerender(recoveryView(tabB, onRecoverContent));
    await act(async () => {
      pendingRead.resolve(successfulSnapshot("stale", tabA.path));
      await pendingRead.promise;
    });

    expect(onRecoverContent).not.toHaveBeenCalled();
    expect(screen.getByTitle(tabB.path)).toHaveTextContent("B");
  });

  it("only applies the newest of parallel restore requests", async () => {
    const tab = fileTab("tab-a", "A.md");
    const firstRead = deferred<ReadResult>();
    const secondRead = deferred<ReadResult>();
    const entries = [
      recoveryEntry("snapshot-a", tab.path, 1024),
      recoveryEntry("snapshot-b", tab.path, 2048)
    ];
    const onRecoverContent = vi.fn();
    const readFileRecoverySnapshot = vi.fn(({ snapshotId }: { snapshotId: string }) => (
      snapshotId === entries[0]?.id ? firstRead.promise : secondRead.promise
    ));
    window.relic = makeRelicApi({
      listFileRecoverySnapshots: vi.fn().mockResolvedValue({ ok: true, value: entries }),
      readFileRecoverySnapshot
    });

    render(recoveryView(tab, onRecoverContent));
    const buttons = await screen.findAllByRole("button", { name: "Load into editor" });
    fireEvent.click(buttons[0]!);
    fireEvent.click(buttons[1]!);

    await act(async () => {
      firstRead.resolve(successfulSnapshot("old", tab.path));
      await firstRead.promise;
    });
    expect(onRecoverContent).not.toHaveBeenCalled();

    await act(async () => {
      secondRead.resolve(successfulSnapshot("new", tab.path));
      await secondRead.promise;
    });
    expect(onRecoverContent).toHaveBeenCalledTimes(1);
    expect(onRecoverContent).toHaveBeenCalledWith(tab.id, "new");
  });
});
