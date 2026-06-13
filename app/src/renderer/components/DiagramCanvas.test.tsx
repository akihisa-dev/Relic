import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const whyTreeContent = [
  "---",
  "type: why-tree",
  "title: 売上低下分析",
  "---",
  "",
  "phenomenon:",
  "  title: 売上低下",
  "  facts:",
  "    - 市場縮小",
  "  solutions:",
  "    - 新市場開拓",
  "  actions:",
  "    - 調査実施",
  "  why:",
  "    title: 流入減少",
  "    facts:",
  "      - SEO順位低下",
  "    solutions:",
  "      - SEO改善",
  "    actions:",
  "      - 記事改修",
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

afterEach(() => {
  cleanup();
});

describe("DiagramCanvas", () => {
  it("renders nodes and line labels from Diagram Markdown", () => {
    renderDiagramCanvas();

    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.queryByText("characters/alice.md")).not.toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("幼なじみ")).toBeInTheDocument();
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
    expect(screen.queryByLabelText("Node role")).not.toBeInTheDocument();
  });

  it("adds why-tree items only from Phenomenon or Why selection", () => {
    const onChange = vi.fn();
    const { container } = render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);

    expect(container.querySelector(".why-tree-node-menu")).toBeInTheDocument();
    expect(container.querySelector(".why-tree-add-controls")).toBeNull();
    expect(container.querySelector(".why-tree-actions-bar")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /\+ Why/ }));
    expect(onChange.mock.calls[0]?.[0]).toContain("title: なぜ？");

    fireEvent.click(screen.getByRole("button", { name: /\+ Fact/ }));
    expect(onChange.mock.calls[1]?.[0]).toContain("根拠");

    fireEvent.click(screen.getByRole("button", { name: /\+ Solution/ }));
    expect(onChange.mock.calls[2]?.[0]).toContain("解決策");

    fireEvent.click(screen.getByRole("button", { name: /\+ Action/ }));
    expect(onChange.mock.calls[3]?.[0]).toContain("実行項目");

    fireEvent.focus(screen.getByDisplayValue("市場縮小"));
    expect(container.querySelector(".why-tree-node-menu")).toBeNull();
    expect(screen.queryByRole("button", { name: /\+ Why/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+ Fact/ })).not.toBeInTheDocument();
  });

  it("adds Why nodes from the selected node instead of always appending to the deepest node", () => {
    const onChange = vi.fn();
    const { container } = render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /\+ Why/ }));
    fireEvent.focus(screen.getByDisplayValue("売上低下"));
    fireEvent.click(screen.getByRole("button", { name: /\+ Why/ }));

    expect(screen.getAllByDisplayValue("なぜ？")).toHaveLength(2);
    expect(container.querySelector(".why-tree-child-group")).toBeInTheDocument();
    expect(container.querySelector(".why-tree-lines path")).toBeInTheDocument();
    expect(container.querySelector(".why-tree-children")).toBeInTheDocument();
    expect(onChange.mock.calls[1]?.[0]).toContain("whys:");
  });

  it("renders added why-tree items immediately even before the parent content prop updates", () => {
    const onChange = vi.fn();
    const { container } = render(<DelayedDiagramCanvas content={whyTreeContent} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /\+ Why/ }));
    expect(screen.getByDisplayValue("なぜ？")).toBeInTheDocument();
    expect(container.querySelector(".why-tree-lines path")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /\+ Fact/ }));
    expect(screen.getByDisplayValue("根拠")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /\+ Fact/ }));
    expect(screen.getAllByDisplayValue("根拠")).toHaveLength(2);
    expect(onChange).toHaveBeenCalledTimes(3);
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

  it("pans the why-tree view by dragging blank space only", () => {
    const { container } = render(<StatefulDiagramCanvas content={whyTreeContent} onChange={vi.fn()} />);
    const editor = screen.getByRole("tree", { name: "World" }) as HTMLElement;
    const content = container.querySelector(".why-tree-content") as Element;

    Object.defineProperty(editor, "scrollLeft", { configurable: true, value: 120, writable: true });
    Object.defineProperty(editor, "scrollTop", { configurable: true, value: 80, writable: true });
    fireEvent(content, pointerEvent("pointerdown", 7, 200, 200));
    fireEvent(editor, pointerEvent("pointermove", 7, 170, 150));
    fireEvent(editor, pointerEvent("pointerup", 7, 170, 150));

    expect(editor.scrollLeft).toBe(150);
    expect(editor.scrollTop).toBe(130);

    const node = screen.getByDisplayValue("売上低下").closest(".why-tree-main-node") as Element;
    fireEvent(node, pointerEvent("pointerdown", 8, 200, 200));
    fireEvent(editor, pointerEvent("pointermove", 8, 100, 100));
    expect(editor.scrollLeft).toBe(150);
    expect(editor.scrollTop).toBe(130);
  });

  it("edits why-tree titles and supplements in Markdown", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={whyTreeContent} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Phenomenon title"), { target: { value: "売上が下がった" } });
    expect(onChange.mock.calls[0]?.[0]).toContain("title: 売上が下がった");

    fireEvent.change(screen.getAllByLabelText("Fact")[0] as HTMLInputElement, { target: { value: "市場が縮小した" } });
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
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 100");
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
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 100");
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
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 100");
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
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 370");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 80");
    expect(onChange.mock.calls[0]?.[0]).not.toContain("from: node-1");
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
