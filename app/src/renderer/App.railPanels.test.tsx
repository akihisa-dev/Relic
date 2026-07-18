import { fireEvent, screen, within } from "@testing-library/react";
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
  allRailFeatureToggles,
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

describe("App rail panels", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("右パネルのアウトラインとリンクを常に利用できる", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    expect(container.querySelector(".right-panel")).not.toHaveClass("right-panel--closed");

    expect(screen.getByRole("button", { name: "アウトライン" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "リンク" })).toBeInTheDocument();
    expect(container.querySelector(".title-bar .main-area-actions")).toBeInTheDocument();
    expect(container.querySelector(".main-area > .main-area-actions")).not.toBeInTheDocument();
    expect(container.querySelector(".right-panel")).not.toHaveClass("right-panel--closed");

    fireEvent.keyDown(window, { key: "B", metaKey: true, shiftKey: true });

    expect(container.querySelector(".right-panel")).toHaveClass("right-panel--closed");
  });

  it("右パネル幅のドラッグ変更を最小220px・最大520pxに制限する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    const rightPanel = container.querySelector(".right-panel");
    const resizeHandle = container.querySelector(".layout-resize-boundary--right-panel");

    expect(rightPanel).toBeInstanceOf(HTMLElement);
    expect(resizeHandle).toBeInstanceOf(HTMLElement);

    fireEvent.mouseDown(resizeHandle as HTMLElement, { clientX: 500 });

    expect(rightPanel).toHaveClass("right-panel--resizing");
    expect(resizeHandle).toHaveClass("layout-resize-boundary--active");

    fireEvent.mouseMove(document, { clientX: -100 });

    expect(rightPanel).toHaveStyle({ width: "520px" });

    fireEvent.mouseUp(document);

    expect(rightPanel).not.toHaveClass("right-panel--resizing");
    expect(resizeHandle).not.toHaveClass("layout-resize-boundary--active");

    fireEvent.mouseDown(resizeHandle as HTMLElement, { clientX: 200 });
    fireEvent.mouseMove(document, { clientX: 900 });

    expect(rightPanel).toHaveStyle({ width: "220px" });

    fireEvent.mouseUp(document);
  });

  it("レールのテーブルボタンからフロントマター設定を統合したテーブルを開ける", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: allRailFeatureToggles }),
      getWorkspaceFrontmatterCategoryChoices: vi.fn().mockResolvedValue({
        ok: true,
        value: ["draft", "done"]
      }),
      getWorkspaceTable: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          availableProperties: ["category"],
          rows: [{
            frontmatterStatus: "valid",
            name: "Note",
            path: "Note.md",
            properties: { category: { kind: "string", text: "draft" } }
          }],
          selectedProperties: ["category"]
        }
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    const rail = container.querySelector(".rail");
    if (!(rail instanceof HTMLElement)) throw new Error("rail was not rendered");
    const tableButton = within(rail).getByRole("button", { name: "テーブル" });
    expect(within(rail).queryByRole("button", { name: "フロントマター" })).not.toBeInTheDocument();

    fireEvent.click(tableButton);

    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    expect(activeTabId).toBe("chart-table");
    expect(useEditorStore.getState().tabs[activeTabId!]).toMatchObject({
      chartId: "table",
      kind: "chart"
    });
    expect(document.querySelector('.pane-tab[data-tab-id="chart-table"] .pane-tab-icon svg')).toBeInTheDocument();
    expect(tableButton).toHaveClass("active");
    expect(await screen.findByText("1件のファイル")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "categoryの設定" }));
    expect((await screen.findAllByText("draft")).length).toBeGreaterThan(1);

    fireEvent.click(tableButton);

    expect(document.querySelector(".rail-tab-flight--close")).not.toBeInTheDocument();
    expect(useEditorStore.getState().leftPane.activeTabId).toBe("chart-table");
    expect(useEditorStore.getState().tabs["chart-table"]).toBeDefined();
  });

});
