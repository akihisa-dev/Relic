import { readFileSync } from "node:fs";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { parseMermaidFlowchart } from "../mermaidFlowchart";
import { MermaidEditorPanel } from "./MermaidEditorPanel";
import { MermaidVisualEditor } from "./MermaidVisualEditor";

const { renderMermaidElementMock } = vi.hoisted(() => ({
  renderMermaidElementMock: vi.fn()
}));

vi.mock("../mermaidPreview", () => ({
  buildMermaidFallback: (source: string) => {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = source;
    pre.append(code);
    return pre;
  },
  renderMermaidElement: renderMermaidElementMock
}));

const reproductionMermaid = [
  "flowchart TD",
  "  A[設定を作る] --> B[Markdownに保存する]",
  "  B --> C[Relicで開く]",
  "  C --> D{mermaidコードブロック?}",
  "  D -->|はい| E[図として表示]",
  "  D -->|いいえ| F[通常のコードブロック]"
].join("\n");

function renderWithI18n(ui: ReactElement) {
  return render(
    <I18nProvider language="ja">
      {ui}
    </I18nProvider>
  );
}

function renderEditor(source: string, onChange = vi.fn()) {
  const result = renderWithI18n(
    <MermaidVisualEditor
      blockRange={{ from: 0, to: source.length }}
      filePath="setting.md"
      onChange={onChange}
      source={source}
    />
  );
  return { ...result, onChange };
}

function mockMermaidSvg(source: string): HTMLElement {
  const parseResult = parseMermaidFlowchart(source);
  const viewport = document.createElement("div");
  viewport.className = "preview-mermaid-panzoom-viewport";
  const content = document.createElement("div");
  content.className = "preview-mermaid-panzoom-content";
  const svgWrap = document.createElement("div");
  svgWrap.className = "preview-mermaid-svg";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 600 360");

  if (parseResult.ok) {
    parseResult.model.connections.forEach((connection, index) => {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("id", `L-${connection.from}-${connection.to}-${index}`);
      group.setAttribute("class", "edgePath");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "flowchart-link");
      group.append(path);
      svg.append(group);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "g");
      label.setAttribute("class", "edgeLabel");
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.textContent = connection.label ?? `${connection.from} to ${connection.to}`;
      label.append(text);
      svg.append(label);
    });

    parseResult.model.nodes.forEach((node, index) => {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("id", `flowchart-${node.id}-${index}`);
      group.setAttribute("class", "node");
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.textContent = node.label;
      group.append(rect, text);
      svg.append(group);
    });
  }

  svgWrap.append(svg);
  content.append(svgWrap);
  viewport.append(content);
  return viewport;
}

function nodeElement(container: HTMLElement, id: string): Element {
  const element = container.querySelector(`#flowchart-${id}-0, [id^="flowchart-${id}-"]`);
  expect(element).not.toBeNull();
  return element as Element;
}

function connectionElement(container: HTMLElement, from: string, to: string): Element {
  const element = container.querySelector(`#L-${from}-${to}-0, [id^="L-${from}-${to}-"]`);
  expect(element).not.toBeNull();
  return element as Element;
}

beforeEach(() => {
  renderMermaidElementMock.mockReset();
  renderMermaidElementMock.mockImplementation(async (container: HTMLElement, source: string) => {
    container.replaceChildren(mockMermaidSvg(source));
    return { fitToViewport: vi.fn() };
  });
});

describe("MermaidEditorPanel", () => {
  it("独立タブではなくMarkdownブロック起点の案内を表示する", () => {
    renderWithI18n(<MermaidEditorPanel />);

    expect(screen.getByText(/Mermaidブロックから開きます/)).toBeInTheDocument();
    expect(screen.queryByText(/キャンバス/)).not.toBeInTheDocument();
  });
});

