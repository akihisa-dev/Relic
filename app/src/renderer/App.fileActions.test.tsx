import {
  fireEvent,
  screen,
  waitFor
} from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import {
  renderApp,
  restoreNavigatorPlatform,
  setNavigatorPlatform
} from "./appTestHelpers";
import {
  installMatchMediaMock,
  makeRelicApi,
  resetRendererStores,
  testWorkspaceState as withWorkspace
} from "../test/rendererTestUtils";

describe("App file actions", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("コマンドパレットからアクティブファイルを複製する", async () => {
    const duplicateMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "本文テスト", name: "読書メモ のコピー", path: "読書メモ のコピー.md" },
        workspaceState: {
          ...withWorkspace,
          fileTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "file" },
            { name: "読書メモ のコピー", path: "読書メモ のコピー.md", type: "file" }
          ]
        }
      }
    });

    window.relic = makeRelicApi({
      duplicateMarkdownFile,
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      })
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.keyDown(window, { key: "P", metaKey: true, shiftKey: true });
    fireEvent.click(await screen.findByText("ファイルを複製: 読書メモ"));

    await waitFor(() => {
      expect(duplicateMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
    });
  });

  it("コマンドパレットを閉じると退場反応を通る", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    fireEvent.keyDown(window, { key: "P", metaKey: true, shiftKey: true });

    const palette = container.querySelector(".command-palette");
    if (!(palette instanceof HTMLElement)) throw new Error("command palette was not rendered");

    fireEvent.keyDown(window, { key: "Escape" });

    const overlay = container.querySelector(".modal-overlay");
    if (!(overlay instanceof HTMLElement)) throw new Error("modal overlay was not rendered");

    expect(palette).toHaveClass("command-palette--closing");
    expect(overlay).toHaveClass("modal-overlay--closing");
  });

  it("クイックスイッチャーを閉じると退場反応を通る", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    fireEvent.keyDown(window, { key: "p", metaKey: true });

    const switcher = container.querySelector(".quick-switcher");
    if (!(switcher instanceof HTMLElement)) throw new Error("quick switcher was not rendered");

    fireEvent.keyDown(window, { key: "Escape" });

    const overlay = container.querySelector(".modal-overlay");
    if (!(overlay instanceof HTMLElement)) throw new Error("modal overlay was not rendered");

    expect(switcher).toHaveClass("quick-switcher--closing");
    expect(overlay).toHaveClass("modal-overlay--closing");
  });

  it("コマンドパレットからアクティブファイルをゴミ箱に移動する", async () => {
    const moveItemToTrash = vi.fn().mockResolvedValue({ ok: true, value: withWorkspace });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      moveItemToTrash,
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      })
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.keyDown(window, { key: "P", metaKey: true, shiftKey: true });
    fireEvent.click(await screen.findByText("ファイルを削除: 読書メモ"));

    await waitFor(() => {
      expect(moveItemToTrash).toHaveBeenCalledWith({ path: "読書メモ.md", type: "file" });
    });
    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("ファイルとフォルダはフォルダ行へのドラッグ&ドロップで移動できる", async () => {
    const movedWorkspaceState = {
      ...withWorkspace,
      fileTree: [
        {
          children: [{ name: "note", path: "archive/note.md", type: "file" }],
          name: "archive",
          path: "archive",
          type: "folder"
        },
        { children: [], name: "drafts", path: "drafts", type: "folder" }
      ]
    };
    const moveMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "# Note", name: "note", path: "archive/note.md" },
        workspaceState: movedWorkspaceState
      }
    });
    const moveFolder = vi.fn().mockResolvedValue({ ok: true, value: movedWorkspaceState });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "note", path: "note.md", type: "file" },
            { children: [], name: "drafts", path: "drafts", type: "folder" },
            { children: [], name: "archive", path: "archive", type: "folder" }
          ]
        }
      }),
      moveFolder,
      moveMarkdownFile
    });

    await renderApp();

    const fileRow = await screen.findByRole("button", { name: /note/ });
    const draftsRow = await screen.findByRole("button", { name: /drafts/ });
    const archiveRow = await screen.findByRole("button", { name: /archive/ });

    fireEvent.dragStart(fileRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });

    expect(fileRow).toHaveClass("dragging");

    fireEvent.drop(archiveRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "file" }) }
    });

    fireEvent.dragEnd(fileRow);

    expect(fileRow).not.toHaveClass("dragging");

    await waitFor(() => {
      expect(moveMarkdownFile).toHaveBeenCalledWith({ destinationFolder: "archive", path: "note.md" });
    });

    fireEvent.dragStart(draftsRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });
    fireEvent.drop(archiveRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "drafts", type: "folder" }) }
    });

    await waitFor(() => {
      expect(moveFolder).toHaveBeenCalledWith({ destinationFolder: "archive", path: "drafts" });
    });
  });

  it("展開済みフォルダ内の余白へドロップしても移動しない", async () => {
    const moveMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "# Note", name: "note", path: "archive/note.md" },
        workspaceState: withWorkspace
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "note", path: "note.md", type: "file" },
            {
              children: [{ name: "old", path: "archive/old.md", type: "file" }],
              name: "archive",
              path: "archive",
              type: "folder"
            }
          ]
        }
      }),
      moveMarkdownFile
    });

    const { container } = await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const archiveRow = await screen.findByRole("button", { name: /archive/ });
    const archiveTree = archiveRow.closest("li")?.querySelector("ul.file-tree");

    expect(archiveTree).not.toBeNull();

    fireEvent.dragStart(noteRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });
    fireEvent.dragOver(archiveTree ?? container, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "file" }) }
    });

    expect(archiveTree).not.toHaveClass("file-tree--drag-over");

    fireEvent.drop(archiveTree ?? container, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "file" }) }
    });

    expect(moveMarkdownFile).not.toHaveBeenCalled();
  });

  it("ファイル行へドロップするとそのファイルと同じ親フォルダへ移動する", async () => {
    const moveMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "# Note", name: "note", path: "archive/note.md" },
        workspaceState: withWorkspace
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "note", path: "note.md", type: "file" },
            {
              children: [{ name: "old", path: "archive/old.md", type: "file" }],
              name: "archive",
              path: "archive",
              type: "folder"
            }
          ]
        }
      }),
      moveMarkdownFile
    });

    await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const oldRow = await screen.findByRole("button", { name: /old/ });

    fireEvent.dragStart(noteRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });
    fireEvent.dragOver(oldRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "file" }) }
    });

    expect(oldRow).toHaveClass("drag-over");

    fireEvent.drop(oldRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "file" }) }
    });

    await waitFor(() => {
      expect(moveMarkdownFile).toHaveBeenCalledWith({ destinationFolder: "archive", path: "note.md" });
    });
  });

  it("空フォルダの内容エリアへドロップしても移動しない", async () => {
    const moveMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "# Note", name: "note", path: "archive/note.md" },
        workspaceState: withWorkspace
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "note", path: "note.md", type: "file" },
            { children: [], name: "archive", path: "archive", type: "folder" }
          ]
        }
      }),
      moveMarkdownFile
    });

    const { container } = await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const archiveRow = await screen.findByRole("button", { name: /archive/ });
    const archiveTree = archiveRow.closest("li")?.querySelector("ul.file-tree");

    expect(archiveTree).not.toBeNull();

    fireEvent.dragStart(noteRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });
    fireEvent.dragOver(archiveTree ?? container, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "file" }) }
    });

    expect(archiveTree).not.toHaveClass("file-tree--drag-over");

    fireEvent.drop(archiveTree ?? container, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "file" }) }
    });

    expect(moveMarkdownFile).not.toHaveBeenCalled();
  });

  it("同じ親フォルダや子孫フォルダへはドラッグ移動しない", async () => {
    const moveFolder = vi.fn();
    const moveMarkdownFile = vi.fn();

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            {
              children: [
                { name: "note", path: "archive/note.md", type: "file" },
                {
                  children: [],
                  name: "child",
                  path: "archive/child",
                  type: "folder"
                }
              ],
              name: "archive",
              path: "archive",
              type: "folder"
            }
          ]
        }
      }),
      moveFolder,
      moveMarkdownFile
    });

    await renderApp();

    const archiveRow = await screen.findByRole("button", { name: /archive/ });
    const childRow = await screen.findByRole("button", { name: /child/ });

    fireEvent.drop(archiveRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "archive/note.md", type: "file" }) }
    });
    fireEvent.drop(childRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "archive", type: "folder" }) }
    });

    expect(moveMarkdownFile).not.toHaveBeenCalled();
    expect(moveFolder).not.toHaveBeenCalled();
  });

  it("ファイルとフォルダを複数選択できる", async () => {
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "本文", name: "note", path: "note.md" }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "note", path: "note.md", type: "file" },
            { children: [], name: "drafts", path: "drafts", type: "folder" },
            { children: [], name: "archive", path: "archive", type: "folder" }
          ]
        }
      }),
      readMarkdownFile
    });

    await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const draftsRow = await screen.findByRole("button", { name: /drafts/ });
    const archiveRow = await screen.findByRole("button", { name: /archive/ });

    fireEvent.click(noteRow, { metaKey: true });
    fireEvent.click(draftsRow, { metaKey: true });

    expect(noteRow).toHaveClass("selected");
    expect(noteRow).toHaveClass("multi-selected");
    expect(draftsRow).toHaveClass("selected");
    expect(draftsRow).toHaveClass("multi-selected");
    expect(screen.queryByText("2件選択中")).not.toBeInTheDocument();

    fireEvent.click(archiveRow, { shiftKey: true });

    expect(noteRow).not.toHaveClass("selected");
    expect(draftsRow).toHaveClass("selected");
    expect(draftsRow).toHaveClass("multi-selected");
    expect(archiveRow).toHaveClass("selected");
    expect(archiveRow).toHaveClass("multi-selected");
    expect(screen.queryByText("2件選択中")).not.toBeInTheDocument();

    fireEvent.click(noteRow);

    expect(readMarkdownFile).not.toHaveBeenCalled();
  });

  it("複数選択したファイルとフォルダをドラッグ&ドロップでまとめて移動できる", async () => {
    const movedWorkspaceState = {
      ...withWorkspace,
      fileTree: [
        {
          children: [
            { name: "note", path: "archive/note.md", type: "file" },
            { children: [], name: "drafts", path: "archive/drafts", type: "folder" }
          ],
          name: "archive",
          path: "archive",
          type: "folder"
        }
      ]
    };
    const moveMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "# Note", name: "note", path: "archive/note.md" },
        workspaceState: movedWorkspaceState
      }
    });
    const moveFolder = vi.fn().mockResolvedValue({ ok: true, value: movedWorkspaceState });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "note", path: "note.md", type: "file" },
            { children: [], name: "drafts", path: "drafts", type: "folder" },
            { children: [], name: "archive", path: "archive", type: "folder" }
          ]
        }
      }),
      moveFolder,
      moveMarkdownFile
    });

    await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const draftsRow = await screen.findByRole("button", { name: /drafts/ });
    const archiveRow = await screen.findByRole("button", { name: /archive/ });
    const setData = vi.fn();

    fireEvent.click(noteRow, { metaKey: true });
    fireEvent.click(draftsRow, { metaKey: true });
    fireEvent.dragStart(noteRow, {
      dataTransfer: { effectAllowed: "move", setData }
    });
    const payload = setData.mock.calls[0]?.[1] as string | undefined;

    expect(payload).toBeDefined();

    fireEvent.drop(archiveRow, {
      dataTransfer: { getData: () => payload ?? "" }
    });

    await waitFor(() => {
      expect(moveMarkdownFile).toHaveBeenCalledWith({ destinationFolder: "archive", path: "note.md" });
    });
    await waitFor(() => {
      expect(moveFolder).toHaveBeenCalledWith({ destinationFolder: "archive", path: "drafts" });
    });
  });

  it("複数選択したファイルとフォルダをまとめてゴミ箱に移動できる", async () => {
    const moveItemToTrash = vi.fn().mockResolvedValue({ ok: true, value: withWorkspace });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "note", path: "note.md", type: "file" },
            { children: [], name: "drafts", path: "drafts", type: "folder" }
          ]
        }
      }),
      moveItemToTrash
    });

    await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const draftsRow = await screen.findByRole("button", { name: /drafts/ });

    fireEvent.click(noteRow, { metaKey: true });
    fireEvent.click(draftsRow, { metaKey: true });
    fireEvent.contextMenu(noteRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "選択した項目をゴミ箱に移動" }));

    expect(noteRow).toHaveClass("file-tree-row--removing");

    await waitFor(() => {
      expect(moveItemToTrash).toHaveBeenCalledWith({ path: "note.md", type: "file" });
      expect(moveItemToTrash).toHaveBeenCalledWith({ path: "drafts", type: "folder" });
    });
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("2件"));

    confirmSpy.mockRestore();
  });

  it("ファイル・フォルダをピン留めし、ピン留めセクションに表示して解除できる", async () => {
    const togglePin = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "file" },
            { children: [], name: "資料", path: "資料", type: "folder" }
          ],
          pinnedPaths: ["読書メモ.md", "資料"]
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "file" },
            { children: [], name: "資料", path: "資料", type: "folder" }
          ],
          pinnedPaths: []
        }
      });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "file" },
            { children: [], name: "資料", path: "資料", type: "folder" }
          ],
          pinnedPaths: []
        }
      }),
      togglePin
    });

    await renderApp();

    fireEvent.click((await screen.findAllByTitle("ピン留め"))[0]);

    await waitFor(() => {
      expect(togglePin).toHaveBeenCalledWith("読書メモ.md");
    });
    expect(await screen.findByText("ピン留め")).toBeInTheDocument();
    expect(screen.getAllByTitle("ピン留めを解除").length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getAllByTitle("ピン留めを解除")[0]);

    await waitFor(() => {
      expect(togglePin).toHaveBeenCalledTimes(2);
    });
  });
});
