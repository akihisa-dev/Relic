import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { DiagramCanvas } from "./DiagramCanvas";

const diagramContent = [
  "---",
  "type: relationship",
  "title: 関係図",
  "---",
  "",
  "nodes:",
  "  - id: node-1",
  "    file: characters/alice.md",
  "    x: 120",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "  - id: node-2",
  "    file: characters/bob.md",
  "    x: 380",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "lines:",
  "  - id: line-1",
  "    from: node-1",
  "    to: node-2",
  "    label: 幼なじみ",
  ""
].join("\n");

const diagramContentWithoutLines = [
  "---",
  "type: relationship",
  "---",
  "",
  "nodes:",
  "  - id: node-1",
  "    file: characters/alice.md",
  "    x: 120",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "  - id: node-2",
  "    file: characters/bob.md",
  "    x: 380",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "lines: []",
  ""
].join("\n");

const diagramContentWithEmptyLabel = [
  "---",
  "type: relationship",
  "---",
  "",
  "nodes:",
  "  - id: node-1",
  "    file: characters/alice.md",
  "    x: 120",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "  - id: node-2",
  "    file: characters/bob.md",
  "    x: 380",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "lines:",
  "  - id: line-1",
  "    from: node-1",
  "    to: node-2",
  "    label: ''",
  ""
].join("\n");

const diagramContentWithOppositeLines = [
  "---",
  "type: relationship",
  "---",
  "",
  "nodes:",
  "  - id: node-1",
  "    file: characters/alice.md",
  "    x: 120",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "  - id: node-2",
  "    file: characters/bob.md",
  "    x: 380",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "lines:",
  "  - id: line-1",
  "    from: node-1",
  "    to: node-2",
  "    label: 行き",
  "  - id: line-2",
  "    from: node-2",
  "    to: node-1",
  "    label: 戻り",
  ""
].join("\n");

const whyTreeContent = [
  "---",
  "type: why-tree",
  "title: 売上低下分析",
  "---",
  "",
  "labels:",
  "  root: ルート",
  "  node: ノード",
  "  fact: メモ",
  "  solution: 関連項目",
  "  action: アクション",
  "phenomenon:",
  "  title: 売上低下",
  "  facts:",
  "    - 市場縮小",
  "  solutions:",
  "    - 新市場開拓",
  "  actions:",
  "    - 調査実施",
  "  whys:",
  "    - title: 流入減少",
  "      facts:",
  "        - SEO順位低下",
  "      solutions:",
  "        - SEO改善",
  "      actions:",
  "        - 記事改修",
  ""
].join("\n");

const whyTreeContentWithSiblings = [
  "---",
  "type: why-tree",
  "title: 原因分析",
  "---",
  "",
  "labels:",
  "  root: ルート",
  "  node: ノード",
  "  fact: メモ",
  "  solution: 関連項目",
  "  action: アクション",
  "phenomenon:",
  "  title: 売上低下",
  "  facts: []",
  "  solutions: []",
  "  actions: []",
  "  whys:",
  "    - title: 流入減少",
  "      facts:",
  "        - SEO順位低下",
  "        - 品質低下",
  "      solutions: []",
  "      actions: []",
  "    - title: 広告停止",
  "      facts: []",
  "      solutions: []",
  "      actions: []",
  ""
].join("\n");

const whyTreeContentWithNestedWhy = [
  "---",
  "type: why-tree",
  "title: 原因分析",
  "---",
  "",
  "labels:",
  "  root: ルート",
  "  node: ノード",
  "  fact: メモ",
  "  solution: 関連項目",
  "  action: アクション",
  "phenomenon:",
  "  title: 売上低下",
  "  facts: []",
  "  solutions: []",
  "  actions: []",
  "  whys:",
  "    - title: 流入減少",
  "      facts: []",
  "      solutions: []",
  "      actions: []",
  "      whys:",
  "        - title: コンテンツ老朽化",
  "          facts: []",
  "          solutions: []",
  "          actions: []",
  ""
].join("\n");

const whyTreeContentWithOnlyActions = [
  "---",
  "type: why-tree",
  "title: 原因分析",
  "---",
  "",
  "labels:",
  "  root: ルート",
  "  node: ノード",
  "  fact: メモ",
  "  solution: 関連項目",
  "  action: アクション",
  "phenomenon:",
  "  title: 問",
  "  facts: []",
  "  solutions: []",
  "  actions:",
  "    - 実行項目",
  "    - 実行項目",
  "  whys:",
  "    - title: なぜ？",
  "      facts: []",
  "      solutions: []",
  "      actions: []",
  ""
].join("\n");

function renderDiagramCanvas(content = diagramContent) {
  render(
    <I18nProvider language="en">
      <DiagramCanvas content={content} fileName="World" />
    </I18nProvider>
  );
}

