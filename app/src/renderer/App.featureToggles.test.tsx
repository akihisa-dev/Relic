import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultFeatureToggles, defaultWorkspaceTablePreferences } from "../shared/ipc";
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

describe("App feature toggles", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("機能トグル tools=false でナビから Tools ビューが非表示になる", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: { ...defaultFeatureToggles, tools: false } }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    await screen.findByRole("button", { name: "ファイル" });
    expect(screen.queryByRole("button", { name: "ツール" })).toBeNull();
  });

  it("機能トグルでクロニクルビューのナビを非表示にする", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...defaultFeatureToggles,
          chronicle: false
        }
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    await screen.findByRole("button", { name: "ファイル" });
    expect(screen.queryByRole("button", { name: "クロニクル" })).toBeNull();
  });

  it("機能トグルでバブルのナビを非表示にし、ファイルと設定は残す", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({
        ok: true,
        value: { ...defaultFeatureToggles, graph: false }
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    await screen.findByRole("button", { name: "ファイル" });
    expect(screen.queryByRole("button", { name: "バブル" })).toBeNull();
    expect(screen.getByRole("button", { name: "設定" })).toBeInTheDocument();
  });

  it("機能トグルでカードのナビを非表示にする", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({
        ok: true,
        value: { ...defaultFeatureToggles, cards: false }
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    await screen.findByRole("button", { name: "ファイル" });
    expect(screen.queryByRole("button", { name: "カード" })).toBeNull();
  });

  it("テーブル機能が有効な場合だけ左レールから統合テーブルビューを開く", async () => {
    const getWorkspaceTable = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        availableProperties: [],
        rows: [{ frontmatterStatus: "none", name: "メモ", path: "メモ.md", properties: {} }],
        preferences: defaultWorkspaceTablePreferences
      }
    });
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({
        ok: true,
        value: { ...defaultFeatureToggles, table: true }
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      getWorkspaceTable
    });

    await renderApp();

    const tableButton = await screen.findByRole("button", { name: "テーブル" });
    expect(screen.queryByRole("button", { name: "フロントマター" })).not.toBeInTheDocument();
    fireEvent.click(tableButton);
    expect(await screen.findByText("1 / 1件")).toBeInTheDocument();
    expect(getWorkspaceTable).toHaveBeenCalledOnce();
  });
});
