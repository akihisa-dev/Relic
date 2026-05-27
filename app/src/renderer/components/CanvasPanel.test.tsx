import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { CanvasPanel } from "./CanvasPanel";
import { MermaidCanvasEditor } from "./MermaidCanvasEditor";

function renderWithI18n(ui: ReactElement) {
  return render(
    <I18nProvider language="ja">
      {ui}
    </I18nProvider>
  );
}

describe("CanvasPanel", () => {
  it("独立キャンバスタブではなくMarkdownブロック起点の案内を表示する", () => {
    renderWithI18n(<CanvasPanel />);

    expect(screen.getByText(/Mermaidブロックから開きます/)).toBeInTheDocument();
  });
});

describe("MermaidCanvasEditor", () => {
  it("ノード追加とラベル編集をMermaid sourceとして返す", () => {
    const onChange = vi.fn();
    renderWithI18n(
      <MermaidCanvasEditor
        blockRange={{ from: 10, to: 54 }}
        filePath="setting.md"
        onChange={onChange}
        source={"flowchart TD\n  node1[人物]"}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "四角" }));
    fireEvent.change(screen.getByLabelText("ラベル"), { target: { value: "場所" } });

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("node2[場所]"));
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("%% relic:canvas"));
  });

  it("接続追加と接続削除をMermaid sourceとして返す", () => {
    const onChange = vi.fn();
    const { container } = renderWithI18n(
      <MermaidCanvasEditor
        blockRange={{ from: 0, to: 58 }}
        filePath="setting.md"
        onChange={onChange}
        source={"flowchart TD\n  node1[人物]\n  node2[場所]"}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    fireEvent.click(screen.getByRole("button", { name: "人物" }));
    fireEvent.click(screen.getByRole("button", { name: "場所" }));

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("node1 --> node2"));

    const line = container.querySelector(".canvas-edges line");
    expect(line).not.toBeNull();
    fireEvent.click(line as Element);
    fireEvent.click(screen.getByRole("button", { name: "接続を削除" }));

    expect(onChange).toHaveBeenLastCalledWith(expect.not.stringContaining("node1 --> node2"));
  });

  it("未対応Mermaid構文は読み取り専用にする", () => {
    renderWithI18n(
      <MermaidCanvasEditor
        blockRange={{ from: 0, to: 44 }}
        filePath="setting.md"
        onChange={vi.fn()}
        source={"sequenceDiagram\nAlice->>Bob: Hi"}
      />
    );

    expect(screen.getByText(/対応範囲外/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "四角" })).toBeDisabled();
  });
});