function StatefulDiagramCanvas({ content, onChange }: { content: string; onChange: (content: string) => void }) {
  const [currentContent, setCurrentContent] = useState(content);

  return (
    <I18nProvider language="en">
      <DiagramCanvas
        content={currentContent}
        fileName="World"
        onChange={(nextContent) => {
          setCurrentContent(nextContent);
          onChange(nextContent);
        }}
      />
    </I18nProvider>
  );
}

function DelayedDiagramCanvas({ content, onChange }: { content: string; onChange: (content: string) => void }) {
  return (
    <I18nProvider language="en">
      <DiagramCanvas content={content} fileName="World" onChange={onChange} />
    </I18nProvider>
  );
}

function mockRect(element: Element, rect: { bottom: number; height: number; left: number; right: number; top: number; width: number }): void {
  element.getBoundingClientRect = () => ({
    ...rect,
    x: rect.left,
    y: rect.top,
    toJSON: () => rect
  });
}

function getWhyTreeTextareasByValue(value: string): HTMLTextAreaElement[] {
  return screen
    .getAllByDisplayValue(value)
    .filter((element): element is HTMLTextAreaElement => element instanceof HTMLTextAreaElement);
}

afterEach(() => {
  cleanup();
});

describe("DiagramCanvas", () => {
  it("renders nodes and line labels from Diagram Markdown", () => {
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" />
      </I18nProvider>
    );

    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.queryByText("characters/alice.md")).not.toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("幼なじみ")).toBeInTheDocument();
    const line = container.querySelector(".diagram-canvas-line");
    expect(line?.getAttribute("d")).toBe("M 360 220 L 440 220");
    expect(line?.getAttribute("marker-end")).toMatch(/^url\(#diagram-canvas-arrow-/);
  });

  it("renders opposite relationship lines as separate paths", () => {
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithOppositeLines} fileName="World" />
      </I18nProvider>
    );

    const lines = Array.from(container.querySelectorAll(".diagram-canvas-line"));
    expect(lines.map((line) => line.getAttribute("d"))).toEqual([
      "M 360 208 L 440 208",
      "M 440 232 L 360 232"
    ]);
  });

  it("does not show the Mermaid copy action in Relationship Diagram mode", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    renderDiagramCanvas();

    expect(screen.queryByRole("button", { name: "Copy Mermaid source" })).not.toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("renders why-tree as a structural editor without relationship controls", () => {
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={whyTreeContent} fileName="Why" />
      </I18nProvider>
    );

    expect(screen.getByRole("tree", { name: "Why" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("売上低下")).toBeInTheDocument();
    expect(screen.getByDisplayValue("流入減少")).toBeInTheDocument();
    expect(screen.getByDisplayValue("市場縮小")).toBeInTheDocument();
    expect(screen.getByDisplayValue("SEO改善")).toBeInTheDocument();
    expect(screen.getByDisplayValue("記事改修")).toBeInTheDocument();
    expect(container.querySelector(".diagram-canvas-node")).toBeNull();
    expect(container.querySelector(".diagram-canvas-line")).toBeNull();
    expect(container.querySelector(".why-tree-line-label")).toHaveTextContent("ノード");
    expect(screen.queryByLabelText("Node role")).not.toBeInTheDocument();
  });

  it("does not show the Mermaid copy action in structure-tree mode", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={whyTreeContent} fileName="Why" />
      </I18nProvider>
    );

    expect(screen.queryByRole("button", { name: "Copy Mermaid source" })).not.toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("renders action supplements even when solution supplements are empty", () => {
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={whyTreeContentWithOnlyActions} fileName="Why" />
      </I18nProvider>
    );

    expect(screen.getAllByDisplayValue("実行項目")).toHaveLength(2);
    expect(screen.queryByDisplayValue("解決策")).not.toBeInTheDocument();
  });

  it("adds structure-tree items only from root or node selection", () => {
    const onChange = vi.fn();
    const { container } = render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);

    expect(container.querySelector(".why-tree-node-menu")).toBeNull();
    expect(container.querySelector(".why-tree-add-controls")).toBeNull();
    expect(container.querySelector(".why-tree-actions-bar")).toBeNull();

    fireEvent.click(screen.getByDisplayValue("売上低下"));
    expect(container.querySelector(".why-tree-node-menu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /\+ ノード/ }));
    expect(onChange.mock.calls[0]?.[0]).toContain("title: ノード");

    fireEvent.click(screen.getByRole("button", { name: /\+ メモ/ }));
    expect(onChange.mock.calls[1]?.[0]).toContain("メモ");

    fireEvent.click(screen.getByRole("button", { name: /\+ 関連項目/ }));
    expect(onChange.mock.calls[2]?.[0]).toContain("関連項目");

    fireEvent.click(screen.getByRole("button", { name: /\+ アクション/ }));
    expect(onChange.mock.calls[3]?.[0]).toContain("アクション");

    fireEvent.focus(screen.getByDisplayValue("市場縮小"));
    expect(container.querySelector(".why-tree-node-menu")).toBeNull();
    expect(screen.queryByRole("button", { name: /\+ ノード/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+ メモ/ })).not.toBeInTheDocument();
  });

  it("edits and saves structure-tree labels from the floating left panel", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);

    expect(screen.getByText("Labels")).toBeInTheDocument();
    expect(screen.getByLabelText("Node label")).toHaveValue("ノード");

    fireEvent.change(screen.getByLabelText("Node label"), { target: { value: "分解" } });

    expect(onChange.mock.calls[0]?.[0]).toContain("labels:");
    expect(onChange.mock.calls[0]?.[0]).toContain("node: 分解");
    expect(screen.getAllByText("分解").length).toBeGreaterThan(1);
    fireEvent.click(screen.getByDisplayValue("売上低下"));
    expect(screen.getByRole("button", { name: /\+ 分解/ })).toBeInTheDocument();
    expect(document.querySelector(".why-tree-line-label")).toHaveTextContent("分解");
  });

  it("can close and reopen the structure-tree labels panel", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);

    expect(screen.getByLabelText("Node label")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close labels panel" }));

    expect(screen.queryByLabelText("Node label")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show labels panel" }));

    expect(screen.getByLabelText("Node label")).toBeInTheDocument();
  });

  it("adds Why nodes from the selected node instead of always appending to the deepest node", () => {
    const onChange = vi.fn();
    const { container } = render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);

    fireEvent.click(screen.getByDisplayValue("売上低下"));
    fireEvent.click(screen.getByRole("button", { name: /\+ ノード/ }));
    fireEvent.click(screen.getByDisplayValue("売上低下"));
    fireEvent.click(screen.getByRole("button", { name: /\+ ノード/ }));

    expect(getWhyTreeTextareasByValue("ノード")).toHaveLength(2);
    expect(container.querySelector(".why-tree-child-group")).toBeInTheDocument();
    expect(container.querySelector(".why-tree-lines path")).toBeInTheDocument();
    expect(container.querySelector(".why-tree-children")).toBeInTheDocument();
    expect(onChange.mock.calls[1]?.[0]).toContain("whys:");
  });

  it("renders added why-tree items immediately even before the parent content prop updates", () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<DelayedDiagramCanvas content={whyTreeContent} onChange={onChange} />);

    fireEvent.click(screen.getByDisplayValue("売上低下"));
    fireEvent.click(screen.getByRole("button", { name: /\+ ノード/ }));
    expect(getWhyTreeTextareasByValue("ノード")[0]).toBeInTheDocument();
    expect(container.querySelector(".why-tree-lines path")).toBeInTheDocument();
    rerender(<DelayedDiagramCanvas content={whyTreeContent} onChange={onChange} />);
    expect(getWhyTreeTextareasByValue("ノード")[0]).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /\+ メモ/ }));
    expect(getWhyTreeTextareasByValue("メモ")[0]).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /\+ メモ/ }));
    expect(getWhyTreeTextareasByValue("メモ")).toHaveLength(2);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("collapses why-tree child whys without saving the collapsed state", () => {
    const onChange = vi.fn();
    const { container } = render(<StatefulDiagramCanvas content={whyTreeContentWithNestedWhy} onChange={onChange} />);

    expect(screen.getByDisplayValue("コンテンツ老朽化")).toBeInTheDocument();
    expect(container.querySelectorAll(".why-tree-lines path")).toHaveLength(2);

    const parentWhy = screen.getByDisplayValue("流入減少").closest(".why-tree-main-node");
    expect(parentWhy).toBeInstanceOf(HTMLElement);
    fireEvent.click(within(parentWhy as HTMLElement).getByRole("button", { name: "Collapse child nodes" }));

    expect(screen.queryByDisplayValue("コンテンツ老朽化")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".why-tree-lines path")).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(within(parentWhy as HTMLElement).getByRole("button", { name: "Show child nodes" }));

    expect(screen.getByDisplayValue("コンテンツ老朽化")).toBeInTheDocument();
    expect(container.querySelectorAll(".why-tree-lines path")).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("routes why-tree connector lines around the open add menu", () => {
    const { container } = render(<StatefulDiagramCanvas content={whyTreeContent} onChange={vi.fn()} />);
    const content = container.querySelector(".why-tree-content") as Element;
    const nodes = container.querySelectorAll(".why-tree-main-node");
    fireEvent.click(screen.getByDisplayValue("売上低下"));
    const menu = container.querySelector(".why-tree-node-menu") as Element;

    mockRect(content, { bottom: 500, height: 500, left: 0, right: 1000, top: 0, width: 1000 });
    mockRect(nodes[0] as Element, { bottom: 126, height: 86, left: 350, right: 650, top: 40, width: 300 });
    mockRect(nodes[1] as Element, { bottom: 396, height: 86, left: 350, right: 650, top: 310, width: 300 });
    mockRect(menu, { bottom: 220, height: 40, left: 360, right: 640, top: 180, width: 280 });
    container.querySelectorAll(".why-tree-support-item").forEach((item, index) => {
      mockRect(item, { bottom: 120 + index * 56, height: 46, left: 700, right: 870, top: 74 + index * 56, width: 170 });
    });

    fireEvent(window, new Event("resize"));

    expect(container.querySelector(".why-tree-lines path")?.getAttribute("d")).toBe("M 500 126 V 168 H 656 V 232 H 500 V 310");
    expect(container.querySelector(".why-tree-line-label")).toHaveTextContent("ノード");
  });

  it("hides the why-tree add menu when blank space is clicked", () => {
    const { container } = render(<StatefulDiagramCanvas content={whyTreeContent} onChange={vi.fn()} />);
    const editor = screen.getByRole("tree", { name: "World" });
    const content = container.querySelector(".why-tree-content");
    expect(content).toBeInstanceOf(HTMLElement);

    expect(container.querySelector(".why-tree-node-menu")).toBeNull();

    fireEvent.click(screen.getByDisplayValue("売上低下"));
    expect(container.querySelector(".why-tree-node-menu")).toBeInTheDocument();

    fireEvent(content as HTMLElement, pointerEvent("pointerdown", 10, 120, 120));
    fireEvent(editor, pointerEvent("pointerup", 10, 120, 120));

    expect(container.querySelector(".why-tree-node-menu")).toBeNull();
  });

  it("moves the why-tree menu near the selected Why node", () => {
    const { container } = render(<StatefulDiagramCanvas content={whyTreeContent} onChange={vi.fn()} />);

    fireEvent.click(screen.getByDisplayValue("流入減少"));

    const selectedWhy = screen.getByDisplayValue("流入減少").closest(".why-tree-node-shell");
    expect(selectedWhy).toBeInstanceOf(HTMLElement);
    expect(selectedWhy).toHaveClass("why-tree-node-shell--menu-open");
    expect((selectedWhy as HTMLElement).querySelector(".why-tree-node-menu")).toBeInTheDocument();
    expect(container.querySelectorAll(".why-tree-node-menu")).toHaveLength(1);
  });

  it("uses why-tree keyboard shortcuts outside text inputs only", () => {
    const onChange = vi.fn();
    const { container } = render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);
    const editor = screen.getByRole("tree", { name: "World" });
    const whyInput = screen.getByDisplayValue("流入減少");

    fireEvent.click(whyInput);
    expect(fireEvent.keyDown(whyInput, { key: "Enter" })).toBe(true);
    expect(fireEvent.keyDown(whyInput, { key: " " })).toBe(true);
    expect(onChange).not.toHaveBeenCalled();

    expect(fireEvent.keyDown(editor, { key: "Enter" })).toBe(false);

    expect(onChange.mock.calls[0]?.[0]).toContain("title: ノード");
    expect(getWhyTreeTextareasByValue("ノード")[0]).toBeInTheDocument();

    fireEvent.keyDown(editor, { key: "Escape" });

    expect(container.querySelector(".why-tree-node-menu")).toBeNull();
  });

  it("deletes selected why-tree items from the keyboard outside text inputs", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);
    const editor = screen.getByRole("tree", { name: "World" });

    fireEvent.click(screen.getByDisplayValue("流入減少"));
    fireEvent.keyDown(editor, { key: "Delete" });

    expect(onChange.mock.calls[0]?.[0]).not.toContain("title: 流入減少");
    expect(screen.queryByDisplayValue("流入減少")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("売上低下")).toBeInTheDocument();
  });

  it("keeps input Backspace as text editing in why-tree fields", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);

    fireEvent.keyDown(screen.getByDisplayValue("流入減少"), { key: "Backspace" });
    fireEvent.keyDown(screen.getByDisplayValue("SEO順位低下"), { key: "Backspace" });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("流入減少")).toBeInTheDocument();
    expect(screen.getByDisplayValue("SEO順位低下")).toBeInTheDocument();
  });

  it("allows why-tree fields to become empty and contain line breaks", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("ルート"), { target: { value: "" } });
    expect(onChange.mock.calls[0]?.[0]).toContain("title: ''");
    expect(screen.getByDisplayValue("")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("ルート"), { target: { value: "売上\n低下" } });
    expect(onChange.mock.calls[1]?.[0]).toContain("売上");
    expect((screen.getByLabelText("ルート") as HTMLTextAreaElement).value).toBe("売上\n低下");

    fireEvent.change(screen.getByLabelText("ルート"), { target: { value: "売上低下\n" } });
    expect(onChange.mock.calls[2]?.[0]).toContain("売上低下");
    expect((screen.getByLabelText("ルート") as HTMLTextAreaElement).value).toBe("売上低下\n");
  });

  it("pans the why-tree view by dragging blank space only", () => {
    const onChange = vi.fn();
    const { container } = render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);
    const editor = screen.getByRole("tree", { name: "World" }) as HTMLElement;
    const content = container.querySelector(".why-tree-content") as Element;

    fireEvent(content, pointerEvent("pointerdown", 7, 200, 200));
    fireEvent(editor, pointerEvent("pointermove", 7, 170, 150));
    fireEvent(editor, pointerEvent("pointerup", 7, 170, 150));

    expect((content as HTMLElement).style.transform).toContain("translate(-30px, -50px)");
    expect(onChange).not.toHaveBeenCalled();

    const node = screen.getByDisplayValue("売上低下").closest(".why-tree-main-node") as Element;
    fireEvent(node, pointerEvent("pointerdown", 8, 200, 200));
    fireEvent(editor, pointerEvent("pointermove", 8, 100, 100));
    expect((content as HTMLElement).style.transform).toContain("translate(-30px, -50px)");

    fireEvent(editor, pointerEvent("pointerdown", 9, 220, 220));
    fireEvent(editor, pointerEvent("pointermove", 9, 260, 250));
    fireEvent(editor, pointerEvent("pointerup", 9, 260, 250));
    expect((content as HTMLElement).style.transform).toContain("translate(10px, -20px)");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("zooms the why-tree view without saving the viewport", () => {
    const onChange = vi.fn();
    const { container } = render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);
    const editor = screen.getByRole("tree", { name: "World" });
    const content = container.querySelector(".why-tree-content");
    expect(content).toBeInstanceOf(HTMLElement);

    fireEvent.wheel(editor, { clientX: 100, clientY: 100, deltaY: -100 });

    expect((content as HTMLElement).style.transform).toContain("scale(1.1)");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("edits why-tree titles and supplements in Markdown", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("ルート"), { target: { value: "売上が下がった" } });
    expect(onChange.mock.calls[0]?.[0]).toContain("title: 売上が下がった");

    fireEvent.change(screen.getAllByRole("textbox", { name: "メモ" })[0] as HTMLTextAreaElement, { target: { value: "市場が縮小した" } });
    expect(onChange.mock.calls[1]?.[0]).toContain("市場が縮小した");
  });

  it("deletes why-tree items except the Phenomenon", () => {
    const onChange = vi.fn();
    const { container } = render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);

    const phenomenon = screen.getByDisplayValue("売上低下").closest(".why-tree-main-node");
    expect(phenomenon).toBeInstanceOf(HTMLElement);
    expect((phenomenon as HTMLElement).querySelector(".why-tree-delete-button")).toBeNull();

    const whyNode = screen.getByDisplayValue("流入減少").closest(".why-tree-main-node");
    expect(whyNode).toBeInstanceOf(HTMLElement);
    fireEvent.click((whyNode as HTMLElement).querySelector(".why-tree-delete-button") as Element);

    expect(onChange.mock.calls[0]?.[0]).not.toContain("title: 流入減少");
    expect(screen.getByDisplayValue("売上低下")).toBeInTheDocument();
    expect(container.querySelectorAll(".why-tree-main-node .why-tree-delete-button")).toHaveLength(0);
  });

  it("deletes selected why-tree supplements", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);

    const factNode = screen.getByDisplayValue("SEO順位低下").closest(".why-tree-support-item");
    expect(factNode).toBeInstanceOf(HTMLElement);
    fireEvent.click((factNode as HTMLElement).querySelector(".why-tree-delete-button") as Element);

    expect(onChange.mock.calls[0]?.[0]).not.toContain("SEO順位低下");
    expect(screen.queryByDisplayValue("SEO順位低下")).not.toBeInTheDocument();
  });

  it("reorders why-tree whys and supplements by dragging", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={whyTreeContentWithSiblings} onChange={onChange} />);

    const firstWhy = screen.getByDisplayValue("流入減少").closest(".why-tree-main-node");
    const secondWhy = screen.getByDisplayValue("広告停止").closest(".why-tree-main-node");
    expect(firstWhy).toBeInstanceOf(HTMLElement);
    expect(secondWhy).toBeInstanceOf(HTMLElement);
    fireEvent.dragStart(secondWhy as HTMLElement);
    fireEvent.dragOver(firstWhy as HTMLElement);
    fireEvent.drop(firstWhy as HTMLElement);

    const movedWhyContent = onChange.mock.calls[0]?.[0] as string;
    expect(movedWhyContent.indexOf("title: 広告停止")).toBeLessThan(movedWhyContent.indexOf("title: 流入減少"));

    const seoFact = screen.getByDisplayValue("SEO順位低下").closest(".why-tree-support-item");
    const qualityFact = screen.getByDisplayValue("品質低下").closest(".why-tree-support-item");
    expect(seoFact).toBeInstanceOf(HTMLElement);
    expect(qualityFact).toBeInstanceOf(HTMLElement);
    fireEvent.dragStart(seoFact as HTMLElement);
    fireEvent.dragOver(qualityFact as HTMLElement);
    fireEvent.drop(qualityFact as HTMLElement);

    const movedFactContent = onChange.mock.calls[1]?.[0] as string;
    expect(movedFactContent.indexOf("- 品質低下")).toBeLessThan(movedFactContent.indexOf("- SEO順位低下"));
    expect(screen.queryByRole("button", { name: "Move up" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move down" })).not.toBeInTheDocument();
  });

  it("shows an error for invalid Diagram Markdown", () => {
    renderDiagramCanvas("type: map\n\nnotes: body");

    expect(screen.getByRole("alert")).toHaveTextContent("Could not read this Diagram file. Check the source.");
  });

  it("commits moved node coordinates on pointer up", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const node = screen.getByText("alice").closest(".diagram-canvas-node");
    expect(node).toBeInstanceOf(HTMLElement);

    fireEvent(node as HTMLElement, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(node as HTMLElement, pointerEvent("pointermove", 1, 50, 30));
    fireEvent(node as HTMLElement, pointerEvent("pointerup", 1, 50, 30));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 160");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 96");
  });

  it("snaps moved nodes to nearby node edges and only saves the final position", () => {
    const onChange = vi.fn();
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const node = screen.getByText("alice").closest(".diagram-canvas-node");
    expect(node).toBeInstanceOf(HTMLElement);

    fireEvent(node as HTMLElement, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(node as HTMLElement, pointerEvent("pointermove", 1, 92, 10));

    expect(container.querySelector(".diagram-canvas-snap-guides line")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent(node as HTMLElement, pointerEvent("pointerup", 1, 92, 10));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 192");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 96");
    expect(onChange.mock.calls[0]?.[0]).not.toContain("snap");
  });

  it("does not navigate away from the Diagram when a node is double clicked", () => {
    const onOpenFile = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" />
      </I18nProvider>
    );
    const node = screen.getByText("alice").closest(".diagram-canvas-node");
    expect(node).toBeInstanceOf(HTMLElement);

    fireEvent.doubleClick(node as HTMLElement);

    expect(onOpenFile).not.toHaveBeenCalled();
  });

  it("pans the canvas by dragging blank space", () => {
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" />
      </I18nProvider>
    );
    const canvas = screen.getByRole("img", { name: "World" });
    const space = container.querySelector(".diagram-canvas-space");
    expect(space).toBeInstanceOf(HTMLElement);

    fireEvent(canvas, pointerEvent("pointerdown", 5, 10, 10));
    fireEvent(canvas, pointerEvent("pointermove", 5, 40, 30));
    fireEvent(canvas, pointerEvent("pointerup", 5, 40, 30));

    expect((space as HTMLElement).style.transform).toContain("translate(30px, 20px)");
  });

  it("pans the canvas from blank overlay layers", () => {
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" />
      </I18nProvider>
    );
    const canvas = screen.getByRole("img", { name: "World" });
    const space = container.querySelector(".diagram-canvas-space");
    const nodeLayer = container.querySelector(".diagram-canvas-nodes");
    expect(space).toBeInstanceOf(HTMLElement);
    expect(nodeLayer).toBeInstanceOf(HTMLElement);

    fireEvent(nodeLayer as HTMLElement, pointerEvent("pointerdown", 8, 100, 100));
    fireEvent(canvas, pointerEvent("pointermove", 8, 160, 130));
    fireEvent(canvas, pointerEvent("pointerup", 8, 160, 130));

    expect((space as HTMLElement).style.transform).toContain("translate(60px, 30px)");
  });

  it("zooms the canvas around the pointer", () => {
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" />
      </I18nProvider>
    );
    const canvas = screen.getByRole("img", { name: "World" });
    const space = container.querySelector(".diagram-canvas-space");
    expect(space).toBeInstanceOf(HTMLElement);

    fireEvent.wheel(canvas, { clientX: 100, clientY: 100, deltaY: -100 });

    expect((space as HTMLElement).style.transform).toContain("scale(1.1)");
  });

  it("commits moved node coordinates in canvas units while zoomed", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("img", { name: "World" });
    const node = screen.getByText("alice").closest(".diagram-canvas-node");
    expect(node).toBeInstanceOf(HTMLElement);

    fireEvent.wheel(canvas, { clientX: 100, clientY: 100, deltaY: -100 });
    fireEvent(node as HTMLElement, pointerEvent("pointerdown", 6, 10, 10));
    fireEvent(node as HTMLElement, pointerEvent("pointermove", 6, 54, 32));
    fireEvent(node as HTMLElement, pointerEvent("pointerup", 6, 54, 32));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 160");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 96");
  });

  it("does not rewrite Diagram Markdown when a node is clicked without moving", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const node = screen.getByText("alice").closest(".diagram-canvas-node");
    expect(node).toBeInstanceOf(HTMLElement);

    fireEvent(node as HTMLElement, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(node as HTMLElement, pointerEvent("pointerup", 1, 10, 10));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not render node connection handles", () => {
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" />
      </I18nProvider>
    );

    expect(screen.queryByLabelText("Connect alice")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Connect bob")).not.toBeInTheDocument();
  });

  it("adds a line by dragging from a selected node to another node", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("img", { name: "World" });
    const alice = screen.getByText("alice").closest(".diagram-canvas-node");
    const bob = screen.getByText("bob").closest(".diagram-canvas-node");
    expect(alice).toBeInstanceOf(HTMLElement);
    expect(bob).toBeInstanceOf(HTMLElement);

    fireEvent(alice as HTMLElement, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 2, 10, 10));
    expect(alice as HTMLElement).toHaveClass("diagram-canvas-node--selected");
    const outline = (alice as HTMLElement).querySelector(".diagram-canvas-node-outline-hit--right");
    expect(outline).toBeInstanceOf(HTMLElement);

    fireEvent(outline as HTMLElement, pointerEvent("pointerdown", 3, 190, 50));
    fireEvent(canvas, pointerEvent("pointermove", 3, 260, 10));
    fireEvent(bob as HTMLElement, pointerEvent("pointerup", 3, 260, 10));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("from: node-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("to: node-2");
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 120");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 80");
  });

  it("does not save a duplicate line between the same nodes", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("img", { name: "World" });
    const alice = screen.getByText("alice").closest(".diagram-canvas-node");
    const bob = screen.getByText("bob").closest(".diagram-canvas-node");
    expect(alice).toBeInstanceOf(HTMLElement);
    expect(bob).toBeInstanceOf(HTMLElement);

    fireEvent(alice as HTMLElement, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 2, 10, 10));
    const outline = (alice as HTMLElement).querySelector(".diagram-canvas-node-outline-hit--right");
    expect(outline).toBeInstanceOf(HTMLElement);

    fireEvent(outline as HTMLElement, pointerEvent("pointerdown", 3, 190, 50));
    fireEvent(canvas, pointerEvent("pointermove", 3, 260, 10));
    fireEvent(bob as HTMLElement, pointerEvent("pointerup", 3, 260, 10));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens line label editing immediately after creating a line", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={diagramContentWithoutLines} onChange={onChange} />);
    const canvas = screen.getByRole("img", { name: "World" });
    const alice = screen.getByText("alice").closest(".diagram-canvas-node");
    const bob = screen.getByText("bob").closest(".diagram-canvas-node");
    expect(alice).toBeInstanceOf(HTMLElement);
    expect(bob).toBeInstanceOf(HTMLElement);

    fireEvent(alice as HTMLElement, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 2, 10, 10));
    const outline = (alice as HTMLElement).querySelector(".diagram-canvas-node-outline-hit--right");
    expect(outline).toBeInstanceOf(HTMLElement);

    fireEvent(outline as HTMLElement, pointerEvent("pointerdown", 3, 190, 50));
    fireEvent(canvas, pointerEvent("pointermove", 3, 260, 10));
    fireEvent(bob as HTMLElement, pointerEvent("pointerup", 3, 260, 10));

    const input = screen.getByLabelText("Edit line label");
    fireEvent.change(input, { target: { value: "best friends" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1]?.[0]).toContain("label: best friends");
    expect(screen.getByText("best friends")).toBeInTheDocument();
  });

  it("shows an add-label button for a selected unlabeled line", () => {
    const onChange = vi.fn();
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithEmptyLabel} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const line = container.querySelector(".diagram-canvas-line-hit");
    expect(line).toBeInstanceOf(Element);

    expect(screen.queryByRole("button", { name: "Edit line label" })).not.toBeInTheDocument();
    fireEvent(line as Element, pointerEvent("pointerdown", 4, 10, 10));

    expect(screen.getByRole("button", { name: "Edit line label" })).toHaveTextContent("Add label");
  });

  it("clears relationship selection with Escape without saving", () => {
    const onChange = vi.fn();
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithEmptyLabel} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("img", { name: "World" });
    const line = container.querySelector(".diagram-canvas-line-hit");
    expect(line).toBeInstanceOf(Element);

    fireEvent(line as Element, pointerEvent("pointerdown", 4, 10, 10));
    expect(screen.getByRole("button", { name: "Edit line label" })).toHaveTextContent("Add label");

    fireEvent.keyDown(canvas, { key: "Escape" });

    expect(screen.queryByRole("button", { name: "Edit line label" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps Backspace inside the relationship label editor from deleting the line", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Edit line label" }));
    const input = screen.getByLabelText("Edit line label");
    fireEvent.keyDown(input, { key: "Backspace" });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Edit line label")).toBeInTheDocument();
  });

  it("keeps unselected node dragging as node movement", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const alice = screen.getByText("alice").closest(".diagram-canvas-node");
    expect(alice).toBeInstanceOf(HTMLElement);

    fireEvent(alice as HTMLElement, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointermove", 2, 50, 30));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 2, 50, 30));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 160");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 96");
    expect(onChange.mock.calls[0]?.[0]).not.toContain("from: node-1");
  });

  it("moves a selected node when dragging inside the node", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const alice = screen.getByText("alice").closest(".diagram-canvas-node");
    expect(alice).toBeInstanceOf(HTMLElement);

    fireEvent(alice as HTMLElement, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 2, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointerdown", 3, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointermove", 3, 260, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 3, 260, 10));

    expect(screen.getByRole("img", { name: "World" })).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 384");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 96");
    expect(onChange.mock.calls[0]?.[0]).not.toContain("from: node-1");
  });

  it("commits selected node size on resize handle pointer up", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const alice = screen.getByText("alice").closest(".diagram-canvas-node");
    expect(alice).toBeInstanceOf(HTMLElement);

    fireEvent(alice as HTMLElement, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 2, 10, 10));
    const resizeHandle = screen.getByRole("button", { name: "Resize node" });

    fireEvent(resizeHandle, pointerEvent("pointerdown", 3, 190, 90));
    fireEvent(alice as HTMLElement, pointerEvent("pointermove", 3, 230, 110));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 3, 230, 110));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("width: 220");
    expect(onChange.mock.calls[0]?.[0]).toContain("height: 100");
  });

  it("keeps resized node above the minimum size", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const alice = screen.getByText("alice").closest(".diagram-canvas-node");
    expect(alice).toBeInstanceOf(HTMLElement);

    fireEvent(alice as HTMLElement, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 2, 10, 10));
    const resizeHandle = screen.getByRole("button", { name: "Resize node" });

    fireEvent(resizeHandle, pointerEvent("pointerdown", 3, 190, 90));
    fireEvent(alice as HTMLElement, pointerEvent("pointermove", 3, -500, -500));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 3, -500, -500));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("width: 96");
    expect(onChange.mock.calls[0]?.[0]).toContain("height: 56");
  });

  it("does not move a selected node when dragging its outline without a target node", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("img", { name: "World" });
    const alice = screen.getByText("alice").closest(".diagram-canvas-node");
    expect(alice).toBeInstanceOf(HTMLElement);

    fireEvent(alice as HTMLElement, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 2, 10, 10));
    const outline = (alice as HTMLElement).querySelector(".diagram-canvas-node-outline-hit--right");
    expect(outline).toBeInstanceOf(HTMLElement);

    fireEvent(outline as HTMLElement, pointerEvent("pointerdown", 3, 190, 50));
    fireEvent(canvas, pointerEvent("pointermove", 3, 260, 10));
    fireEvent(canvas, pointerEvent("pointerup", 3, 260, 10));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("deletes a selected node and connected lines with Delete", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const node = screen.getByText("alice").closest(".diagram-canvas-node");
    expect(node).toBeInstanceOf(HTMLElement);

    fireEvent(node as HTMLElement, pointerEvent("pointerdown", 3, 10, 10));
    fireEvent(node as HTMLElement, pointerEvent("pointerup", 3, 10, 10));
    fireEvent.keyDown(screen.getByRole("img", { name: "World" }), { key: "Delete" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).not.toContain("id: node-1");
    expect(onChange.mock.calls[0]?.[0]).not.toContain("id: line-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("id: node-2");
  });

  it("deletes a selected line with Backspace", () => {
    const onChange = vi.fn();
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const line = container.querySelector(".diagram-canvas-line-hit");
    expect(line).toBeInstanceOf(Element);

    fireEvent(line as Element, pointerEvent("pointerdown", 4, 10, 10));
    fireEvent.keyDown(screen.getByRole("img", { name: "World" }), { key: "Backspace" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).not.toContain("id: line-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("id: node-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("id: node-2");
  });

  it("reverses a selected relationship line direction", () => {
    const onChange = vi.fn();
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const line = container.querySelector(".diagram-canvas-line-hit");
    expect(line).toBeInstanceOf(Element);

    expect(screen.queryByRole("button", { name: "Reverse arrow direction" })).not.toBeInTheDocument();
    fireEvent(line as Element, pointerEvent("pointerdown", 4, 10, 10));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Reverse arrow direction" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("from: node-2");
    expect(onChange.mock.calls[0]?.[0]).toContain("to: node-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("label: 幼なじみ");
  });

  it("edits a line label from the label button", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Edit line label" }));
    const input = screen.getByLabelText("Edit line label");
    fireEvent.change(input, { target: { value: "best friends" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("label: best friends");
    expect(onChange.mock.calls[0]?.[0]).toContain("id: line-1");
  });
});

function pointerEvent(type: string, pointerId: number, clientX: number, clientY: number): Event {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY
  });

  Object.defineProperty(event, "pointerId", { value: pointerId });

  return event;
}
