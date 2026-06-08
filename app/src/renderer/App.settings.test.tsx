import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings } from "../shared/ipc";
import {
  installMatchMediaMock,
  makeRelicApi,
  resetRendererStores
} from "../test/rendererTestUtils";
import {
  renderApp,
  restoreNavigatorPlatform,
  setNavigatorPlatform
} from "./appTestHelpers";
import { appFontFamilyMap } from "./appFont";

describe("App settings", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("設定ビューでフォントサイズを変更すると saveEditorSettings が呼ばれる", async () => {
    const saveEditorSettings = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({ saveEditorSettings });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: /^(設定|Settings)$/ }));

    const input = await screen.findByDisplayValue("16");

    fireEvent.change(input, { target: { value: "18" } });

    expect(saveEditorSettings).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 18 })
    );
  });

  it("設定フォントをアプリ全体の文字用CSS変数へ反映する", async () => {
    window.relic = makeRelicApi({
      getEditorSettings: vi.fn().mockResolvedValue({
        ok: true,
        value: { ...defaultEditorSettings, font: "mono", language: "ja" }
      })
    });

    await renderApp();

    await waitFor(() => {
      const shell = document.querySelector<HTMLElement>(".app-shell");

      expect(shell).not.toBeNull();
      expect(shell?.style.fontFamily).toBe(appFontFamilyMap.mono);
      expect(shell?.style.getPropertyValue("--font-body")).toBe(appFontFamilyMap.mono);
      expect(shell?.style.getPropertyValue("--font-display")).toBe(appFontFamilyMap.mono);
      expect(shell?.style.getPropertyValue("--font-mono")).toBe(appFontFamilyMap.mono);
    });
  });
});
