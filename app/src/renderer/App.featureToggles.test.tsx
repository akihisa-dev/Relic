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

  it("年表は右パネルに常設し、暦設定のナビを表示しない", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...defaultFeatureToggles,
          chronicle: false,
          chronicleSettings: false
        }
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    await screen.findByRole("button", { name: "ファイル" });
    expect(screen.getByRole("button", { name: "年表" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "暦設定" })).toBeNull();
  });
});
