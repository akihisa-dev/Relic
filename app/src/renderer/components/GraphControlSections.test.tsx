import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { useGraphStore } from "../store/graphStore";
import {
  GraphDisplaySection,
  GraphFilterSection,
  GraphForcesSection,
  GraphGroupsSection
} from "./GraphControlSections";

function resetGraphStore(): void {
  useGraphStore.setState({
    centerForce: 1,
    error: null,
    folderFilter: "",
    graph: {
      edges: [{ sourcePath: "A.md", targetPath: "folder/B.md" }],
      nodes: [
        { folder: "", name: "A", path: "A.md", tags: ["資料"] },
        { folder: "folder", name: "B", path: "folder/B.md", tags: ["作業"] }
      ]
    },
    groups: [],
    isLoading: false,
    linkDistance: 118,
    linkFilter: "all",
    linkForce: 1,
    linkThickness: 1,
    loadedWorkspaceId: "workspace-1",
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

function renderSection(section: ReactElement): void {
  render(
    <I18nProvider language="ja">
      {section}
    </I18nProvider>
  );
}

describe("GraphControlSections", () => {
  beforeEach(() => {
    resetGraphStore();
  });

  it("filter sectionは検索、folder/tag/link、minDegree、localDepthを表示してstoreを更新する", () => {
    renderSection(<GraphFilterSection isOpen onToggle={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("ファイル名・パス"), { target: { value: "Alpha" } });
    fireEvent.change(screen.getByLabelText("フォルダ"), { target: { value: "folder" } });
    fireEvent.change(screen.getByLabelText("タグ"), { target: { value: "作業" } });
    fireEvent.change(screen.getByLabelText("リンク"), { target: { value: "linked" } });
    fireEvent.change(screen.getByLabelText("最小リンク数"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("ローカル深さ"), { target: { value: "1" } });

    expect(screen.getByRole("option", { name: "folder" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "作業" })).toBeInTheDocument();
    expect(useGraphStore.getState()).toMatchObject({
      folderFilter: "folder",
      linkFilter: "linked",
      localGraphDepth: 1,
      minDegree: 2,
      query: "Alpha",
      tagFilter: "作業"
    });
  });

  it("groups sectionで追加、query/color更新、削除ができる", async () => {
    renderSection(<GraphGroupsSection isOpen onToggle={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "グループを追加" }));

    await waitFor(() => {
      expect(screen.getByLabelText("検索条件")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("検索条件"), { target: { value: "#資料" } });
    fireEvent.change(screen.getByLabelText("色"), { target: { value: "#123456" } });

    expect(useGraphStore.getState().groups[0]).toMatchObject({
      color: "#123456",
      query: "#資料"
    });

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => {
      expect(useGraphStore.getState().groups).toHaveLength(0);
    });
  });

  it("display sectionで表示設定をstoreへ反映する", () => {
    renderSection(<GraphDisplaySection isOpen onToggle={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("ズーム"), { target: { value: "1.5" } });
    fireEvent.change(screen.getByLabelText("ノードサイズ"), { target: { value: "1.4" } });
    fireEvent.change(screen.getByLabelText("リンク太さ"), { target: { value: "1.7" } });
    fireEvent.change(screen.getByLabelText("ラベルフェード"), { target: { value: "1.2" } });
    fireEvent.click(screen.getByLabelText("ラベル"));
    fireEvent.click(screen.getByLabelText("矢印"));
    fireEvent.click(screen.getByLabelText("孤立ノード"));

    expect(useGraphStore.getState()).toMatchObject({
      linkThickness: 1.7,
      nodeSize: 1.4,
      showArrows: true,
      showLabels: false,
      showOrphans: false,
      textFadeThreshold: 1.2,
      zoom: 1.5
    });
  });

  it("forces sectionで力学設定をstoreへ反映する", () => {
    renderSection(<GraphForcesSection isOpen onToggle={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("中心力"), { target: { value: "1.6" } });
    fireEvent.change(screen.getByLabelText("反発力"), { target: { value: "1.8" } });
    fireEvent.change(screen.getByLabelText("リンク力"), { target: { value: "1.3" } });
    fireEvent.change(screen.getByLabelText("リンク距離"), { target: { value: "150" } });

    expect(useGraphStore.getState()).toMatchObject({
      centerForce: 1.6,
      linkDistance: 150,
      linkForce: 1.3,
      repelForce: 1.8
    });
  });
});