describe("MermaidVisualEditor", () => {
  it("通常Mermaidレンダラーでプレビューを再描画する", async () => {
    renderEditor(reproductionMermaid);

    await waitFor(() => expect(renderMermaidElementMock).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.stringContaining("flowchart TD")
    ));
    expect(screen.getByText("Mermaidプレビュー")).toBeInTheDocument();
  });

  it("ノードドラッグで位置変更やsource更新をしない", async () => {
    const { container, onChange } = renderEditor("flowchart TD\n  node1[人物]");

    await waitFor(() => expect(container.querySelector(".node.mermaid-editor-preview-selectable")).not.toBeNull());
    const node = nodeElement(container, "node1");
    fireEvent.pointerDown(node, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(node, { clientX: 160, clientY: 160 });
    fireEvent.pointerUp(node);

    expect(onChange).not.toHaveBeenCalled();
    expect(node).not.toHaveAttribute("style", expect.stringContaining("left"));
  });

  it("ノード追加でsourceを更新し、relic metadataは出力しない", () => {
    const { onChange } = renderEditor("flowchart TD");

    fireEvent.click(screen.getByRole("button", { name: "ノード追加" }));
    fireEvent.change(screen.getByLabelText("ID"), { target: { value: "place" } });
    fireEvent.change(screen.getByLabelText("ラベル"), { target: { value: "場所" } });
    fireEvent.change(screen.getByLabelText("形状"), { target: { value: "diamond" } });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("place{場所}"));
    expect(onChange).toHaveBeenLastCalledWith(expect.not.stringContaining("%% relic:canvas"));
  });

  it("ノード削除でsourceを更新する", async () => {
    const { container, onChange } = renderEditor("flowchart TD\n  node1[人物]\n  node2[場所]\n  node1 --> node2");

    await waitFor(() => expect(container.querySelector(".node.mermaid-editor-preview-selectable")).not.toBeNull());
    fireEvent.click(nodeElement(container, "node1"));
    fireEvent.click(screen.getByRole("button", { name: "ノードを削除" }));

    expect(onChange).toHaveBeenLastCalledWith(expect.not.stringContaining("node1[人物]"));
    expect(onChange).toHaveBeenLastCalledWith(expect.not.stringContaining("node1 --> node2"));
  });

  it("ID変更で接続参照も更新し、ID重複を拒否する", async () => {
    const { container, onChange } = renderEditor("flowchart TD\n  node1[人物]\n  node2[場所]\n  node1 --> node2");

    await waitFor(() => expect(container.querySelector(".node.mermaid-editor-preview-selectable")).not.toBeNull());
    fireEvent.click(nodeElement(container, "node1"));
    fireEvent.change(screen.getByLabelText("ID"), { target: { value: "node2" } });
    fireEvent.click(screen.getByRole("button", { name: "IDを変更" }));
    expect(screen.getByRole("alert")).toHaveTextContent("同じID");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("ID"), { target: { value: "person" } });
    fireEvent.click(screen.getByRole("button", { name: "IDを変更" }));

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("person[人物]"));
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("person --> node2"));
  });

  it("ラベル変更と形状変更でsourceを更新する", async () => {
    const { container, onChange } = renderEditor("flowchart TD\n  node1[人物]");

    await waitFor(() => expect(container.querySelector(".node.mermaid-editor-preview-selectable")).not.toBeNull());
    fireEvent.click(nodeElement(container, "node1"));
    fireEvent.change(screen.getByLabelText("ラベル"), { target: { value: "主人公" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("node1[主人公]"));

    fireEvent.change(screen.getByLabelText("形状"), { target: { value: "circle" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("node1((主人公))"));
  });

  it("接続追加、接続ラベル変更、接続削除でsourceを更新する", async () => {
    const { container, onChange } = renderEditor("flowchart TD\n  node1[人物]\n  node2[場所]");

    await waitFor(() => expect(container.querySelector(".node.mermaid-editor-preview-selectable")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "接続追加" }));
    await waitFor(() => expect(container.querySelector(".node.mermaid-editor-preview-selectable")).not.toBeNull());
    fireEvent.click(nodeElement(container, "node1"));
    await waitFor(() => expect(screen.getByText(/node1 からつなぐ/)).toBeInTheDocument());
    await waitFor(() => expect(container.querySelector(".node.mermaid-editor-preview-selectable")).not.toBeNull());
    fireEvent.click(nodeElement(container, "node2"));
    await waitFor(() => expect(screen.getByText(/必要なら接続ラベル/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("ラベル"), { target: { value: "行く" } });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("node1 -->|行く| node2"));

    await waitFor(() => expect(container.querySelector(".edgePath.mermaid-editor-preview-selectable")).not.toBeNull());
    fireEvent.click(connectionElement(container, "node1", "node2"));
    fireEvent.change(screen.getByLabelText("ラベル"), { target: { value: "戻る" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("node1 -->|戻る| node2"));

    fireEvent.click(screen.getByRole("button", { name: "接続を削除" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.not.stringContaining("node1 -->"));
  });

  it("TD/LR切り替えでsourceの先頭行を更新する", () => {
    const { onChange } = renderEditor("flowchart TD\n  node1[人物]");

    fireEvent.change(screen.getByLabelText("方向"), { target: { value: "LR" } });

    expect(onChange).toHaveBeenLastCalledWith(expect.stringMatching(/^flowchart LR/));
  });

  it("ソース編集後に対応可能ならビジュアル編集を再有効化する", async () => {
    const { container, onChange } = renderEditor("sequenceDiagram\nAlice->>Bob: Hi");

    expect(screen.getByText(/ビジュアル編集に対応していません/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ノード追加" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Mermaidソース"), {
      target: { value: "flowchart TD\n  node1[人物]" }
    });

    expect(onChange).toHaveBeenLastCalledWith("flowchart TD\n  node1[人物]");
    await waitFor(() => expect(container.querySelector(".node.mermaid-editor-preview-selectable")).not.toBeNull());
    expect(screen.getByRole("button", { name: "ノード追加" })).not.toBeDisabled();
  });

  it("Mermaid編集UIに旧編集文言、グリッド背景、grabカーソルを残さない", () => {
    const css = readFileSync("src/renderer/styles/mermaid-editor.css", "utf8");

    renderEditor("flowchart TD\n  node1[人物]");

    expect(document.body.textContent).not.toContain(["キャン", "バスで編集"].join(""));
    expect(css).not.toContain("background-size: 24px 24px");
    expect(css).not.toMatch(/cursor:\s*grab/);
    expect(css).not.toMatch(/cursor:\s*grabbing/);
  });
});
