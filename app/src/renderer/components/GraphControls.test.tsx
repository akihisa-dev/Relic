import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { useGraphStore } from "../store/graphStore";
import { GraphControls } from "./GraphControls";

function resetGraphStore(): void {
  useGraphStore.setState({
    centerForce: 1,
    error: null,
    folderFilter: "",
    graph: null,
    groups: [],
    isLoading: false,
    layoutMode: "standard",
    linkDistance: 118,
    linkFilter: "all",
    linkForce: 1,
    linkThickness: 1,
    loadedWorkspaceId: null,
    localGraphDepth: 0,
    minDegree: 0,
    nodeSize: 1,
    query: "",
    repelForce: 1,
    selectedPath: null,
    showArrows: false,
    showLabels: true,
    showOrphans: true,
    tagFilter: "",
    textFadeThreshold: 0.85,
    zoom: 1
  });
}

function renderGraphControls(workspaceId = "workspace-1"): void {
  render(
    <I18nProvider language="ja">
      <GraphControls workspaceId={workspaceId} />
    </I18nProvider>
  );
}

describe("GraphControls", () => {
  beforeEach(() => {
    resetGraphStore();
    window.relic = {
      getWorkspaceGraph: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          edges: [{ sourcePath: "A.md", targetPath: "folder/B.md" }],
          nodes: [
            { folder: "", name: "A", path: "A.md", tags: ["資料"] },
            { folder: "folder", name: "B", path: "folder/B.md", tags: [] }
          ]
        }
      })
    } as unknown as typeof window.relic;
  });

  it("workspaceIdありでgraph読込を呼ぶ", async () => {
    renderGraphControls();

    await waitFor(() => {
      expect(window.relic?.getWorkspaceGraph).toHaveBeenCalledTimes(1);
    });
  });

  it("初期表示でObsidian風の検索とfilter toggleを表示する", async () => {
    renderGraphControls();

    await waitFor(() => {
      expect(window.relic?.getWorkspaceGraph).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByPlaceholderText("ファイル名・パス")).toBeInTheDocument();
    expect(screen.getByLabelText("タグ")).toBeDisabled();
    expect(screen.getByLabelText("添付書類")).toBeDisabled();
    expect(screen.getByLabelText("存在するファイルのみ表示")).toBeDisabled();
    expect(screen.getByLabelText("オーファン")).toBeChecked();
  });

  it("初期表示は開いた状態で、最小化と展開を既存文言で切り替える", () => {
    renderGraphControls();

    expect(screen.getByTitle("最小化")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("最小化"));

    expect(screen.getByTitle("展開")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展開" }).querySelector("svg")).toBeInTheDocument();
  });

  it("リセットボタンでgraph設定を初期化する", async () => {
    useGraphStore.setState({ minDegree: 4, query: "A", showOrphans: false });
    renderGraphControls();

    await waitFor(() => {
      expect(window.relic?.getWorkspaceGraph).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByTitle("リセット"));

    expect(useGraphStore.getState()).toMatchObject({
      minDegree: 0,
      query: "",
      showOrphans: true
    });
  });
});
