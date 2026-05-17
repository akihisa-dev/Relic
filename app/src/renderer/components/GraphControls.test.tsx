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

  it("フィルタsectionを開くと検索入力、folder/tag/link条件を表示する", async () => {
    renderGraphControls();

    await waitFor(() => {
      expect(window.relic?.getWorkspaceGraph).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByTitle("展開"));
    fireEvent.click(screen.getByRole("button", { name: /フィルタ/ }));

    expect(screen.getByPlaceholderText("ファイル名・パス")).toBeInTheDocument();
    expect(screen.getByLabelText("フォルダ")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "folder" })).toBeInTheDocument();
    expect(screen.getByLabelText("タグ")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "資料" })).toBeInTheDocument();
    expect(screen.getByLabelText("リンク")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "リンクあり" })).toBeInTheDocument();
  });

  it("初期表示は閉じた状態で、展開と最小化を既存文言で切り替える", () => {
    renderGraphControls();

    expect(screen.getByTitle("展開")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展開" }).querySelector("svg")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("展開"));

    expect(screen.getByTitle("最小化")).toBeInTheDocument();
  });

  it("再読み込みボタンでgraph読込を再実行する", async () => {
    renderGraphControls();

    await waitFor(() => {
      expect(window.relic?.getWorkspaceGraph).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByTitle("展開"));
    fireEvent.click(screen.getByTitle("再読み込み"));

    await waitFor(() => {
      expect(window.relic?.getWorkspaceGraph).toHaveBeenCalledTimes(2);
    });
  });
});
