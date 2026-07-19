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
import { resolveAppFontFamily } from "./appFont";

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

  it("ステータスバーで表示言語を切り替えると saveEditorSettings が呼ばれる", async () => {
    const saveEditorSettings = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({ saveEditorSettings });

    await renderApp();

    fireEvent.click(await screen.findByRole("checkbox", { name: "英語に切り替える" }));

    expect(saveEditorSettings).toHaveBeenCalledWith(
      expect.objectContaining({ language: "en" })
    );
  });

  it("表示言語を切り替えると選択中のプリセットを対応言語のフォントへ切り替える", async () => {
    const saveEditorSettings = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({
      getEditorSettings: vi.fn().mockResolvedValue({
        ok: true,
        value: { ...defaultEditorSettings, font: "mincho", language: "ja" }
      }),
      saveEditorSettings
    });

    await renderApp();

    const shell = document.querySelector<HTMLElement>(".app-shell");
    await waitFor(() => expect(shell?.style.fontFamily).toBe(resolveAppFontFamily("mincho", "ja")));

    fireEvent.click(await screen.findByRole("checkbox", { name: "英語に切り替える" }));

    await waitFor(() => expect(shell?.style.fontFamily).toBe(resolveAppFontFamily("mincho", "en")));
    expect(saveEditorSettings).toHaveBeenCalledWith(
      expect.objectContaining({ font: "mincho", language: "en" })
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
      const fontFamily = resolveAppFontFamily("mono", "ja");

      expect(shell).not.toBeNull();
      expect(shell?.style.fontFamily).toBe(fontFamily);
      expect(shell?.style.getPropertyValue("--font-body")).toBe(fontFamily);
      expect(shell?.style.getPropertyValue("--font-display")).toBe(fontFamily);
      expect(shell?.style.getPropertyValue("--font-mono")).toBe(fontFamily);
    });
  });
});
