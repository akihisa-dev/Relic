import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings, defaultFeatureToggles } from "../shared/ipc";
import {
  installMatchMediaMock,
  makeRelicApi,
  resetRendererStores,
  testCardbookState as withCardbook
} from "../test/rendererTestUtils";
import { App } from "./App";
import { useEditorStore } from "./store/editorStore";
import { useUiStore } from "./store/uiStore";

function renderApp() {
  return render(<App />);
}

describe("App", () => {
  beforeAll(installMatchMediaMock);

  afterEach(() => {
    vi.clearAllMocks();
    resetRendererStores();
  });

  it("ビュー切り替えナビとメインエリアが表示される", async () => {
    window.relic = makeRelicApi();

    await renderApp();

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(await screen.findByText("書く場所を選ぶ")).toBeInTheDocument();
  });

  it("カードブックを開くとカードツリーが表示される", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      })
    });

    await renderApp();

    expect(await screen.findByRole("button", { name: /読書メモ/ })).toBeInTheDocument();
  });

  it("カードツリーのノートをクリックするとタブが開く", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      }),
      readMarkdownCard: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      })
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));

    expect(window.relic!.readMarkdownCard).toHaveBeenCalledWith({ path: "読書メモ.md" });
    expect(await screen.findByText("読書メモ", { selector: ".pane-tab-name" })).toBeInTheDocument();
  });

  it("タブの右クリックメニューから複製・ピン留め・コピー・場所表示を実行する", async () => {
    const duplicateMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        card: { content: "本文テスト", name: "読書メモ のコピー", path: "読書メモ のコピー.md" },
        cardbookState: {
          ...withCardbook,
          cardTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "card" },
            { name: "読書メモ のコピー", path: "読書メモ のコピー.md", type: "card" }
          ]
        }
      }
    });
    const revealCardbookItem = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    window.relic = makeRelicApi({
      duplicateMarkdownCard,
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      }),
      readMarkdownCard: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      }),
      revealCardbookItem
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    const tab = (await screen.findByText("読書メモ", { selector: ".pane-tab-name" })).closest(".pane-tab");
    expect(tab).not.toBeNull();

    fireEvent.contextMenu(tab!);
    fireEvent.click(await screen.findByRole("button", { name: "Markdownリンクをコピー" }));
    expect(writeText).toHaveBeenCalledWith("[[読書メモ]]");

    fireEvent.contextMenu(tab!);
    fireEvent.click(await screen.findByRole("button", { name: "複製" }));
    await waitFor(() => {
      expect(duplicateMarkdownCard).toHaveBeenCalledWith({ path: "読書メモ.md" });
    });

    fireEvent.contextMenu(tab!);
    fireEvent.click(await screen.findByRole("button", { name: "ピン留め" }));
    fireEvent.contextMenu(tab!);
    expect(await screen.findByRole("button", { name: "ピン留めを解除" })).toBeInTheDocument();

    fireEvent.contextMenu(tab!);
    fireEvent.click(await screen.findByRole("button", { name: "カードの場所を表示" }));
    await waitFor(() => {
      expect(revealCardbookItem).toHaveBeenCalledWith({ path: "読書メモ.md" });
    });
  });

  it("右クリックメニューのMarkdownボタンを開いているタブへ反映する", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      }),
      readMarkdownCard: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      })
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));

    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull();
    });

    const editorContent = container.querySelector(".cm-content");
    expect(editorContent).not.toBeNull();
    fireEvent.contextMenu(editorContent!, { clientX: 64, clientY: 64 });
    const editorMenu = await screen.findByRole("menu");
    fireEvent.click(within(editorMenu).getByRole("menuitem", { name: "太字" }));

    await waitFor(() => {
      const activeTabId = useEditorStore.getState().leftPane.activeTabId;
      expect(activeTabId).not.toBeNull();
      const tab = useEditorStore.getState().tabs[activeTabId!];
      expect(tab?.kind).toBe("card");
      if (tab?.kind === "card") expect(tab.content).toContain("**");
    });
  });

  it("カードツリーで開いているノートを再選択するとタブをアクティブにする", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      }),
      readMarkdownCard: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      })
    });

    const { container } = await renderApp();

    const cardButton = await screen.findByRole("button", { name: /読書メモ/ });
    fireEvent.click(cardButton);
    expect(container.querySelector(".rail-tab-flight--open")).toBeInTheDocument();

    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull();
    });
    const openedTabId = useEditorStore.getState().leftPane.activeTabId;

    fireEvent.click(cardButton);
    expect(container.querySelector(".rail-tab-flight--close")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).toBe(openedTabId);
    });
  });

  it("カードタブを閉じるとその場で下へ消える表示を出す", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      }),
      readMarkdownCard: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      })
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    const tab = (await screen.findByText("読書メモ", { selector: ".pane-tab-name" })).closest(".pane-tab");
    expect(tab).toBeInstanceOf(HTMLElement);

    fireEvent.click(within(tab as HTMLElement).getByTitle("タブを閉じる"));

    await waitFor(() => {
      expect(container.querySelector(".rail-tab-flight--close")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).toBeNull();
    });
  });

  it("カード読み込み完了前に再クリックすると開く操作を取り消す", async () => {
    let resolveRead: (value: Awaited<ReturnType<NonNullable<typeof window.relic>["readMarkdownCard"]>>) => void = () => {};
    const readMarkdownCard = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveRead = resolve;
    }));

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      }),
      readMarkdownCard
    });

    await renderApp();

    const cardButton = await screen.findByRole("button", { name: /読書メモ/ });
    fireEvent.click(cardButton);
    fireEvent.click(cardButton);

    resolveRead({
      ok: true,
      value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
    });

    await waitFor(() => {
      expect(readMarkdownCard).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();

    expect(useEditorStore.getState().leftPane.activeTabId).toBeNull();
  });

  it("複数カードを開いた後でもカードツリー再クリックで対象タブをアクティブにする", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "card" },
            { name: "日記", path: "日記.md", type: "card" }
          ]
        }
      }),
      readMarkdownCard: vi.fn().mockImplementation(({ path }: { path: string }) => Promise.resolve({
        ok: true,
        value: { content: "本文テスト", name: path.replace(/\.md$/, ""), path }
      }))
    });

    await renderApp();

    const firstCardButton = await screen.findByRole("button", { name: /読書メモ/ });
    const secondCardButton = await screen.findByRole("button", { name: /日記/ });

    fireEvent.click(firstCardButton);
    await waitFor(() => {
      expect(Object.values(useEditorStore.getState().tabs).some((tab) => tab.kind === "card" && tab.path === "読書メモ.md")).toBe(true);
    });

    fireEvent.click(secondCardButton);
    await waitFor(() => {
      expect(Object.values(useEditorStore.getState().tabs).some((tab) => tab.kind === "card" && tab.path === "日記.md")).toBe(true);
    });

    fireEvent.click(firstCardButton);

    const state = useEditorStore.getState();
    const firstTabId = Object.values(state.tabs).find((tab) => tab.kind === "card" && tab.path === "読書メモ.md")?.id;
    expect(firstTabId).toBeTruthy();
    expect(state.leftPane.activeTabId).toBe(firstTabId);
    expect(Object.values(useEditorStore.getState().tabs).some((tab) => tab.kind === "card" && tab.path === "日記.md")).toBe(true);
  });

  it("カードツリーのカードフォルダを開閉できる", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            {
              children: [{ name: "読書メモ", path: "資料/読書メモ.md", type: "card" }],
              name: "資料",
              path: "資料",
              type: "cardFolder"
            }
          ]
        }
      })
    });

    await renderApp();

    const cardFolderButton = await screen.findByRole("button", { name: /資料/ });
    expect(screen.getByRole("button", { name: /読書メモ/ })).toBeInTheDocument();

    fireEvent.click(cardFolderButton);

    expect(screen.queryByRole("button", { name: /読書メモ/ })).not.toBeInTheDocument();

    fireEvent.click(cardFolderButton);

    expect(screen.getByRole("button", { name: /読書メモ/ })).toBeInTheDocument();
  });

  it("カードフォルダ右クリックメニューからカードフォルダ以下と全体を一括開閉できる", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            {
              children: [
                {
                  children: [{ name: "草稿", path: "資料/下書き/草稿.md", type: "card" }],
                  name: "下書き",
                  path: "資料/下書き",
                  type: "cardFolder"
                },
                { name: "読書メモ", path: "資料/読書メモ.md", type: "card" }
              ],
              name: "資料",
              path: "資料",
              type: "cardFolder"
            },
            {
              children: [{ name: "保管メモ", path: "保管/保管メモ.md", type: "card" }],
              name: "保管",
              path: "保管",
              type: "cardFolder"
            }
          ]
        }
      })
    });

    await renderApp();

    const cardFolderButton = await screen.findByRole("button", { name: /資料/ });

    fireEvent.contextMenu(cardFolderButton);
    fireEvent.click(await screen.findByRole("menuitem", { name: "このカードフォルダ以下を閉じる" }));
    expect(screen.queryByRole("button", { name: /読書メモ/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /保管メモ/ })).toBeInTheDocument();

    fireEvent.contextMenu(cardFolderButton);
    fireEvent.click(await screen.findByRole("menuitem", { name: "このカードフォルダ以下を開く" }));
    expect(screen.getByRole("button", { name: /草稿/ })).toBeInTheDocument();

    fireEvent.contextMenu(cardFolderButton);
    fireEvent.click(await screen.findByRole("menuitem", { name: "すべてのカードフォルダを閉じる" }));
    expect(screen.queryByRole("button", { name: /読書メモ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /保管メモ/ })).not.toBeInTheDocument();

    fireEvent.contextMenu(cardFolderButton);
    fireEvent.click(await screen.findByRole("menuitem", { name: "すべてのカードフォルダを開く" }));
    expect(screen.getByRole("button", { name: /草稿/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /保管メモ/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "すべてのカードフォルダを閉じる" }));
    expect(screen.queryByRole("button", { name: /読書メモ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /保管メモ/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "すべてのカードフォルダを開く" }));
    expect(screen.getByRole("button", { name: /草稿/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /保管メモ/ })).toBeInTheDocument();
  });

  it("開いているカードをカードツリーではハイライトしない", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      }),
      readMarkdownCard: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      })
    });

    await renderApp();

    const cardButton = await screen.findByRole("button", { name: /読書メモ/ });
    fireEvent.click(cardButton);

    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull();
    });
    expect(cardButton).not.toHaveClass("active");
    expect(cardButton).toHaveClass("open");
  });

  it("サイドバー幅のドラッグ変更を最小180px・最大500pxに制限する", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    const sidebar = container.querySelector(".sidebar");
    const resizeHandle = container.querySelector(".sidebar-resize-handle");

    expect(sidebar).toBeInstanceOf(HTMLElement);
    expect(resizeHandle).toBeInstanceOf(HTMLElement);

    fireEvent.mouseDown(resizeHandle as HTMLElement, { clientX: 260 });

    expect(sidebar).toHaveClass("sidebar--resizing");
    expect(resizeHandle).toHaveClass("sidebar-resize-handle--active");

    fireEvent.mouseMove(document, { clientX: 800 });

    expect(sidebar).toHaveStyle({ width: "500px" });

    fireEvent.mouseUp(document);

    expect(sidebar).not.toHaveClass("sidebar--resizing");
    expect(resizeHandle).not.toHaveClass("sidebar-resize-handle--active");

    fireEvent.mouseDown(resizeHandle as HTMLElement, { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: -200 });

    expect(sidebar).toHaveStyle({ width: "180px" });

    fireEvent.mouseUp(document);
  });

  it("右パネルのアウトライン・リンクボタンを閉じた後も再度開ける", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    expect(useUiStore.getState().isRightPanelOpen).toBe(false);
    expect(useUiStore.getState().rightPanelView).toBe("outline");

    fireEvent.click(screen.getByRole("button", { name: "アウトライン" }));

    expect(useUiStore.getState().isRightPanelOpen).toBe(true);
    expect(useUiStore.getState().rightPanelView).toBe("outline");
    expect(container.querySelector(".right-panel-actions-row")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "アウトライン" }));

    expect(useUiStore.getState().isRightPanelOpen).toBe(false);
    expect(useUiStore.getState().rightPanelView).toBe("outline");

    const mainActions = document.querySelector(".main-area-actions");
    expect(mainActions).toBeInstanceOf(HTMLElement);
    expect(within(mainActions as HTMLElement).queryByRole("button", { name: "プロパティ" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "リンク" }));

    expect(useUiStore.getState().isRightPanelOpen).toBe(true);
    expect(useUiStore.getState().rightPanelView).toBe("links");

    fireEvent.click(screen.getByRole("button", { name: "リンク" }));

    expect(useUiStore.getState().isRightPanelOpen).toBe(false);
    expect(useUiStore.getState().rightPanelView).toBe("links");

    fireEvent.click(screen.getByRole("button", { name: "アウトライン" }));

    expect(useUiStore.getState().isRightPanelOpen).toBe(true);
    expect(useUiStore.getState().rightPanelView).toBe("outline");
  });

  it("右パネル幅のドラッグ変更を最小220px・最大520pxに制限する", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");
    fireEvent.click(screen.getByRole("button", { name: "アウトライン" }));

    const rightPanel = container.querySelector(".right-panel");
    const resizeHandle = container.querySelector(".right-panel-resize-handle");

    expect(rightPanel).toBeInstanceOf(HTMLElement);
    expect(resizeHandle).toBeInstanceOf(HTMLElement);

    fireEvent.mouseDown(resizeHandle as HTMLElement, { clientX: 500 });

    expect(rightPanel).toHaveClass("right-panel--resizing");
    expect(resizeHandle).toHaveClass("right-panel-resize-handle--active");

    fireEvent.mouseMove(document, { clientX: -100 });

    expect(rightPanel).toHaveStyle({ width: "520px" });

    fireEvent.mouseUp(document);

    expect(rightPanel).not.toHaveClass("right-panel--resizing");
    expect(resizeHandle).not.toHaveClass("right-panel-resize-handle--active");

    fireEvent.mouseDown(resizeHandle as HTMLElement, { clientX: 200 });
    fireEvent.mouseMove(document, { clientX: 900 });

    expect(rightPanel).toHaveStyle({ width: "220px" });

    fireEvent.mouseUp(document);
  });

  it("レールのプロパティボタンから専用設定を開ける", async () => {
    window.relic = makeRelicApi({
      getUserDefinedFields: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ name: "category", type: "select", choices: ["draft", "done"] }]
      }),
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "プロパティ" }));

    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    expect(activeTabId).toBe("panel-frontmatter");
    expect(useEditorStore.getState().tabs[activeTabId!]).toMatchObject({
      kind: "panel",
      panel: "frontmatter"
    });
    expect(document.querySelector('.pane-tab[data-tab-id="panel-frontmatter"] .pane-tab-icon svg')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "プロパティ" })).toHaveClass("active");
    expect(screen.getByText("プロパティ設定")).toBeInTheDocument();
    expect(screen.getByDisplayValue("category")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "プロパティ" }));

    expect(document.querySelector(".rail-tab-flight--close")).not.toBeInTheDocument();
    expect(useEditorStore.getState().leftPane.activeTabId).toBe("panel-frontmatter");
    expect(useEditorStore.getState().tabs["panel-frontmatter"]).toBeDefined();
  });

  it("レールの年表設定ボタンから専用画面を開ける", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });

    await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表設定" }));

    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    expect(activeTabId).toBe("panel-timeline-settings");
    expect(useEditorStore.getState().tabs[activeTabId!]).toMatchObject({
      kind: "panel",
      panel: "timeline-settings"
    });
    expect(screen.getByRole("heading", { name: "年表設定" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "年表設定" })).toHaveClass("active");
  });

  it("レールのTimelineボタンからtimelineを持つカードを表示できる", async () => {
    const updateTimelineChartEntry = vi.fn().mockResolvedValue({ ok: true, value: [] });

    window.relic = makeRelicApi({
      getCardbookTimeline: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            endLabel: "1333",
            endValue: 1332,
            cardName: "鎌倉時代",
            path: "history/kamakura.md",
            startLabel: "1185",
            startValue: 1184
          }],
          cardPaths: ["history/kamakura.md"],
          id: "timeline",
          name: "年表",
          source: "timeline"
        }]
      }),
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook }),
      readMarkdownCard: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "---\ntimeline: [1186, 1334]\n---\n# 鎌倉時代",
          name: "鎌倉時代",
          path: "history/kamakura.md"
        }
      }),
      updateTimelineChartEntry
    });

    const renderResult = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表" }));
    fireEvent.click(renderResult.container.querySelector(".timeline-source-button")!);

    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    expect(activeTabId).toBe("timeline-charts");
    expect(useEditorStore.getState().tabs[activeTabId!]).toMatchObject({
      chartId: "charts",
      kind: "timeline"
    });
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
    expect(renderResult.container.querySelector(".timeline-sidebar")).toBeNull();
    expect(screen.getAllByText("鎌倉時代").length).toBeGreaterThan(0);
    expect(screen.getByText("1185 〜 1333")).toBeInTheDocument();
    expect(screen.getByText("年代")).toBeInTheDocument();
    expect(screen.getByText("1185-1333")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1185-1333" })).toHaveAttribute(
      "title",
      "この年代へ移動"
    );
    expect(renderResult.container.querySelector(".timeline-minimap")).toBeInTheDocument();
    expect(renderResult.container.querySelector(".timeline-minimap-item")).toBeInTheDocument();
    expect(renderResult.container.querySelector(".timeline-actions")).toBeNull();
    expect(screen.queryByText("計画")).not.toBeInTheDocument();
    expect(screen.queryByText("実行")).not.toBeInTheDocument();
    expect(renderResult.container.querySelectorAll(".timeline-guide-line").length).toBeGreaterThan(0);
    expect(renderResult.container.querySelectorAll(".timeline-guide-line--major").length).toBeGreaterThan(0);
    expect(renderResult.container.querySelectorAll(".timeline-guide-line").length).toBeGreaterThan(
      renderResult.container.querySelectorAll(".timeline-guide-line--major").length
    );
    const oneYearAxisLabels = Array.from(renderResult.container.querySelectorAll(".timeline-axis--timeline .timeline-axis-cell"))
      .map((element) => Number(element.textContent?.replace("−", "-") ?? Number.NaN));
    expect(oneYearAxisLabels.length).toBeGreaterThan(0);
    expect(oneYearAxisLabels.slice(1, 5).every((label, index) => label - oneYearAxisLabels[index] === 1)).toBe(true);
    expect(renderResult.container.querySelectorAll(".timeline-guide-line").length).toBeGreaterThan(
      renderResult.container.querySelectorAll(".timeline-guide-line--major").length
    );
    expect(renderResult.container.querySelectorAll(".timeline-guide-row-line").length).toBeGreaterThan(0);

    const fill = renderResult.container.querySelector(".timeline-fill") as HTMLElement;
    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 20 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    await waitFor(() => expect(updateTimelineChartEntry).toHaveBeenCalledWith({
      endValue: 1333,
      kind: "move",
      originalEndValue: 1332,
      originalStartValue: 1184,
      path: "history/kamakura.md",
      source: "timeline",
      startValue: 1185
    }));
  });

  it("Timelineバー編集は低速ドラッグで1年単位の細かな変更にする", async () => {
    const updateTimelineChartEntry = vi.fn().mockResolvedValue({ ok: true, value: [] });

    window.relic = makeRelicApi({
      getCardbookTimeline: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            endLabel: "1333",
            endValue: 1332,
            cardName: "鎌倉時代",
            path: "history/kamakura.md",
            startLabel: "1185",
            startValue: 1184
          }],
          cardPaths: ["history/kamakura.md"],
          id: "timeline",
          name: "年表",
          source: "timeline"
        }]
      }),
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook }),
      readMarkdownCard: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "---\ntimeline: [1210, 1358]\n---\n# 鎌倉時代",
          name: "鎌倉時代",
          path: "history/kamakura.md"
        }
      }),
      updateTimelineChartEntry
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表" }));
    fireEvent.click(container.querySelector(".timeline-source-button")!);
    expect(container.querySelector(".timeline-actions")).toBeNull();

    const fill = container.querySelector(".timeline-fill") as HTMLElement;
    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    for (let clientX = 1; clientX <= 72; clientX += 1) {
      const pointerMove = new Event("pointermove") as PointerEvent;
      Object.defineProperty(pointerMove, "clientX", { value: clientX });
      Object.defineProperty(pointerMove, "pointerId", { value: 1 });
      window.dispatchEvent(pointerMove);
    }
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 72 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    await waitFor(() => expect(updateTimelineChartEntry).toHaveBeenCalledWith({
      endValue: 1333,
      kind: "move",
      originalEndValue: 1332,
      originalStartValue: 1184,
      path: "history/kamakura.md",
      source: "timeline",
      startValue: 1185
    }));
  });

  it("Timelineバー編集は高速ドラッグで大きく移動する", async () => {
    const updateTimelineChartEntry = vi.fn().mockResolvedValue({ ok: true, value: [] });

    window.relic = makeRelicApi({
      getCardbookTimeline: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            endLabel: "1333",
            endValue: 1332,
            cardName: "鎌倉時代",
            path: "history/kamakura.md",
            startLabel: "1185",
            startValue: 1184
          }],
          cardPaths: ["history/kamakura.md"],
          id: "timeline",
          name: "年表",
          source: "timeline"
        }]
      }),
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook }),
      readMarkdownCard: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "---\ntimeline: [1210, 1358]\n---\n# 鎌倉時代",
          name: "鎌倉時代",
          path: "history/kamakura.md"
        }
      }),
      updateTimelineChartEntry
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表" }));
    fireEvent.click(container.querySelector(".timeline-source-button")!);
    expect(container.querySelector(".timeline-actions")).toBeNull();

    const fill = container.querySelector(".timeline-fill") as HTMLElement;
    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 72 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    await waitFor(() => expect(updateTimelineChartEntry).toHaveBeenCalledWith({
      endValue: 1335,
      kind: "move",
      originalEndValue: 1332,
      originalStartValue: 1184,
      path: "history/kamakura.md",
      source: "timeline",
      startValue: 1187
    }));
  });

  it("Timeline面を掴んで横スクロールできる", async () => {
    window.relic = makeRelicApi({
      getCardbookTimeline: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            endLabel: "2026-06-20",
            endValue: 20624,
            cardName: "長い予定",
            path: "tasks/long.md",
            startLabel: "2026-05-01",
            startValue: 20574
          }],
          cardPaths: [],
          id: "timeline",
          name: "Timeline",
          source: "timeline"
        }]
      }),
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表" }));

    const chart = container.querySelector(".timeline-chart") as HTMLDivElement;
    Object.defineProperty(chart, "scrollLeft", { configurable: true, value: 120, writable: true });

    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 200 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    chart.dispatchEvent(pointerDown);

    const pointerMove = new Event("pointermove") as PointerEvent;
    Object.defineProperty(pointerMove, "clientX", { value: 150 });
    Object.defineProperty(pointerMove, "pointerId", { value: 1 });
    window.dispatchEvent(pointerMove);

    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    expect(chart.scrollLeft).toBe(170);
  });

  it("旧形式の年表データが返っても年表タブを表示できる", async () => {
    window.relic = makeRelicApi({
      getCardbookTimeline: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ endYear: 1333, cardName: "鎌倉時代", path: "history/kamakura.md", startYear: 1185 }]
      }),
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表" }));
    fireEvent.click(container.querySelector(".timeline-source-button")!);

    expect(screen.getAllByText("鎌倉時代").length).toBeGreaterThan(0);
    expect(screen.getByText("1185 〜 1333")).toBeInTheDocument();
  });

  it("画面タブ名は言語変更に追従する", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });

    await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "プロパティ" }));

    expect(document.querySelector('.pane-tab[data-tab-id="panel-frontmatter"]')?.textContent).toContain("プロパティ");

    useEditorStore.getState().setEditorSettings({ ...defaultEditorSettings, language: "en" });

    await waitFor(() => {
      expect(document.querySelector('.pane-tab[data-tab-id="panel-frontmatter"]')?.textContent).toContain("Properties");
    });
  });

  it("別の画面タブを開いた後でも開いているレールボタンを押すと対象タブをアクティブにする", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });

    await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "プロパティ" }));
    fireEvent.click(screen.getByRole("button", { name: "設定" }));

    expect(useEditorStore.getState().tabs["panel-frontmatter"]).toMatchObject({
      kind: "panel",
      panel: "frontmatter"
    });
    expect(useEditorStore.getState().leftPane.activeTabId).toBe("panel-settings");
    expect(screen.getByRole("button", { name: "プロパティ" })).toHaveClass("open");
    expect(screen.getByRole("button", { name: "プロパティ" })).not.toHaveClass("active");

    fireEvent.click(screen.getByRole("button", { name: "プロパティ" }));

    expect(document.querySelector(".rail-tab-flight--close")).not.toBeInTheDocument();
    expect(useEditorStore.getState().leftPane.activeTabId).toBe("panel-frontmatter");
    expect(screen.getByRole("button", { name: "プロパティ" })).toHaveClass("active");
    expect(useEditorStore.getState().tabs["panel-frontmatter"]).toBeDefined();
    expect(useEditorStore.getState().tabs["panel-settings"]).toBeDefined();
  });

  it("分割表示を閉じると退場反応を通る", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });

    const { container } = await renderApp();

    const splitButton = await screen.findByRole("button", { name: "分割" });

    fireEvent.click(splitButton);
    const panes = container.querySelector(".panes-container");
    if (!(panes instanceof HTMLElement)) throw new Error("panes container was not rendered");
    expect(panes).toHaveClass("panes-container--split");

    fireEvent.click(screen.getByRole("button", { name: "分割" }));
    expect(panes).toHaveClass("panes-container--closing-split");
  });

  it("右上の分割ボタン横でソースモードを切り替えられる", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });

    await renderApp();

    const sourceButton = await screen.findByRole("button", { name: "ソース" });
    expect(screen.getByRole("button", { name: "分割" })).toBeInTheDocument();

    fireEvent.click(sourceButton);

    expect(sourceButton).toHaveClass("active");
  });

  it("サイドバーが閉じていてもショートカットで対象ビューを開ける", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });
    useUiStore.setState({
      activeSidebarView: "cards",
      isRightPanelOpen: true,
      isSidebarOpen: false,
      isTypewriterMode: false,
      rightPanelView: "outline"
    });

    await renderApp();

    await screen.findByRole("main");

    fireEvent.keyDown(window, { key: "f", metaKey: true });

    expect(useUiStore.getState().isSidebarOpen).toBe(true);
    expect(useUiStore.getState().activeSidebarView).toBe("cards");
    await waitFor(() => {
      expect(screen.getByLabelText("カード検索")).toHaveFocus();
    });

    fireEvent.keyDown(window, { key: "b", metaKey: true });

    expect(useUiStore.getState().isSidebarOpen).toBe(false);

    fireEvent.keyDown(window, { key: "n", metaKey: true });

    expect(useUiStore.getState().isSidebarOpen).toBe(true);
    expect(useUiStore.getState().activeSidebarView).toBe("cards");
  });

  it("カードボタンでカードサイドバーを開閉できる", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });

    await renderApp();

    const cardButton = await screen.findByRole("button", { name: "カード" });

    expect(useUiStore.getState().isSidebarOpen).toBe(true);
    expect(cardButton).toHaveClass("active");

    fireEvent.click(cardButton);

    expect(useUiStore.getState().isSidebarOpen).toBe(false);
    expect(cardButton).not.toHaveClass("active");

    fireEvent.click(cardButton);

    expect(useUiStore.getState().isSidebarOpen).toBe(true);
    expect(useUiStore.getState().activeSidebarView).toBe("cards");
    expect(cardButton).toHaveClass("active");
  });

  it("新規カードボタンから名前なしでカードを作成する", async () => {
    const createMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withCardbook,
        cardTree: [{ name: "新規カード", path: "新規カード.md", type: "card" }]
      }
    });
    const readMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "", name: "新規カード", path: "新規カード.md" }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook }),
      createMarkdownCard,
      readMarkdownCard
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "新規カード" }));

    expect(document.querySelector(".rail-tab-flight--open")).toBeInTheDocument();
    expect(createMarkdownCard).toHaveBeenCalledWith({ name: "新規カード" });
    expect((await screen.findAllByText("新規カード")).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /新規カード/ }).some((button) => (
        button.classList.contains("card-tree-row--appearing")
      ))).toBe(true);
    });
  });

  it("メインパネルの新規カード作成は名前入力なしで作成する", async () => {
    const createMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withCardbook,
        cardTree: [{ name: "新規カード", path: "新規カード.md", type: "card" }]
      }
    });
    const readMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "", name: "新規カード", path: "新規カード.md" }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook }),
      createMarkdownCard,
      readMarkdownCard
    });

    await renderApp();

    expect(screen.queryByLabelText("カード名を入力")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "新規カードを作成" }));

    expect(createMarkdownCard).toHaveBeenCalledWith({ name: "新規カード" });
    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull();
    });
    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    const tab = useEditorStore.getState().tabs[activeTabId!];
    expect(tab?.kind).toBe("card");
    if (tab?.kind === "card") expect(tab.path).toBe("新規カード.md");
  });

  it("新規カードフォルダボタンから名前なしでカードフォルダを作成する", async () => {
    const createCardFolder = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withCardbook,
        cardTree: [{ children: [], name: "新規カードフォルダ", path: "新規カードフォルダ", type: "cardFolder" }]
      }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook }),
      createCardFolder
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "カードフォルダ作成" }));

    expect(document.querySelector(".sidebar-create-flight")).toBeInTheDocument();
    expect(createCardFolder).toHaveBeenCalledWith({ name: "新規カードフォルダ" });
    expect(await screen.findByRole("button", { name: /新規カードフォルダ/ })).toBeInTheDocument();
  });

  it("カードブックを開くボタンから既存カードフォルダを登録する", async () => {
    const openCardbook = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeCardbook: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
        cardTree: [{ name: "index", path: "index.md", type: "card" }],
        pinnedPaths: [],
        cardbooks: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
      }
    });

    window.relic = makeRelicApi({ openCardbook });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "カードブックを開く" }));

    expect(openCardbook).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Notes")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /index/ })).toBeInTheDocument();
  });

  it("新規カードブック作成ボタンからカードブックを登録する", async () => {
    const createNewCardbook = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeCardbook: { id: "ws-new", name: "Drafts", path: "/tmp/Drafts" },
        cardTree: [],
        pinnedPaths: [],
        cardbooks: [{ id: "ws-new", name: "Drafts", path: "/tmp/Drafts" }]
      }
    });

    window.relic = makeRelicApi({ createNewCardbook });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "新規カードブック" }));

    expect(createNewCardbook).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Drafts")).toBeInTheDocument();
  });

  it("登録済みカードブックをクリックして切り替える", async () => {
    const switchCardbook = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeCardbook: { id: "ws-2", name: "Archive", path: "/tmp/Archive" },
        cardTree: [{ name: "old", path: "old.md", type: "card" }],
        cardbooks: [
          { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          { id: "ws-2", name: "Archive", path: "/tmp/Archive" }
        ]
      }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeCardbook: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          cardTree: [],
          cardbooks: [
            { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
            { id: "ws-2", name: "Archive", path: "/tmp/Archive" }
          ]
        }
      }),
      switchCardbook
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Notes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));

    expect(switchCardbook).toHaveBeenCalledWith({ cardbookId: "ws-2" });
    expect(await screen.findByRole("button", { name: /old/ })).toBeInTheDocument();
  });

  it("左レールのカードブック名をダブルクリックで変更する", async () => {
    const renameCardbook = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeCardbook: { id: "ws-1", name: "Renamed", path: "/tmp/Renamed" },
        cardTree: [],
        pinnedPaths: [],
        cardbooks: [{ id: "ws-1", name: "Renamed", path: "/tmp/Renamed" }]
      }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeCardbook: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          cardTree: [],
          pinnedPaths: [],
          cardbooks: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      renameCardbook
    });

    await renderApp();

    fireEvent.doubleClick(await screen.findByRole("button", { name: "Notes" }));
    fireEvent.change(await screen.findByLabelText("名前を変更"), { target: { value: "Renamed" } });
    fireEvent.keyDown(screen.getByLabelText("名前を変更"), { key: "Enter" });

    await waitFor(() => {
      expect(renameCardbook).toHaveBeenCalledWith({ name: "Renamed", cardbookId: "ws-1" });
    });
  });

  it("左レールのカードブック名変更後は少しレールを開いたままにする", async () => {
    const renameCardbook = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeCardbook: { id: "ws-1", name: "Renamed", path: "/tmp/Renamed" },
        cardTree: [],
        pinnedPaths: [],
        cardbooks: [{ id: "ws-1", name: "Renamed", path: "/tmp/Renamed" }]
      }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeCardbook: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          cardTree: [],
          pinnedPaths: [],
          cardbooks: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      renameCardbook
    });

    await renderApp();

    const rail = screen.getByRole("navigation");
    fireEvent.doubleClick(await screen.findByRole("button", { name: "Notes" }));
    fireEvent.change(await screen.findByLabelText("名前を変更"), { target: { value: "Renamed" } });
    fireEvent.keyDown(screen.getByLabelText("名前を変更"), { key: "Enter" });

    await waitFor(() => {
      expect(renameCardbook).toHaveBeenCalledWith({ name: "Renamed", cardbookId: "ws-1" });
    });
    expect(rail).toHaveClass("rail--cardbook-editing");

    await waitFor(() => {
      expect(rail).not.toHaveClass("rail--cardbook-editing");
    }, { timeout: 1500 });
  });

  it("左レールのカードブック名変更中はレールを開いたままにする", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeCardbook: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          cardTree: [],
          pinnedPaths: [],
          cardbooks: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      })
    });

    await renderApp();

    const rail = screen.getByRole("navigation");
    fireEvent.doubleClick(await screen.findByRole("button", { name: "Notes" }));

    expect(rail).toHaveClass("rail--cardbook-editing");

    fireEvent.keyDown(screen.getByLabelText("名前を変更"), { key: "Escape" });

    expect(rail).not.toHaveClass("rail--cardbook-editing");
  });

  it("左レールのカードブック名変更でIME確定中のEnterではリネーム確定しない", async () => {
    const renameCardbook = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeCardbook: { id: "ws-1", name: "小説メモ", path: "/tmp/小説メモ" },
        cardTree: [],
        pinnedPaths: [],
        cardbooks: [{ id: "ws-1", name: "小説メモ", path: "/tmp/小説メモ" }]
      }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeCardbook: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          cardTree: [],
          pinnedPaths: [],
          cardbooks: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      renameCardbook
    });

    await renderApp();

    fireEvent.doubleClick(await screen.findByRole("button", { name: "Notes" }));
    const input = await screen.findByLabelText("名前を変更");
    fireEvent.change(input, { target: { value: "小説メモ" } });
    fireEvent.keyDown(input, { isComposing: true, key: "Enter" });

    expect(renameCardbook).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(renameCardbook).toHaveBeenCalledWith({ name: "小説メモ", cardbookId: "ws-1" });
    });
  });

  it("左レールのカードブック名変更でIME確定後のkeyCode 229のEnterは確定する", async () => {
    const renameCardbook = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeCardbook: { id: "ws-1", name: "小説メモ", path: "/tmp/小説メモ" },
        cardTree: [],
        pinnedPaths: [],
        cardbooks: [{ id: "ws-1", name: "小説メモ", path: "/tmp/小説メモ" }]
      }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeCardbook: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          cardTree: [],
          pinnedPaths: [],
          cardbooks: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      renameCardbook
    });

    await renderApp();

    fireEvent.doubleClick(await screen.findByRole("button", { name: "Notes" }));
    const input = await screen.findByLabelText("名前を変更");
    fireEvent.change(input, { target: { value: "小説メモ" } });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });

    await waitFor(() => {
      expect(renameCardbook).toHaveBeenCalledWith({ name: "小説メモ", cardbookId: "ws-1" });
    });
  });

  it("左レールのカードブック名変更で文字確定Enterのkeyupではリネーム確定しない", async () => {
    const renameCardbook = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeCardbook: { id: "ws-1", name: "小説メモ", path: "/tmp/小説メモ" },
        cardTree: [],
        pinnedPaths: [],
        cardbooks: [{ id: "ws-1", name: "小説メモ", path: "/tmp/小説メモ" }]
      }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeCardbook: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          cardTree: [],
          pinnedPaths: [],
          cardbooks: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      renameCardbook
    });

    await renderApp();

    fireEvent.doubleClick(await screen.findByRole("button", { name: "Notes" }));
    const input = await screen.findByLabelText("名前を変更");
    fireEvent.change(input, { target: { value: "小説メモ" } });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { isComposing: true, key: "Enter" });
    expect(renameCardbook).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input);
    fireEvent.keyUp(input, { key: "Enter" });

    expect(renameCardbook).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(renameCardbook).toHaveBeenCalledWith({ name: "小説メモ", cardbookId: "ws-1" });
    });
  });

  it("左レールのカードブック名変更が失敗してもリネーム状態を終了する", async () => {
    const renameCardbook = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: "CARDBOOK_RENAME_FAILED", message: "カードブック名を変更できませんでした。" }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeCardbook: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          cardTree: [],
          pinnedPaths: [],
          cardbooks: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      renameCardbook
    });

    await renderApp();

    fireEvent.doubleClick(await screen.findByRole("button", { name: "Notes" }));
    const input = await screen.findByLabelText("名前を変更");
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.queryByLabelText("名前を変更")).not.toBeInTheDocument();
    });
  });

  it("左レールのカードブック右クリックメニューから一覧削除する", async () => {
    const removeCardbook = vi.fn().mockResolvedValue({
      ok: true,
      value: { activeCardbook: null, cardTree: [], pinnedPaths: [], cardbooks: [] }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeCardbook: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          cardTree: [],
          pinnedPaths: [],
          cardbooks: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      removeCardbook
    });

    await renderApp();

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Notes" }));
    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Notes を一覧から削除" }));

    expect(removeCardbook).toHaveBeenCalledWith({ cardbookId: "ws-1" });
  });

  it("本文上部のカード名は本文外の表示として出し、直接リネームできる", async () => {
    const renameMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        card: { content: "本文テスト", name: "読書ログ", path: "読書ログ.md" },
        cardbookState: {
          ...withCardbook,
          cardTree: [{ name: "読書ログ", path: "読書ログ.md", type: "card" }]
        }
      }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      }),
      readMarkdownCard: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      }),
      renameMarkdownCard
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));

    const title = await screen.findByText("読書メモ", { selector: ".editor-card-title" });
    expect(title).toBeInTheDocument();
    expect(container.querySelector(".cm-content")).toHaveTextContent("本文テスト");
    expect(container.querySelector(".cm-content")).not.toHaveTextContent("読書メモ");

    fireEvent.click(title);
    fireEvent.change(container.querySelector(".editor-card-title-input") as HTMLInputElement, {
      target: { value: "読書ログ" }
    });
    fireEvent.submit(container.querySelector(".editor-card-title-form") as HTMLFormElement);

    await waitFor(() => {
      expect(renameMarkdownCard).toHaveBeenCalledWith({ newName: "読書ログ", path: "読書メモ.md" });
    });
  });

  it("カードツリーの右クリックメニューからインラインでリネームする", async () => {
    const renameMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        card: { content: "本文テスト", name: "読書ログ", path: "読書ログ.md" },
        cardbookState: {
          ...withCardbook,
          cardTree: [{ name: "読書ログ", path: "読書ログ.md", type: "card" }]
        }
      }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      }),
      renameMarkdownCard
    });

    await renderApp();

    fireEvent.contextMenu(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "名前を変更" }));
    fireEvent.change(screen.getByLabelText("名前を変更"), { target: { value: "読書ログ" } });
    fireEvent.keyDown(screen.getByLabelText("名前を変更"), { key: "Enter" });

    await waitFor(() => {
      expect(renameMarkdownCard).toHaveBeenCalledWith({ newName: "読書ログ", path: "読書メモ.md" });
    });
  });

  it("カードツリーの右クリックメニューからカードを複製する", async () => {
    const duplicateMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        card: { content: "本文テスト", name: "読書メモ のコピー", path: "読書メモ のコピー.md" },
        cardbookState: {
          ...withCardbook,
          cardTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "card" },
            { name: "読書メモ のコピー", path: "読書メモ のコピー.md", type: "card" }
          ]
        }
      }
    });

    window.relic = makeRelicApi({
      duplicateMarkdownCard,
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      })
    });

    await renderApp();

    fireEvent.contextMenu(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "複製" }));

    await waitFor(() => {
      expect(duplicateMarkdownCard).toHaveBeenCalledWith({ path: "読書メモ.md" });
    });
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /読書メモ のコピー/ }).some((button) => (
        button.classList.contains("card-tree-row--appearing")
      ))).toBe(true);
    });
  });

  it("カードツリーの右クリックメニューから開く・ピン留め・パスコピーを実行する", async () => {
    const readMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
    });
    const togglePin = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withCardbook,
        cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }],
        pinnedPaths: ["読書メモ.md"]
      }
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      }),
      readMarkdownCard,
      togglePin
    });

    await renderApp();

    const cardRow = await screen.findByRole("button", { name: /読書メモ/ });
    fireEvent.contextMenu(cardRow);

    expect(await screen.findByRole("menuitem", { name: "開く" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "ピン留め" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "パスをコピー" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "パスをコピー" }));

    expect(writeText).toHaveBeenCalledWith("読書メモ.md");

    fireEvent.contextMenu(cardRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "ピン留め" }));

    await waitFor(() => {
      expect(togglePin).toHaveBeenCalledWith("読書メモ.md");
    });

    fireEvent.contextMenu(cardRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "開く" }));

    await waitFor(() => {
      expect(readMarkdownCard).toHaveBeenCalledWith({ path: "読書メモ.md" });
    });
  });

  it("カードツリーの右クリックメニューから作成・移動・Markdownリンクコピー・場所表示を実行する", async () => {
    const createLinkedMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        card: { content: "", name: "新規メモ", path: "資料/新規メモ.md" },
        cardbookState: {
          ...withCardbook,
          cardTree: [
            {
              children: [{ name: "新規メモ", path: "資料/新規メモ.md", type: "card" }],
              name: "資料",
              path: "資料",
              type: "cardFolder"
            }
          ]
        }
      }
    });
    const createCardFolder = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withCardbook,
        cardTree: [
          {
            children: [
              { children: [], name: "下書き", path: "資料/下書き", type: "cardFolder" },
              { name: "読書メモ", path: "資料/読書メモ.md", type: "card" }
            ],
            name: "資料",
            path: "資料",
            type: "cardFolder"
          }
        ]
      }
    });
    const moveMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        card: { content: "本文", name: "読書メモ", path: "archive/読書メモ.md" },
        cardbookState: withCardbook
      }
    });
    const revealCardbookItem = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    const promptSpy = vi.spyOn(window, "prompt");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    window.relic = makeRelicApi({
      createCardFolder,
      createLinkedMarkdownCard,
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            {
              children: [{ name: "読書メモ", path: "資料/読書メモ.md", type: "card" }],
              name: "資料",
              path: "資料",
              type: "cardFolder"
            }
          ]
        }
      }),
      moveMarkdownCard,
      revealCardbookItem
    });

    await renderApp();

    const cardFolderRow = await screen.findByRole("button", { name: /資料/ });
    promptSpy.mockReturnValueOnce("新規メモ");
    fireEvent.contextMenu(cardFolderRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "ここに新規カード" }));
    await waitFor(() => {
      expect(createLinkedMarkdownCard).toHaveBeenCalledWith({ path: "資料/新規メモ.md" });
    });

    promptSpy.mockReturnValueOnce("下書き");
    fireEvent.contextMenu(cardFolderRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "ここにカードフォルダ作成" }));
    await waitFor(() => {
      expect(createCardFolder).toHaveBeenCalledWith({ name: "下書き", parentCardFolder: "資料" });
    });

    const cardRow = await screen.findByRole("button", { name: /読書メモ/ });
    fireEvent.contextMenu(cardRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Markdownリンクをコピー" }));
    expect(writeText).toHaveBeenCalledWith("[[資料/読書メモ]]");

    fireEvent.contextMenu(cardRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "カードの場所を表示" }));
    await waitFor(() => {
      expect(revealCardbookItem).toHaveBeenCalledWith({ path: "資料/読書メモ.md" });
    });

    promptSpy.mockReturnValueOnce("archive");
    fireEvent.contextMenu(cardRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "移動…" }));
    await waitFor(() => {
      expect(moveMarkdownCard).toHaveBeenCalledWith({
        destinationCardFolder: "archive",
        path: "資料/読書メモ.md"
      });
    });

    promptSpy.mockRestore();
  });

  it("カードツリーの右クリックメニューを画面基準で表示する", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      })
    });

    await renderApp();

    fireEvent.contextMenu(await screen.findByRole("button", { name: /読書メモ/ }), {
      clientX: 490,
      clientY: 1040
    });

    const menu = await screen.findByRole("menu");

    expect(menu).toHaveClass("card-tree-context-menu");
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveStyle({ position: "fixed" });
    expect(Number.parseInt((menu as HTMLElement).style.left, 10)).toBeGreaterThan(0);
    expect(Number.parseInt((menu as HTMLElement).style.top, 10)).toBeGreaterThan(0);
  });

  it("コマンドパレットからアクティブカードを複製する", async () => {
    const duplicateMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        card: { content: "本文テスト", name: "読書メモ のコピー", path: "読書メモ のコピー.md" },
        cardbookState: {
          ...withCardbook,
          cardTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "card" },
            { name: "読書メモ のコピー", path: "読書メモ のコピー.md", type: "card" }
          ]
        }
      }
    });

    window.relic = makeRelicApi({
      duplicateMarkdownCard,
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      }),
      readMarkdownCard: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      })
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.keyDown(window, { key: "P", metaKey: true, shiftKey: true });
    fireEvent.click(await screen.findByText("カードを複製: 読書メモ"));

    await waitFor(() => {
      expect(duplicateMarkdownCard).toHaveBeenCalledWith({ path: "読書メモ.md" });
    });
  });

  it("コマンドパレットを閉じると退場反応を通る", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
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
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
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

  it("コマンドパレットからアクティブカードをゴミ箱に移動する", async () => {
    const moveItemToTrash = vi.fn().mockResolvedValue({ ok: true, value: withCardbook });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      }),
      moveItemToTrash,
      readMarkdownCard: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      })
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.keyDown(window, { key: "P", metaKey: true, shiftKey: true });
    fireEvent.click(await screen.findByText("カードを削除: 読書メモ"));

    await waitFor(() => {
      expect(moveItemToTrash).toHaveBeenCalledWith({ path: "読書メモ.md", type: "card" });
    });
    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("カードとカードフォルダはカードフォルダ行へのドラッグ&ドロップで移動できる", async () => {
    const movedCardbookState = {
      ...withCardbook,
      cardTree: [
        {
          children: [{ name: "note", path: "archive/note.md", type: "card" }],
          name: "archive",
          path: "archive",
          type: "cardFolder"
        },
        { children: [], name: "drafts", path: "drafts", type: "cardFolder" }
      ]
    };
    const moveMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        card: { content: "# Note", name: "note", path: "archive/note.md" },
        cardbookState: movedCardbookState
      }
    });
    const moveCardFolder = vi.fn().mockResolvedValue({ ok: true, value: movedCardbookState });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            { name: "note", path: "note.md", type: "card" },
            { children: [], name: "drafts", path: "drafts", type: "cardFolder" },
            { children: [], name: "archive", path: "archive", type: "cardFolder" }
          ]
        }
      }),
      moveCardFolder,
      moveMarkdownCard
    });

    await renderApp();

    const cardRow = await screen.findByRole("button", { name: /note/ });
    const draftsRow = await screen.findByRole("button", { name: /drafts/ });
    const archiveRow = await screen.findByRole("button", { name: /archive/ });

    fireEvent.dragStart(cardRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });

    expect(cardRow).toHaveClass("dragging");

    fireEvent.drop(archiveRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "card" }) }
    });

    fireEvent.dragEnd(cardRow);

    expect(cardRow).not.toHaveClass("dragging");

    await waitFor(() => {
      expect(moveMarkdownCard).toHaveBeenCalledWith({ destinationCardFolder: "archive", path: "note.md" });
    });

    fireEvent.dragStart(draftsRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });
    fireEvent.drop(archiveRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "drafts", type: "cardFolder" }) }
    });

    await waitFor(() => {
      expect(moveCardFolder).toHaveBeenCalledWith({ destinationCardFolder: "archive", path: "drafts" });
    });
  });

  it("展開済みカードフォルダ内の余白へドロップしても移動しない", async () => {
    const moveMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        card: { content: "# Note", name: "note", path: "archive/note.md" },
        cardbookState: withCardbook
      }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            { name: "note", path: "note.md", type: "card" },
            {
              children: [{ name: "old", path: "archive/old.md", type: "card" }],
              name: "archive",
              path: "archive",
              type: "cardFolder"
            }
          ]
        }
      }),
      moveMarkdownCard
    });

    const { container } = await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const archiveRow = await screen.findByRole("button", { name: /archive/ });
    const archiveTree = archiveRow.closest("li")?.querySelector("ul.card-tree");

    expect(archiveTree).not.toBeNull();

    fireEvent.dragStart(noteRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });
    fireEvent.dragOver(archiveTree ?? container, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "card" }) }
    });

    expect(archiveTree).not.toHaveClass("card-tree--drag-over");

    fireEvent.drop(archiveTree ?? container, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "card" }) }
    });

    expect(moveMarkdownCard).not.toHaveBeenCalled();
  });

  it("カード行へドロップするとそのカードと同じ親カードフォルダへ移動する", async () => {
    const moveMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        card: { content: "# Note", name: "note", path: "archive/note.md" },
        cardbookState: withCardbook
      }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            { name: "note", path: "note.md", type: "card" },
            {
              children: [{ name: "old", path: "archive/old.md", type: "card" }],
              name: "archive",
              path: "archive",
              type: "cardFolder"
            }
          ]
        }
      }),
      moveMarkdownCard
    });

    await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const oldRow = await screen.findByRole("button", { name: /old/ });

    fireEvent.dragStart(noteRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });
    fireEvent.dragOver(oldRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "card" }) }
    });

    expect(oldRow).toHaveClass("drag-over");

    fireEvent.drop(oldRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "card" }) }
    });

    await waitFor(() => {
      expect(moveMarkdownCard).toHaveBeenCalledWith({ destinationCardFolder: "archive", path: "note.md" });
    });
  });

  it("空カードフォルダの内容エリアへドロップしても移動しない", async () => {
    const moveMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        card: { content: "# Note", name: "note", path: "archive/note.md" },
        cardbookState: withCardbook
      }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            { name: "note", path: "note.md", type: "card" },
            { children: [], name: "archive", path: "archive", type: "cardFolder" }
          ]
        }
      }),
      moveMarkdownCard
    });

    const { container } = await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const archiveRow = await screen.findByRole("button", { name: /archive/ });
    const archiveTree = archiveRow.closest("li")?.querySelector("ul.card-tree");

    expect(archiveTree).not.toBeNull();

    fireEvent.dragStart(noteRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });
    fireEvent.dragOver(archiveTree ?? container, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "card" }) }
    });

    expect(archiveTree).not.toHaveClass("card-tree--drag-over");

    fireEvent.drop(archiveTree ?? container, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "card" }) }
    });

    expect(moveMarkdownCard).not.toHaveBeenCalled();
  });

  it("同じ親カードフォルダや子孫カードフォルダへはドラッグ移動しない", async () => {
    const moveCardFolder = vi.fn();
    const moveMarkdownCard = vi.fn();

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            {
              children: [
                { name: "note", path: "archive/note.md", type: "card" },
                {
                  children: [],
                  name: "child",
                  path: "archive/child",
                  type: "cardFolder"
                }
              ],
              name: "archive",
              path: "archive",
              type: "cardFolder"
            }
          ]
        }
      }),
      moveCardFolder,
      moveMarkdownCard
    });

    await renderApp();

    const archiveRow = await screen.findByRole("button", { name: /archive/ });
    const childRow = await screen.findByRole("button", { name: /child/ });

    fireEvent.drop(archiveRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "archive/note.md", type: "card" }) }
    });
    fireEvent.drop(childRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "archive", type: "cardFolder" }) }
    });

    expect(moveMarkdownCard).not.toHaveBeenCalled();
    expect(moveCardFolder).not.toHaveBeenCalled();
  });

  it("カードとカードフォルダを複数選択できる", async () => {
    const readMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "本文", name: "note", path: "note.md" }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            { name: "note", path: "note.md", type: "card" },
            { children: [], name: "drafts", path: "drafts", type: "cardFolder" },
            { children: [], name: "archive", path: "archive", type: "cardFolder" }
          ]
        }
      }),
      readMarkdownCard
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
    expect(screen.getByText("2件選択中")).toBeInTheDocument();

    fireEvent.click(archiveRow, { shiftKey: true });

    expect(noteRow).not.toHaveClass("selected");
    expect(draftsRow).toHaveClass("selected");
    expect(draftsRow).toHaveClass("multi-selected");
    expect(archiveRow).toHaveClass("selected");
    expect(archiveRow).toHaveClass("multi-selected");
    expect(screen.getByText("2件選択中")).toBeInTheDocument();

    fireEvent.click(noteRow);

    expect(readMarkdownCard).not.toHaveBeenCalled();
  });

  it("複数選択したカードとカードフォルダをドラッグ&ドロップでまとめて移動できる", async () => {
    const movedCardbookState = {
      ...withCardbook,
      cardTree: [
        {
          children: [
            { name: "note", path: "archive/note.md", type: "card" },
            { children: [], name: "drafts", path: "archive/drafts", type: "cardFolder" }
          ],
          name: "archive",
          path: "archive",
          type: "cardFolder"
        }
      ]
    };
    const moveMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        card: { content: "# Note", name: "note", path: "archive/note.md" },
        cardbookState: movedCardbookState
      }
    });
    const moveCardFolder = vi.fn().mockResolvedValue({ ok: true, value: movedCardbookState });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            { name: "note", path: "note.md", type: "card" },
            { children: [], name: "drafts", path: "drafts", type: "cardFolder" },
            { children: [], name: "archive", path: "archive", type: "cardFolder" }
          ]
        }
      }),
      moveCardFolder,
      moveMarkdownCard
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
      expect(moveMarkdownCard).toHaveBeenCalledWith({ destinationCardFolder: "archive", path: "note.md" });
    });
    await waitFor(() => {
      expect(moveCardFolder).toHaveBeenCalledWith({ destinationCardFolder: "archive", path: "drafts" });
    });
  });

  it("複数選択したカードとカードフォルダをまとめてゴミ箱に移動できる", async () => {
    const moveItemToTrash = vi.fn().mockResolvedValue({ ok: true, value: withCardbook });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            { name: "note", path: "note.md", type: "card" },
            { children: [], name: "drafts", path: "drafts", type: "cardFolder" }
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

    expect(noteRow).toHaveClass("card-tree-row--removing");

    await waitFor(() => {
      expect(moveItemToTrash).toHaveBeenCalledWith({ path: "note.md", type: "card" });
      expect(moveItemToTrash).toHaveBeenCalledWith({ path: "drafts", type: "cardFolder" });
    });
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("2件"));

    confirmSpy.mockRestore();
  });

  it("カード・カードフォルダをピン留めし、ピン留めセクションに表示して解除できる", async () => {
    const togglePin = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "card" },
            { children: [], name: "資料", path: "資料", type: "cardFolder" }
          ],
          pinnedPaths: ["読書メモ.md", "資料"]
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "card" },
            { children: [], name: "資料", path: "資料", type: "cardFolder" }
          ],
          pinnedPaths: []
        }
      });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "card" },
            { children: [], name: "資料", path: "資料", type: "cardFolder" }
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

  it("設定ビューでフォントサイズを変更すると saveEditorSettings が呼ばれる", async () => {
    const saveEditorSettings = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({ saveEditorSettings });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "設定" }));

    const input = await screen.findByDisplayValue("16");

    fireEvent.change(input, { target: { value: "18" } });

    expect(saveEditorSettings).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 18 })
    );
  });

  it("カードモードの検索方法ボタンで検索方法候補を表示する", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });

    await renderApp();

    fireEvent.focus(await screen.findByLabelText("カード検索"));

    expect(screen.queryByRole("option", { name: "全文" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));

    expect(await screen.findByRole("option", { name: "全文" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "カード名" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "タグ" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "プロパティ" })).toBeInTheDocument();
  });

  it("検索語句を入力すると検索結果を表示し、クリックでカードを開く", async () => {
    const searchCardbook = vi.fn().mockResolvedValue({
      ok: true,
      value: [
        {
          cardName: "読書メモ",
          lineNumber: 3,
          lineText: "一致した行",
          path: "読書メモ.md"
        }
      ]
    });
    const readMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "一致した行", name: "読書メモ", path: "読書メモ.md" }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook }),
      readMarkdownCard,
      searchCardbook
    });

    await renderApp();

    fireEvent.change(await screen.findByLabelText("カード検索"), {
      target: { value: "一致" }
    });

    expect(await screen.findByText("3: 一致した行")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /読書メモ/ }));

    expect(searchCardbook).toHaveBeenCalledWith({ mode: "fullText", query: "一致" });
    expect(searchCardbook.mock.calls.at(-1)?.[0]).toStrictEqual({ mode: "fullText", query: "一致" });
    expect(readMarkdownCard).toHaveBeenCalledWith({ path: "読書メモ.md" });
  });

  it("検索中は読み込み反応を表示する", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook }),
      searchCardbook: vi.fn().mockReturnValue(new Promise(() => undefined))
    });

    await renderApp();

    fireEvent.change(await screen.findByLabelText("カード検索"), {
      target: { value: "draft" }
    });

    const loading = await screen.findByText("読み込んでいます…");
    expect(loading).toHaveClass("list-loading-note");
  });

  it("検索方法でタグを選ぶとタグ検索に切り替える", async () => {
    const searchCardbook = vi.fn().mockResolvedValue({
      ok: true,
      value: [{ cardName: "資料ノート", lineNumber: null, lineText: "#資料", path: "資料ノート.md" }]
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook }),
      searchCardbook
    });

    await renderApp();

    await screen.findByLabelText("カード検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "タグ" }));
    await waitFor(() => {
      expect(screen.queryByRole("option", { name: "タグ" })).not.toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("カード検索"), {
      target: { value: "資料" }
    });

    await waitFor(() => {
      expect(searchCardbook).toHaveBeenCalledWith({ mode: "tag", query: "資料" });
    });
    expect(searchCardbook.mock.calls.at(-1)?.[0]).toStrictEqual({ mode: "tag", query: "資料" });
    expect((await screen.findAllByText("#資料")).length).toBeGreaterThan(0);
  });

  it("検索方法でカード名を選ぶとカード名検索に切り替える", async () => {
    const searchCardbook = vi.fn().mockResolvedValue({
      ok: true,
      value: [{ cardName: "読書メモ", lineNumber: null, lineText: "読書メモ.md", path: "読書メモ.md" }]
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook }),
      searchCardbook
    });

    await renderApp();

    await screen.findByLabelText("カード検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "カード名" }));
    fireEvent.change(screen.getByLabelText("カード検索"), {
      target: { value: "読書" }
    });

    await waitFor(() => {
      expect(searchCardbook).toHaveBeenCalledWith({ mode: "cardName", query: "読書" });
    });
    expect(searchCardbook.mock.calls.at(-1)?.[0]).toStrictEqual({ mode: "cardName", query: "読書" });
    expect(await screen.findByText("読書メモ.md")).toBeInTheDocument();
  });

  it("検索方法で正規表現を選ぶと正規表現検索に切り替える", async () => {
    const searchCardbook = vi.fn().mockResolvedValue({
      ok: true,
      value: [{ cardName: "読書メモ", lineNumber: 1, lineText: "# 読書メモ", path: "読書メモ.md" }]
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook }),
      searchCardbook
    });

    await renderApp();

    await screen.findByLabelText("カード検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "正規表現" }));
    fireEvent.change(screen.getByLabelText("カード検索"), {
      target: { value: "^# " }
    });

    await waitFor(() => {
      expect(searchCardbook).toHaveBeenCalledWith({ mode: "regex", query: "^# " });
    });
    expect(await screen.findByText("1: # 読書メモ")).toBeInTheDocument();
  });

  it("無効な正規表現の検索エラーを表示する", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook }),
      searchCardbook: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "SEARCH_REGEX_INVALID", message: "正規表現が正しくありません。" }
      })
    });

    await renderApp();

    await screen.findByLabelText("カード検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "正規表現" }));
    fireEvent.change(screen.getByLabelText("カード検索"), {
      target: { value: "[" }
    });

    expect(await screen.findByText("正規表現が正しくありません。")).toBeInTheDocument();
  });

  it("トーストを閉じると退場反応を通る", async () => {
    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook }),
      createMarkdownCard: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "CREATE_FAILED", message: "カードを作成できませんでした。" }
      })
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "新規カード" }));

    const toast = await screen.findByText("カードを作成できませんでした。");
    expect(toast).toBeInstanceOf(HTMLElement);
    fireEvent.click(toast);

    expect(toast).toHaveClass("toast--closing");
  });

  it("プロパティ検索で field と値を渡す", async () => {
    const searchCardbook = vi.fn().mockResolvedValue({
      ok: true,
      value: [{ cardName: "読書メモ", lineNumber: null, lineText: "status: draft", path: "読書メモ.md" }]
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
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook }),
      searchCardbook
    });

    await renderApp();

    await screen.findByLabelText("カード検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "プロパティ" }));
    expect(screen.getByRole("option", { name: "reviewer" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "date" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("プロパティ名"), {
      target: { value: "status" }
    });
    fireEvent.change(screen.getByLabelText("カード検索"), {
      target: { value: "draft" }
    });

    await waitFor(() => {
      expect(searchCardbook).toHaveBeenCalledWith({
        frontmatterField: "status",
        mode: "frontmatter",
        query: "draft"
      });
    });
    expect(await screen.findByText("status: draft")).toBeInTheDocument();
  });

  it("右パネルにアウトゴーイングリンクを表示する", async () => {
    const readMarkdownCard = vi.fn(({ path }: { path: string }) => Promise.resolve({
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
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [{ name: "読書メモ", path: "読書メモ.md", type: "card" }]
        }
      }),
      readMarkdownCard
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(screen.getByRole("button", { name: "リンク" }));

    expect(await screen.findByText("アウトゴーイング")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "表示名" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("埋め込み").length).toBeGreaterThan(0);
  });

  it("右パネルのリンクを右クリックしてコピーと場所表示を実行する", async () => {
    const revealCardbookItem = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    window.relic = makeRelicApi({
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "card" },
            { name: "参照先", path: "参照先.md", type: "card" }
          ]
        }
      }),
      readMarkdownCard: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "[[参照先|表示名]]", name: "読書メモ", path: "読書メモ.md" }
      }),
      revealCardbookItem
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
    fireEvent.click(await screen.findByRole("menuitem", { name: "カードの場所を表示" }));
    await waitFor(() => {
      expect(revealCardbookItem).toHaveBeenCalledWith({ path: "参照先.md" });
    });
  });

  it("右パネルにバックリンクを表示し、クリックすると参照元を開く", async () => {
    const readMarkdownCard = vi.fn(({ path }: { path: string }) => Promise.resolve({
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
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            { name: "target", path: "target.md", type: "card" },
            { name: "source", path: "source.md", type: "card" }
          ]
        }
      }),
      readMarkdownCard
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /target/ }));
    fireEvent.click(screen.getByRole("button", { name: "リンク" }));

    expect(await screen.findByText("バックリンク")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "source" }));

    expect(readMarkdownCard).toHaveBeenCalledWith({ path: "source.md" });
  });

  it("未作成リンクをクリックすると同じカードフォルダにカードを作成して開く", async () => {
    const readMarkdownCard = vi.fn(({ path }: { path: string }) => Promise.resolve(
      path === "cardFolder/読書メモ.md"
        ? {
            ok: true as const,
            value: { content: "[[新規ノート]]", name: "読書メモ", path: "cardFolder/読書メモ.md" }
          }
        : {
            ok: false as const,
            error: { code: "FILE_READ_FAILED", message: "カードを読み込めませんでした。" }
          }
    ));
    const createLinkedMarkdownCard = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        card: { content: "", name: "新規ノート", path: "cardFolder/新規ノート.md" },
        cardbookState: {
          ...withCardbook,
          cardTree: [
            {
              children: [
                { name: "読書メモ", path: "cardFolder/読書メモ.md", type: "card" },
                { name: "新規ノート", path: "cardFolder/新規ノート.md", type: "card" }
              ],
              name: "cardFolder",
              path: "cardFolder",
              type: "cardFolder"
            }
          ]
        }
      }
    });

    window.relic = makeRelicApi({
      createLinkedMarkdownCard,
      getCardbookState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withCardbook,
          cardTree: [
            {
              children: [{ name: "読書メモ", path: "cardFolder/読書メモ.md", type: "card" }],
              name: "cardFolder",
              path: "cardFolder",
              type: "cardFolder"
            }
          ]
        }
      }),
      readMarkdownCard
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(screen.getByRole("button", { name: "リンク" }));
    fireEvent.click(await screen.findByRole("button", { name: "新規ノート" }));

    await waitFor(() => {
      expect(createLinkedMarkdownCard).toHaveBeenCalledWith({ path: "cardFolder/新規ノート.md" });
    });
    expect((await screen.findAllByText("新規ノート")).length).toBeGreaterThan(0);
  });

  it("機能トグル tools=false でナビから Tools ビューが非表示になる", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: { ...defaultFeatureToggles, tools: false } }),
      getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: withCardbook })
    });

    await renderApp();

    await screen.findByRole("button", { name: "カード" });
    expect(screen.queryByRole("button", { name: "ツール" })).toBeNull();
  });
});
