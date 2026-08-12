import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./components/SphereView", () => ({
  SphereView: () => null
}));

vi.mock("./hooks/appTabLazyViews", async (importOriginal) => {
  const original = await importOriginal<typeof import("./hooks/appTabLazyViews")>();
  const { TableView } = await import("./components/TableView");
  return { ...original, LazyTableView: TableView };
});

import { defaultWorkspaceTablePreferences } from "../shared/ipc";
import {
  installMatchMediaMock,
  makeRelicApi,
  resetRendererStores,
  testWorkspaceState as withWorkspace
} from "../test/rendererTestUtils";
import {
  renderApp,
  restoreNavigatorPlatform,
  setNavigatorPlatform
} from "./appTestHelpers";

describe("App rail views", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("主要ビューの入口を常に表示する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    await screen.findByRole("button", { name: "ファイル" });
    for (const name of ["カード", "テーブル", "バブル", "スフィア", "クロニクル", "設定"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("左レールから統合テーブルビューを開く", async () => {
    const getWorkspaceTable = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        availableProperties: [],
        rows: [{ frontmatterStatus: "none", name: "メモ", path: "メモ.md", properties: {} }],
        preferences: defaultWorkspaceTablePreferences
      }
    });
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      getWorkspaceTable
    });

    await renderApp();

    const tableButton = await screen.findByRole("button", { name: "テーブル" });
    expect(screen.queryByRole("button", { name: "フロントマター" })).not.toBeInTheDocument();
    fireEvent.click(tableButton);
    expect(await screen.findByText("1件")).toBeInTheDocument();
    expect(getWorkspaceTable).toHaveBeenCalledOnce();
  });
});
