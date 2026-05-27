import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { I18nProvider } from "../i18n";
import { useEditorStore } from "../store/editorStore";
import { CanvasPanel } from "./CanvasPanel";

function renderCanvasPanel() {
  return render(
    <I18nProvider language="ja">
      <CanvasPanel />
    </I18nProvider>
  );
}

function openMarkdown(content: string): string {
  useEditorStore.getState().openFileInPane("left", {
    content,
    name: "設定",
    path: "setting.md"
  });

  return Object.values(useEditorStore.getState().tabs).find((tab) => tab.kind === "file")?.id ?? "";
}

describe("CanvasPanel", () => {
  beforeEach(() => {
    useEditorStore.getState().closeAllTabs();
  });

  it("ノード追加とラベル編集をMarkdown内のMermaidブロックへ反映する", () => {
    const tabId = openMarkdown([
      "# 設定",
      "",
      "```mermaid",
      "flowchart TD",
      "  node1[人物]",
      "```"
    ].join("\n"));
    renderCanvasPanel();

    fireEvent.click(screen.getByRole("button", { name: "四角" }));
    fireEvent.change(screen.getByLabelText("ラベル"), { target: { value: "場所" } });

    const tab = useEditorStore.getState().tabs[tabId];
    expect(tab?.kind === "file" ? tab.content : "").toContain("node2[場所]");
    expect(screen.getByText(/node2\[場所\]/)).toBeInTheDocument();
  });

  it("Mermaidブロックがない場合はMarkdown末尾へ新しいブロックを追加する", () => {
    const tabId = openMarkdown("# 設定\n本文");
    renderCanvasPanel();

    fireEvent.click(screen.getByRole("button", { name: "Mermaidキャンバスを作成" }));

    const tab = useEditorStore.getState().tabs[tabId];
    expect(tab?.kind === "file" ? tab.content : "").toBe("# 設定\n本文\n\n```mermaid\nflowchart TD\n```\n");
  });

  it("複数Mermaidブロックがある場合は選択するまで編集しない", () => {
    openMarkdown([
      "```mermaid",
      "flowchart TD",
      "  node1[一つ目]",
      "```",
      "",
      "```mermaid",
      "flowchart LR",
      "  node2[二つ目]",
      "```"
    ].join("\n"));
    renderCanvasPanel();

    expect(screen.getByRole("button", { name: "四角" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Mermaidブロック"), { target: { value: "1" } });

    expect(screen.getByRole("button", { name: "四角" })).not.toBeDisabled();
    expect(screen.getByText(/node2\[二つ目\]/)).toBeInTheDocument();
  });

  it("未対応Mermaid構文は読み取り専用にする", () => {
    openMarkdown([
      "```mermaid",
      "sequenceDiagram",
      "Alice->>Bob: Hi",
      "```"
    ].join("\n"));
    renderCanvasPanel();

    expect(screen.getByText(/対応範囲外/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "四角" })).toBeDisabled();
  });

  it("接続追加と接続削除をMarkdown内のMermaidブロックへ反映する", () => {
    const tabId = openMarkdown([
      "```mermaid",
      "flowchart TD",
      "  node1[人物]",
      "  node2[場所]",
      "```"
    ].join("\n"));
    const { container } = renderCanvasPanel();

    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    fireEvent.click(screen.getByRole("button", { name: "人物" }));
    fireEvent.click(screen.getByRole("button", { name: "場所" }));

    let tab = useEditorStore.getState().tabs[tabId];
    expect(tab?.kind === "file" ? tab.content : "").toContain("node1 --> node2");

    const line = container.querySelector(".canvas-edges line");
    expect(line).not.toBeNull();
    fireEvent.click(line as Element);
    fireEvent.click(screen.getByRole("button", { name: "接続を削除" }));

    tab = useEditorStore.getState().tabs[tabId];
    expect(tab?.kind === "file" ? tab.content : "").not.toContain("node1 --> node2");
  });
});
