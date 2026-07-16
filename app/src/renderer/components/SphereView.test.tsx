import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { I18nProvider } from "../i18n";
import { disposeParkedSphereRuntime, SphereView } from "./SphereView";

const runtimeMocks = vi.hoisted(() => ({
  callbacks: null as null | Record<string, (...args: any[]) => void>,
  createSphereRuntime: vi.fn(),
  dispose: vi.fn(),
  attach: vi.fn(),
  setCallbacks: vi.fn(),
  setData: vi.fn(),
  setFocus: vi.fn(),
  setTheme: vi.fn(),
  suspend: vi.fn()
}));

vi.mock("../sphere/sphereRuntime", () => ({
  createSphereRuntime: (...args: any[]) => runtimeMocks.createSphereRuntime(...args)
}));

function renderSphereView(language: "en" | "ja" = "ja") {
  const onOpenFile = vi.fn();
  const onOpenTagSearch = vi.fn();
  window.relic = makeRelicApi({
    getWorkspaceGraph: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        links: [{ count: 1, source: "A.md", target: "B.md", type: "link" }],
        nodes: [
          { backlinkCount: 0, exists: true, id: "A.md", label: "A", linkCount: 1, path: "A.md", type: "file" },
          { backlinkCount: 1, exists: true, id: "B.md", label: "B", linkCount: 0, path: "B.md", type: "file" }
        ]
      }
    })
  });
  runtimeMocks.createSphereRuntime.mockImplementation((_host, callbacks) => {
    runtimeMocks.callbacks = callbacks;
    return {
      attach: runtimeMocks.attach,
      dispose: runtimeMocks.dispose,
      setCallbacks: runtimeMocks.setCallbacks,
      setData: runtimeMocks.setData,
      setFocus: runtimeMocks.setFocus,
      setTheme: runtimeMocks.setTheme,
      suspend: runtimeMocks.suspend
    };
  });

  const result = render(
    <I18nProvider language={language}>
      <SphereView onOpenFile={onOpenFile} onOpenTagSearch={onOpenTagSearch} />
    </I18nProvider>
  );
  return { ...result, onOpenFile, onOpenTagSearch };
}

afterEach(() => {
  cleanup();
  disposeParkedSphereRuntime();
  runtimeMocks.callbacks = null;
  vi.clearAllMocks();
});

describe("SphereView", () => {
  it("独立したスフィアビューへ共有グラフのノードとリンクを渡す", async () => {
    renderSphereView();

    expect(screen.queryByText("試験機能")).not.toBeInTheDocument();
    await waitFor(() => expect(runtimeMocks.setData.mock.calls.at(-1)?.[0].nodes).toHaveLength(2));
    const latestData = runtimeMocks.setData.mock.calls.at(-1)?.[0];
    expect(latestData.nodes.map((node: { id: string }) => node.id)).toEqual(["A.md", "B.md"]);
    expect(latestData.links).toHaveLength(1);
    expect(runtimeMocks.setData).toHaveBeenCalledTimes(2);
    expect(runtimeMocks.setTheme).toHaveBeenCalled();
    expect(screen.getByText("2件のノード")).toBeInTheDocument();
  });

  it("ホバー・固定強調・ファイル表示を3D runtimeから接続する", async () => {
    const { onOpenFile } = renderSphereView();
    await waitFor(() => expect(runtimeMocks.callbacks).not.toBeNull());
    const node = {
      backlinkCount: 0,
      baseColor: "#ffffff",
      exists: true,
      id: "A.md",
      label: "A",
      linkCount: 1,
      path: "A.md",
      type: "file",
      val: 4
    };

    act(() => runtimeMocks.callbacks?.onNodeHover(node));
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(runtimeMocks.setFocus).toHaveBeenLastCalledWith("A.md");

    act(() => runtimeMocks.callbacks?.onNodeFocus(node));
    act(() => runtimeMocks.callbacks?.onNodeHover(null));
    expect(runtimeMocks.setFocus).toHaveBeenLastCalledWith("A.md");

    act(() => runtimeMocks.callbacks?.onNodeActivate(node));
    expect(onOpenFile).toHaveBeenCalledWith("A.md");
  });

  it("WebGL停止をスフィア内のエラーに限定してruntimeを破棄する", async () => {
    renderSphereView();
    await waitFor(() => expect(runtimeMocks.callbacks).not.toBeNull());

    act(() => runtimeMocks.callbacks?.onContextLost());

    expect(runtimeMocks.dispose).toHaveBeenCalled();
    expect(screen.getByText("3D描画が停止しました。2Dのグラフは引き続き利用できます。")).toBeInTheDocument();
  });

  it("短時間の再表示では停止中のruntimeを再利用する", async () => {
    const first = renderSphereView();
    await waitFor(() => expect(runtimeMocks.createSphereRuntime).toHaveBeenCalledTimes(1));

    first.unmount();
    expect(runtimeMocks.suspend).toHaveBeenCalledTimes(1);

    const second = renderSphereView();
    await waitFor(() => expect(runtimeMocks.attach).toHaveBeenCalledTimes(1));

    expect(runtimeMocks.createSphereRuntime).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.setCallbacks).toHaveBeenCalledTimes(1);
    second.unmount();
  });
});
