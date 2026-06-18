import {
  act,
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
  searchResultSet,
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

  it("ファイルモードの検索方法ボタンで検索方法候補を表示する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    fireEvent.focus(await screen.findByLabelText("ファイル検索"));

    expect(screen.queryByRole("option", { name: "全文" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));

    expect(await screen.findByRole("option", { name: "全文" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ファイル名" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "タグ" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "プロパティ" })).toBeInTheDocument();
  });

  it("検索語句を入力すると検索結果を表示し、クリックでファイルを開く", async () => {
    const searchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: searchResultSet([{
        fileName: "読書メモ",
        lineNumber: 3,
        lineText: "一致した行",
        path: "読書メモ.md"
      }])
    });
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "1行目\n2行目\n一致した行", name: "読書メモ", path: "読書メモ.md" }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      readMarkdownFile,
      searchWorkspace
    });

    const { container } = await renderApp();

    fireEvent.change(await screen.findByLabelText("ファイル検索"), {
      target: { value: "一致" }
    });

    expect(await screen.findByText("3: 一致した行")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /読書メモ/ }));

    expect(searchWorkspace).toHaveBeenCalledWith({ mode: "fullText", query: "一致" });
    expect(searchWorkspace.mock.calls.at(-1)?.[0]).toStrictEqual({ mode: "fullText", query: "一致" });
    expect(readMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
    await waitFor(() => {
      expect(container.querySelector(".cm-activeLine")?.textContent).toContain("一致した行");
    });
  });

  it("開いているファイルの検索結果クリックでは同じEditorViewのまま対象行へ移動する", async () => {
    const content = Array.from({ length: 120 }, (_, index) => (
      index === 74 ? "検索一致行" : `本文 ${index + 1}`
    )).join("\n");
    const searchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: searchResultSet([{
        fileName: "長文検索",
        lineNumber: 75,
        lineText: "検索一致行",
        path: "長文検索.md"
      }])
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "長文検索", path: "長文検索.md", type: "file" }]
        }
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content, name: "長文検索", path: "長文検索.md" }
      }),
      searchWorkspace
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /長文検索/ }));
    await screen.findByText("長文検索", { selector: ".pane-tab-name" });

    const editorContent = container.querySelector(".cm-content");
    expect(editorContent).not.toBeNull();
    const view = EditorView.findFromDOM(editorContent as HTMLElement);
    expect(view).not.toBeNull();

    act(() => {
      view!.dispatch({ selection: { anchor: content.length } });
    });
    view!.scrollDOM.scrollTop = 1200;

    fireEvent.change(await screen.findByLabelText("ファイル検索"), {
      target: { value: "検索一致" }
    });

    const resultLine = await screen.findByText("75: 検索一致行");
    fireEvent.click(resultLine.closest("button") as HTMLButtonElement);

    const targetFrom = content.indexOf("検索一致行");
    await waitFor(() => {
      expect(EditorView.findFromDOM(container.querySelector(".cm-content") as HTMLElement)).toBe(view);
      expect(view!.state.selection.main.from).toBe(targetFrom);
      expect(container.querySelector(".cm-activeLine")?.textContent).toContain("検索一致行");
    });
  });

  it("検索中は読み込み反応を表示する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      searchWorkspace: vi.fn().mockReturnValue(new Promise(() => undefined))
    });

    await renderApp();

    fireEvent.change(await screen.findByLabelText("ファイル検索"), {
      target: { value: "draft" }
    });

    const loading = await screen.findByText("読み込んでいます…");
    expect(loading).toHaveClass("list-loading-note");
  });

  it("検索方法でタグを選ぶとタグ検索に切り替える", async () => {
    const searchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: searchResultSet([{ fileName: "資料ノート", lineNumber: null, lineText: "#資料", path: "資料ノート.md" }])
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      searchWorkspace
    });

    await renderApp();

    await screen.findByLabelText("ファイル検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "タグ" }));
    await waitFor(() => {
      expect(screen.queryByRole("option", { name: "タグ" })).not.toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("ファイル検索"), {
      target: { value: "資料" }
    });

    await waitFor(() => {
      expect(searchWorkspace).toHaveBeenCalledWith({ mode: "tag", query: "資料" });
    });
    expect(searchWorkspace.mock.calls.at(-1)?.[0]).toStrictEqual({ mode: "tag", query: "資料" });
    expect((await screen.findAllByText("#資料")).length).toBeGreaterThan(0);
  });

  it("検索方法でファイル名を選ぶとファイル名検索に切り替える", async () => {
    const searchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: searchResultSet([{ fileName: "読書メモ", lineNumber: null, lineText: "読書メモ.md", path: "読書メモ.md" }])
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      searchWorkspace
    });

    await renderApp();

    await screen.findByLabelText("ファイル検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "ファイル名" }));
    fireEvent.change(screen.getByLabelText("ファイル検索"), {
      target: { value: "読書" }
    });

    await waitFor(() => {
      expect(searchWorkspace).toHaveBeenCalledWith({ mode: "fileName", query: "読書" });
    });
    expect(searchWorkspace.mock.calls.at(-1)?.[0]).toStrictEqual({ mode: "fileName", query: "読書" });
    expect(await screen.findByText("読書メモ.md")).toBeInTheDocument();
  });

  it("検索方法で正規表現を選ぶと正規表現検索に切り替える", async () => {
    const searchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: searchResultSet([{ fileName: "読書メモ", lineNumber: 1, lineText: "# 読書メモ", path: "読書メモ.md" }])
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      searchWorkspace
    });

    await renderApp();

    await screen.findByLabelText("ファイル検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "正規表現" }));
    fireEvent.change(screen.getByLabelText("ファイル検索"), {
      target: { value: "^# " }
    });

    await waitFor(() => {
      expect(searchWorkspace).toHaveBeenCalledWith({ mode: "regex", query: "^# " });
    });
    expect(await screen.findByText("1: # 読書メモ")).toBeInTheDocument();
  });

  it("無効な正規表現の検索エラーを表示する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      searchWorkspace: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "SEARCH_REGEX_INVALID", message: "正規表現が正しくありません。" }
      })
    });

    await renderApp();

    await screen.findByLabelText("ファイル検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "正規表現" }));
    fireEvent.change(screen.getByLabelText("ファイル検索"), {
      target: { value: "[" }
    });

    expect(await screen.findByText("正規表現が正しくありません。")).toBeInTheDocument();
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

  it("フロントマター検索で field と値を渡す", async () => {
    const searchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: searchResultSet([{ fileName: "読書メモ", lineNumber: null, lineText: "status: draft", path: "読書メモ.md" }])
    });

    window.relic = makeRelicApi({
      getFrontmatterValueCandidates: vi.fn().mockResolvedValue({
        ok: true,
        value: { date: ["2026-05-12"], status: ["draft"] }
      }),
      getUserDefinedFields: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ choices: ["draft", "published"], name: "reviewer", type: "text" }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      searchWorkspace
    });

    await renderApp();

    await screen.findByLabelText("ファイル検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "プロパティ" }));
    expect(screen.getByRole("option", { name: "reviewer" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "date" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("プロパティ名"), {
      target: { value: "status" }
    });
    fireEvent.change(screen.getByLabelText("ファイル検索"), {
      target: { value: "draft" }
    });

    await waitFor(() => {
      expect(searchWorkspace).toHaveBeenCalledWith({
        frontmatterField: "status",
        mode: "frontmatter",
        query: "draft"
      });
    });
    expect(await screen.findByText("status: draft")).toBeInTheDocument();
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
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

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
    expect(writeText).toHaveBeenCalledWith("[[参照先|表示名]]");

    fireEvent.contextMenu(screen.getByRole("button", { name: "表示名" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "パスをコピー" }));
    expect(writeText).toHaveBeenCalledWith("参照先.md");

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
