import { screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultFeatureToggles } from "../shared/ipc";
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
    expect(screen.queryByRole("button", { name: "暦設定" })).toBeNull();
  });

  it("機能トグルでグラフのナビを非表示にし、ファイルと設定は残す", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({
        ok: true,
        value: { ...defaultFeatureToggles, graph: false }
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    await screen.findByRole("button", { name: "ファイル" });
    expect(screen.queryByRole("button", { name: "グラフ" })).toBeNull();
    expect(screen.getByRole("button", { name: "設定" })).toBeInTheDocument();
  });
});
