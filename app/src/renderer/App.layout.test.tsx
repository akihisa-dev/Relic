import { fireEvent, screen, waitFor } from "@testing-library/react";
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
  resetRendererStores
} from "../test/rendererTestUtils";

describe("App layout", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("ビュー切り替えナビとメインエリアが表示される", async () => {
    window.relic = makeRelicApi();

    await renderApp();

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(await screen.findByText("書く場所を選ぶ")).toBeInTheDocument();
  });

  it("Windowsでもタイトルバーからテーマを切り替えて保存する", async () => {
    setNavigatorPlatform("Win32");
    const saveEditorSettings = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    window.relic = makeRelicApi({ saveEditorSettings });

    await renderApp();

    const toggle = await screen.findByRole("checkbox", { name: "ダークテーマに切り替える" });
    fireEvent.click(toggle);

    expect(saveEditorSettings).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark" }));
    await waitFor(() => expect(toggle).toBeChecked());
    expect(toggle).toHaveAccessibleName("ライトテーマに切り替える");
  });
});
