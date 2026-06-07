import { readFileSync } from "node:fs";

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
  setNavigatorPlatform
} from "./appTestHelpers";
import {
  installMatchMediaMock,
  makeRelicApi,
  resetRendererStores,
  testWorkspaceState as withWorkspace
} from "../test/rendererTestUtils";
import { useEditorStore } from "./store/editorStore";

describe("App file rename and context menu", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("本文上部のファイル名表示欄は枠なしで縦幅を詰める", () => {
    const previewCss = readFileSync("src/renderer/styles/preview-editor.css", "utf8");
    const designCss = readFileSync("src/renderer/styles/architectural-design.css", "utf8");

    expect(previewCss).toMatch(/\.editor-file-title-row\s*\{[^}]*grid-template-columns:\s*[^}]*minmax\(0, var\(--editor-file-title-max-width, 820px\)\)[^}]*minmax\(48px, 1fr\);/s);
    expect(previewCss).toMatch(/\.editor-file-title-slot\s*\{[^}]*grid-column:\s*2;/s);
    expect(previewCss).toMatch(/\.editor-file-title\s*\{[^}]*border:\s*0;/s);
    expect(previewCss).toMatch(/\.editor-file-title\s*\{[^}]*padding:\s*12px 32px 8px;/s);
    expect(previewCss).toMatch(/\.editor-file-title-actions\s*\{[^}]*grid-column:\s*3;/s);
    expect(previewCss).toMatch(/\.editor-file-title-actions\s*\{[^}]*gap:\s*6px;/s);
    expect(previewCss).toMatch(/\.editor-file-title-actions\s*\{[^}]*padding:\s*12px 32px 8px 8px;/s);
    expect(previewCss).toMatch(/\.editor-file-title-actions \.editor-frontmatter-add-button\s*\{[^}]*position:\s*static;/s);
    expect(previewCss).toMatch(/\.editor-file-title-actions \.toolbar-btn\s*\{[^}]*height:\s*32px;[^}]*width:\s*32px;/s);
    expect(designCss).toMatch(/\.editor-file-title\s*\{[^}]*padding:\s*12px 32px 8px;/s);
  });

  it("本文上部のファイル名は本文外の表示として出し、直接リネームできる", async () => {
    const renameMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "本文テスト", name: "読書ログ", path: "読書ログ.md" },
        workspaceState: {
          ...withWorkspace,
          fileTree: [{ name: "読書ログ", path: "読書ログ.md", type: "file" }]
        }
      }
    });

    window.relic = makeRelicApi({
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
      }),
      renameMarkdownFile
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));

    const title = await screen.findByText("読書メモ", { selector: ".editor-file-title" });
    expect(title).toBeInTheDocument();
    expect(container.querySelector(".editor-file-title-actions .editor-frontmatter-add-button")).toBeInTheDocument();
    expect(container.querySelector(".editor-file-title-actions .toolbar-btn")).toBeInTheDocument();
    expect(container.querySelector(".cm-content")).toHaveTextContent("本文テスト");
    expect(container.querySelector(".cm-content")).not.toHaveTextContent("読書メモ");

    fireEvent.click(title);
    fireEvent.change(container.querySelector(".editor-file-title-input") as HTMLInputElement, {
      target: { value: "読書ログ" }
    });
    fireEvent.submit(container.querySelector(".editor-file-title-form") as HTMLFormElement);

    await waitFor(() => {
      expect(renameMarkdownFile).toHaveBeenCalledWith({ newName: "読書ログ", path: "読書メモ.md" });
    });
  });

  it("未保存の開きタブはリネーム前に即時保存する", async () => {
    const renameMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "未保存本文", name: "読書ログ", path: "読書ログ.md" },
        workspaceState: {
          ...withWorkspace,
          fileTree: [{ name: "読書ログ", path: "読書ログ.md", type: "file" }]
        }
      }
    });
    const writeMarkdownFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({
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
      }),
      renameMarkdownFile,
      writeMarkdownFile
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;
    act(() => {
      useEditorStore.getState().updateTabContent(activeTabId, "未保存本文");
    });

    fireEvent.click(await screen.findByText("読書メモ", { selector: ".editor-file-title" }));
    fireEvent.change(container.querySelector(".editor-file-title-input") as HTMLInputElement, {
      target: { value: "読書ログ" }
    });
    fireEvent.submit(container.querySelector(".editor-file-title-form") as HTMLFormElement);

    await waitFor(() => expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: "未保存本文",
      path: "読書メモ.md"
    }));
    await waitFor(() => {
      expect(renameMarkdownFile).toHaveBeenCalledWith({ newName: "読書ログ", path: "読書メモ.md" });
    });
  });

  it("エディタ入力直後のリネームでも最新本文を保存してから名前を変える", async () => {
    const renameMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "本文テスト\nリネーム直前の本文", name: "読書ログ", path: "読書ログ.md" },
        workspaceState: {
          ...withWorkspace,
          fileTree: [{ name: "読書ログ", path: "読書ログ.md", type: "file" }]
        }
      }
    });
    const writeMarkdownFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({
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
      }),
      renameMarkdownFile,
      writeMarkdownFile
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());

    const editorContent = container.querySelector(".cm-content");
    expect(editorContent).not.toBeNull();

    const view = EditorView.findFromDOM(editorContent as HTMLElement);
    expect(view).not.toBeNull();

    act(() => {
      view!.dispatch({
        changes: { from: view!.state.doc.length, insert: "\nリネーム直前の本文" }
      });
    });

    fireEvent.click(await screen.findByText("読書メモ", { selector: ".editor-file-title" }));
    fireEvent.change(container.querySelector(".editor-file-title-input") as HTMLInputElement, {
      target: { value: "読書ログ" }
    });
    fireEvent.submit(container.querySelector(".editor-file-title-form") as HTMLFormElement);

    await waitFor(() => expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: "本文テスト\nリネーム直前の本文",
      path: "読書メモ.md"
    }));
    await waitFor(() => {
      expect(renameMarkdownFile).toHaveBeenCalledWith({ newName: "読書ログ", path: "読書メモ.md" });
    });
  });

  it("リネーム前保存に失敗した場合は操作せず本文を残す", async () => {
    const renameMarkdownFile = vi.fn();
    const writeMarkdownFile = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: "FILE_WRITE_FAILED", message: "ファイルを保存できませんでした。" }
    });

    window.relic = makeRelicApi({
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
      }),
      renameMarkdownFile,
      writeMarkdownFile
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;
    act(() => {
      useEditorStore.getState().updateTabContent(activeTabId, "未保存本文");
    });

    fireEvent.click(await screen.findByText("読書メモ", { selector: ".editor-file-title" }));
    fireEvent.change(container.querySelector(".editor-file-title-input") as HTMLInputElement, {
      target: { value: "読書ログ" }
    });
    fireEvent.submit(container.querySelector(".editor-file-title-form") as HTMLFormElement);

    expect(await screen.findByText("ファイルを保存できませんでした。")).toHaveClass("toast--error");
    expect(renameMarkdownFile).not.toHaveBeenCalled();
    const tab = useEditorStore.getState().tabs[activeTabId];
    expect(tab?.kind).toBe("file");
    if (tab?.kind === "file") expect(tab.content).toBe("未保存本文");
  });

  it("リンク更新影響が大きいリネームは確認し、キャンセル時は操作しない", async () => {
    const renameMarkdownFile = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    window.relic = makeRelicApi({
      getLinkUpdateImpact: vi.fn().mockResolvedValue({ ok: true, value: { fileCount: 31, linkCount: 100 } }),
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      renameMarkdownFile
    });

    await renderApp();

    fireEvent.contextMenu(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "名前を変更" }));
    fireEvent.change(screen.getByLabelText("名前を変更"), { target: { value: "読書ログ" } });
    fireEvent.keyDown(screen.getByLabelText("名前を変更"), { key: "Enter" });

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith("31 件のMarkdownファイル内にある 100 件のリンクを更新します。続けますか？");
    });
    expect(renameMarkdownFile).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("ファイルツリーの右クリックメニューからインラインでリネームする", async () => {
    const renameMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "本文テスト", name: "読書ログ", path: "読書ログ.md" },
        workspaceState: {
          ...withWorkspace,
          fileTree: [{ name: "読書ログ", path: "読書ログ.md", type: "file" }]
        }
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      renameMarkdownFile
    });

    await renderApp();

    fireEvent.contextMenu(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "名前を変更" }));
    fireEvent.change(screen.getByLabelText("名前を変更"), { target: { value: "読書ログ" } });
    fireEvent.keyDown(screen.getByLabelText("名前を変更"), { key: "Enter" });

    await waitFor(() => {
      expect(renameMarkdownFile).toHaveBeenCalledWith({ newName: "読書ログ", path: "読書メモ.md" });
    });
  });

  it("ファイルツリーの右クリックメニューからフォルダをインラインでリネームする", async () => {
    const renameFolder = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withWorkspace,
        fileTree: [
          {
            children: [{ name: "読書メモ", path: "Archive/読書メモ.md", type: "file" }],
            name: "Archive",
            path: "Archive",
            type: "folder"
          }
        ]
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            {
              children: [{ name: "読書メモ", path: "資料/読書メモ.md", type: "file" }],
              name: "資料",
              path: "資料",
              type: "folder"
            }
          ]
        }
      }),
      renameFolder
    });

    await renderApp();

    fireEvent.contextMenu(await screen.findByRole("button", { name: /資料/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "名前を変更" }));
    fireEvent.change(screen.getByLabelText("名前を変更"), { target: { value: "Archive" } });
    fireEvent.keyDown(screen.getByLabelText("名前を変更"), { key: "Enter" });

    await waitFor(() => {
      expect(renameFolder).toHaveBeenCalledWith({ newName: "Archive", path: "資料" });
    });
  });

  it("ファイルツリーの右クリックメニューからファイルを複製する", async () => {
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
      })
    });

    await renderApp();

    fireEvent.contextMenu(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "複製" }));

    await waitFor(() => {
      expect(duplicateMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
    });
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /読書メモ のコピー/ }).some((button) => (
        button.classList.contains("file-tree-row--appearing")
      ))).toBe(true);
    });
  });

  it("ファイルツリーの右クリックメニューから開く・ピン留め・パスコピーを実行する", async () => {
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
    });
    const togglePin = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withWorkspace,
        fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }],
        pinnedPaths: ["読書メモ.md"]
      }
    });
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
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      readMarkdownFile,
      togglePin
    });

    await renderApp();

    const fileRow = await screen.findByRole("button", { name: /読書メモ/ });
    fireEvent.contextMenu(fileRow);

    expect(await screen.findByRole("menuitem", { name: "開く" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "ピン留め" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "パスをコピー" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "パスをコピー" }));

    expect(writeText).toHaveBeenCalledWith("読書メモ.md");

    fireEvent.contextMenu(fileRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "ピン留め" }));

    await waitFor(() => {
      expect(togglePin).toHaveBeenCalledWith("読書メモ.md");
    });

    fireEvent.contextMenu(fileRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "開く" }));

    await waitFor(() => {
      expect(readMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
    });
  });

  it("ファイルツリーの右クリックメニューから作成・移動・Markdownリンクコピー・場所表示を実行する", async () => {
    const createLinkedMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "", name: "新規メモ", path: "資料/新規メモ.md" },
        workspaceState: {
          ...withWorkspace,
          fileTree: [
            {
              children: [{ name: "新規メモ", path: "資料/新規メモ.md", type: "file" }],
              name: "資料",
              path: "資料",
              type: "folder"
            }
          ]
        }
      }
    });
    const createFolder = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withWorkspace,
        fileTree: [
          {
            children: [
              { children: [], name: "下書き", path: "資料/下書き", type: "folder" },
              { name: "読書メモ", path: "資料/読書メモ.md", type: "file" }
            ],
            name: "資料",
            path: "資料",
            type: "folder"
          }
        ]
      }
    });
    const moveMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "本文", name: "読書メモ", path: "archive/読書メモ.md" },
        workspaceState: withWorkspace
      }
    });
    const revealWorkspaceItem = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    const promptSpy = vi.spyOn(window, "prompt");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    window.relic = makeRelicApi({
      createFolder,
      createLinkedMarkdownFile,
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            {
              children: [{ name: "読書メモ", path: "資料/読書メモ.md", type: "file" }],
              name: "資料",
              path: "資料",
              type: "folder"
            }
          ]
        }
      }),
      moveMarkdownFile,
      revealWorkspaceItem
    });

    await renderApp();

    const folderRow = await screen.findByRole("button", { name: /資料/ });
    promptSpy.mockReturnValueOnce("新規メモ");
    fireEvent.contextMenu(folderRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "ここに新規ファイル" }));
    await waitFor(() => {
      expect(createLinkedMarkdownFile).toHaveBeenCalledWith({ path: "資料/新規メモ.md" });
    });

    promptSpy.mockReturnValueOnce("下書き");
    fireEvent.contextMenu(folderRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "ここにフォルダ作成" }));
    await waitFor(() => {
      expect(createFolder).toHaveBeenCalledWith({ name: "下書き", parentFolder: "資料" });
    });

    const fileRow = await screen.findByRole("button", { name: /読書メモ/ });
    fireEvent.contextMenu(fileRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Markdownリンクをコピー" }));
    expect(writeText).toHaveBeenCalledWith("[[資料/読書メモ]]");

    fireEvent.contextMenu(fileRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "ファイルの場所を表示" }));
    await waitFor(() => {
      expect(revealWorkspaceItem).toHaveBeenCalledWith({ path: "資料/読書メモ.md" });
    });

    promptSpy.mockReturnValueOnce("archive");
    fireEvent.contextMenu(fileRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "移動…" }));
    await waitFor(() => {
      expect(moveMarkdownFile).toHaveBeenCalledWith({
        destinationFolder: "archive",
        path: "資料/読書メモ.md"
      });
    });

    promptSpy.mockRestore();
  });

  it("ファイルツリーの右クリックメニューを画面基準で表示する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      })
    });

    await renderApp();

    fireEvent.contextMenu(await screen.findByRole("button", { name: /読書メモ/ }), {
      clientX: 490,
      clientY: 1040
    });

    const menu = await screen.findByRole("menu");

    expect(menu).toHaveClass("file-tree-context-menu");
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveStyle({ position: "fixed" });
    expect(Number.parseInt((menu as HTMLElement).style.left, 10)).toBeGreaterThan(0);
    expect(Number.parseInt((menu as HTMLElement).style.top, 10)).toBeGreaterThan(0);
  });
});
