import {
  fireEvent,
  screen,
  waitFor
} from "@testing-library/react";
import { EditorView } from "@codemirror/view";
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

describe("App search and links", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("トーストを閉じると退場反応を通る", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      createMarkdownFile: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "CREATE_FAILED", message: "ファイルを作成できませんでした。" }
      })
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "新規ファイル" }));

    const toast = await screen.findByText("ファイルを作成できませんでした。");
    expect(toast).toBeInstanceOf(HTMLElement);
    fireEvent.click(toast);

    expect(toast).toHaveClass("toast--closing");
  });

  it("右パネルにアウトゴーイングリンクを表示する", async () => {
    const readMarkdownFile = vi.fn(({ path }: { path: string }) => Promise.resolve({
      ok: true as const,
      value:
        path === "埋め込み.md"
          ? { content: "埋め込み本文", name: "埋め込み", path: "埋め込み.md" }
          : {
              content: "[[参照先|表示名]]\n![[埋め込み]]",
              name: "読書メモ",
              path: "読書メモ.md"
            }
    }));

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      readMarkdownFile
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(screen.getByRole("button", { name: "リンク" }));

    expect(await screen.findByText("アウトゴーイング")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "表示名" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("埋め込み").length).toBeGreaterThan(0);
  });

  it("右パネルの見出し付きアウトゴーイングリンクをクリックすると対象見出しへ移動する", async () => {
    const targetContent = [
      "# 参照先",
      "",
      "前置き",
      "",
      "## 決定事項",
      "",
      "本文"
    ].join("\n");
    const readMarkdownFile = vi.fn(({ path }: { path: string }) => Promise.resolve({
      ok: true as const,
      value:
        path === "参照先.md"
          ? { content: targetContent, name: "参照先", path: "参照先.md" }
          : {
              content: "[[参照先#決定事項|表示名]]",
              name: "読書メモ",
              path: "読書メモ.md"
            }
    }));

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "file" },
            { name: "参照先", path: "参照先.md", type: "file" }
          ]
        }
      }),
      readMarkdownFile
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(screen.getByRole("button", { name: "リンク" }));

    fireEvent.click(await screen.findByRole("button", { name: "表示名" }));

    expect(readMarkdownFile).toHaveBeenCalledWith({ path: "参照先.md" });
    await screen.findByText("参照先", { selector: ".pane-tab-name" });

    const targetFrom = targetContent.indexOf("## 決定事項");
    await waitFor(() => {
      const view = EditorView.findFromDOM(container.querySelector(".cm-content") as HTMLElement);
      expect(view?.state.selection.main.from).toBe(targetFrom);
      expect(container.querySelector(".cm-activeLine")?.textContent).toContain("決定事項");
    });
  });

  it("右パネルのリンクを右クリックしてコピーと場所表示を実行する", async () => {
    const revealWorkspaceItem = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const copyEditorTextToClipboard = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({
      copyEditorTextToClipboard,
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "file" },
            { name: "参照先", path: "参照先.md", type: "file" }
          ]
        }
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "[[参照先|表示名]]", name: "読書メモ", path: "読書メモ.md" }
      }),
      revealWorkspaceItem
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(screen.getByRole("button", { name: "リンク" }));

    fireEvent.contextMenu(await screen.findByRole("button", { name: "表示名" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Markdownリンクをコピー" }));
    expect(copyEditorTextToClipboard).toHaveBeenCalledWith({ text: "[[参照先|表示名]]" });

    fireEvent.contextMenu(screen.getByRole("button", { name: "表示名" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "パスをコピー" }));
    expect(copyEditorTextToClipboard).toHaveBeenCalledWith({ text: "参照先.md" });

    fireEvent.contextMenu(screen.getByRole("button", { name: "表示名" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "ファイルの場所を表示" }));
    await waitFor(() => {
      expect(revealWorkspaceItem).toHaveBeenCalledWith({ path: "参照先.md" });
    });
  });

  it("右パネルにバックリンクを表示し、クリックすると参照元を開く", async () => {
    const readMarkdownFile = vi.fn(({ path }: { path: string }) => Promise.resolve({
      ok: true as const,
      value:
        path === "source.md"
          ? { content: "参照元本文", name: "source", path: "source.md" }
          : { content: "# Target", name: "target", path: "target.md" }
    }));

    window.relic = makeRelicApi({
      getBacklinks: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ count: 2, sourceName: "source", sourcePath: "source.md" }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "target", path: "target.md", type: "file" },
            { name: "source", path: "source.md", type: "file" }
          ]
        }
      }),
      readMarkdownFile
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /target/ }));
    fireEvent.click(screen.getByRole("button", { name: "リンク" }));

    expect(await screen.findByText("バックリンク")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "source" }));

    expect(readMarkdownFile).toHaveBeenCalledWith({ path: "source.md" });
  });

  it("リンクパネルを表示するまでバックリンクを取得しない", async () => {
    const getBacklinks = vi.fn().mockResolvedValue({
      ok: true,
      value: [{ count: 1, sourceName: "source", sourcePath: "source.md" }]
    });

    window.relic = makeRelicApi({
      getBacklinks,
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "target", path: "target.md", type: "file" },
            { name: "source", path: "source.md", type: "file" }
          ]
        }
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "[[source]]", name: "target", path: "target.md" }
      })
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /target/ }));
    await waitFor(() => expect(screen.getByText("target")).toBeInTheDocument());
    expect(getBacklinks).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "リンク" }));
    await waitFor(() => expect(getBacklinks).toHaveBeenCalledWith({ path: "target.md" }));
  });

  it("未作成リンクをクリックすると同じフォルダにファイルを作成して開く", async () => {
    const readMarkdownFile = vi.fn(({ path }: { path: string }) => Promise.resolve(
      path === "folder/読書メモ.md"
        ? {
            ok: true as const,
            value: { content: "[[新規ノート]]", name: "読書メモ", path: "folder/読書メモ.md" }
          }
        : {
            ok: false as const,
            error: { code: "FILE_READ_FAILED", message: "ファイルを読み込めませんでした。" }
          }
    ));
    const createLinkedMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "", name: "新規ノート", path: "folder/新規ノート.md" },
        workspaceState: {
          ...withWorkspace,
          fileTree: [
            {
              children: [
                { name: "読書メモ", path: "folder/読書メモ.md", type: "file" },
                { name: "新規ノート", path: "folder/新規ノート.md", type: "file" }
              ],
              name: "folder",
              path: "folder",
              type: "folder"
            }
          ]
        }
      }
    });

    window.relic = makeRelicApi({
      createLinkedMarkdownFile,
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            {
              children: [{ name: "読書メモ", path: "folder/読書メモ.md", type: "file" }],
              name: "folder",
              path: "folder",
              type: "folder"
            }
          ]
        }
      }),
      readMarkdownFile
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(screen.getByRole("button", { name: "リンク" }));
    fireEvent.click(await screen.findByRole("button", { name: "新規ノート" }));

    await waitFor(() => {
      expect(createLinkedMarkdownFile).toHaveBeenCalledWith({ path: "folder/新規ノート.md" });
    });
    expect((await screen.findAllByText("新規ノート")).length).toBeGreaterThan(0);
  });
});
