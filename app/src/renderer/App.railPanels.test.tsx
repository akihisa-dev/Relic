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

  it("機能トグルで右パネル項目を個別にOFFにできる", async () => {
    const saveFeatureToggles = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      saveFeatureToggles
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    expect(container.querySelector(".right-panel")).not.toHaveClass("right-panel--closed");

    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    fireEvent.click(await screen.findByLabelText("右パネル: アウトライン"));

    expect(saveFeatureToggles).toHaveBeenCalledWith(expect.objectContaining({ rightPanelOutline: false }));
    expect(screen.queryByRole("button", { name: "アウトライン" })).toBeNull();
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

  it("レールのフロントマターボタンから専用設定を開ける", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: allRailFeatureToggles }),
      getUserDefinedFields: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ name: "category", type: "select", choices: ["draft", "done"] }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    const rail = container.querySelector(".rail");
    if (!(rail instanceof HTMLElement)) throw new Error("rail was not rendered");
    const frontmatterButton = within(rail).getByRole("button", { name: "フロントマター" });

    fireEvent.click(frontmatterButton);

    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    expect(activeTabId).toBe("panel-frontmatter");
    expect(useEditorStore.getState().tabs[activeTabId!]).toMatchObject({
      kind: "panel",
      panel: "frontmatter"
    });
    expect(document.querySelector('.pane-tab[data-tab-id="panel-frontmatter"] .pane-tab-icon svg')).toBeInTheDocument();
    expect(frontmatterButton).toHaveClass("active");
    expect(screen.getByText("フロントマター設定")).toBeInTheDocument();
    expect(screen.getByDisplayValue("category")).toBeInTheDocument();

    fireEvent.click(frontmatterButton);

    expect(document.querySelector(".rail-tab-flight--close")).not.toBeInTheDocument();
    expect(useEditorStore.getState().leftPane.activeTabId).toBe("panel-frontmatter");
    expect(useEditorStore.getState().tabs["panel-frontmatter"]).toBeDefined();
  });

  it("レールの暦設定ボタンから専用設定を開ける", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: allRailFeatureToggles }),
      getWorkspaceChronicleCalendars: vi.fn().mockResolvedValue({
        ok: true,
        value: [
          { id: "chronicle0", name: "王国暦" },
          { id: "chronicle1", name: "帝国暦", startYear: 100 }
        ]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "暦設定" }));

    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    expect(activeTabId).toBe("panel-chronicleSettings");
    expect(useEditorStore.getState().tabs[activeTabId!]).toMatchObject({
      kind: "panel",
      panel: "chronicleSettings"
    });
    expect(screen.getByRole("button", { name: "暦設定" })).toHaveClass("active");
    expect(screen.getByDisplayValue("王国暦")).toBeInTheDocument();
    expect(screen.getByDisplayValue("帝国暦")).toBeInTheDocument();
    expect(screen.getByText("帝国暦1年 = 王国暦100年")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "暦設定" }));

    expect(useEditorStore.getState().leftPane.activeTabId).toBe("panel-chronicleSettings");
    expect(useEditorStore.getState().tabs["panel-chronicleSettings"]).toBeDefined();
  });
});
