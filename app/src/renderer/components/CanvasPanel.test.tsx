import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "../i18n";
import { CanvasPanel } from "./CanvasPanel";

function renderCanvasPanel() {
  return render(
    <I18nProvider language="ja">
      <CanvasPanel />
    </I18nProvider>
  );
}

describe("CanvasPanel", () => {
  it("ノード追加とラベル編集をMermaidソースへ反映する", () => {
    renderCanvasPanel();

    fireEvent.click(screen.getByRole("button", { name: "四角" }));
    fireEvent.change(screen.getByLabelText("ラベル"), { target: { value: "人物" } });

    expect(screen.getByText(/node3\[人物\]/)).toBeInTheDocument();
  });

  it("接続モードでノード同士の線をMermaidソースへ反映する", () => {
    renderCanvasPanel();

    fireEvent.click(screen.getByRole("button", { name: "接続" }));
    fireEvent.click(screen.getByRole("button", { name: "Node 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Node 1" }));

    expect(screen.getByText(/node2 --> node1/)).toBeInTheDocument();
  });
});
