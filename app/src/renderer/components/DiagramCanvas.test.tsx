import { cleanup, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { diagramShapeDragType } from "./diagram/diagramShapeDrag";
import { DiagramCanvas } from "./DiagramCanvas";

const diagramContent = [
  "---",
  "type: diagram",
  "title: 関係図",
  "---",
  "",
  "nodes:",
  "  - id: node-1",
  "    shape: process",
  "    text: alice",
  "    x: 120",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "  - id: node-2",
  "    shape: process",
  "    text: bob",
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
  "type: diagram",
  "---",
  "",
  "nodes:",
  "  - id: node-1",
  "    shape: process",
  "    text: alice",
  "    x: 120",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "  - id: node-2",
  "    shape: process",
  "    text: bob",
  "    x: 380",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "lines: []",
  ""
].join("\n");

const diagramContentWithEmptyLabel = [
  "---",
  "type: diagram",
  "---",
  "",
  "nodes:",
  "  - id: node-1",
  "    shape: process",
  "    text: alice",
  "    x: 120",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "  - id: node-2",
  "    shape: process",
  "    text: bob",
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
  "type: diagram",
  "---",
  "",
  "nodes:",
  "  - id: node-1",
  "    shape: process",
  "    text: alice",
  "    x: 120",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "  - id: node-2",
  "    shape: process",
  "    text: bob",
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

const freeDrawingContent = [
  "---",
  "type: diagram",
  "title: 図解ファイル",
  "---",
  "",
  "nodes:",
  "  - id: node-1",
  "    shape: process",
  "    text: 主人公",
  "    x: 120",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "  - id: node-2",
  "    shape: decision",
  "    text: 敵対組織",
  "    x: 380",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "lines:",
  "  - id: line-1",
  "    from: node-1",
  "    to: node-2",
  "    label: 対立",
  ""
].join("\n");

const freeDrawingDecisionWithTwoOutputs = [
  "---",
  "type: diagram",
  "title: 図解ファイル",
  "---",
  "",
  "nodes:",
  "  - id: decision-1",
  "    shape: decision",
  "    text: 判断",
  "    x: 280",
  "    y: 160",
  "    width: 180",
  "    height: 120",
  "  - id: target-1",
  "    shape: process",
  "    text: はい先",
  "    x: 560",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "  - id: target-2",
  "    shape: process",
  "    text: いいえ先",
  "    x: 560",
  "    y: 240",
  "    width: 180",
  "    height: 80",
  "  - id: target-3",
  "    shape: process",
  "    text: 三本目",
  "    x: 560",
  "    y: 400",
  "    width: 180",
  "    height: 80",
  "lines:",
  "  - id: line-1",
  "    from: decision-1",
  "    to: target-1",
  "    label: はい",
  "  - id: line-2",
  "    from: decision-1",
  "    to: target-2",
  "    label: いいえ",
  ""
].join("\n");

const freeDrawingDecisionWithThreeOutputs = [
  ...freeDrawingDecisionWithTwoOutputs.split("\n").slice(0, -1),
  "  - id: line-3",
  "    from: decision-1",
  "    to: target-3",
  "    label: 選択肢3",
  ""
].join("\n");

const freeDrawingContentWithArea = [
  "---",
  "type: diagram",
  "title: 閾ｪ逕ｱ蝗ｳ",
  "---",
  "",
  "nodes:",
  "  - id: area-1",
  "    shape: area",
  "    text: 領域A",
  "    x: 100",
  "    y: 100",
  "    width: 300",
  "    height: 200",
  "    layer: -1",
  "  - id: inside-1",
  "    shape: process",
  "    text: 内側",
  "    x: 140",
  "    y: 140",
  "    width: 120",
  "    height: 80",
  "    layer: 0",
  "  - id: outside-1",
  "    shape: process",
  "    text: 外側",
  "    x: 420",
  "    y: 140",
  "    width: 120",
  "    height: 80",
  "    layer: 0",
  "lines: []",
  ""
].join("\n");

function renderDiagramCanvas(content = diagramContent, onSourceModeToggle?: () => void, onStatusChange?: (status: string) => void) {
  render(
    <I18nProvider language="en">
      <DiagramCanvas content={content} fileName="World" onSourceModeToggle={onSourceModeToggle} onStatusChange={onStatusChange} />
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

function mockRect(element: Element, rect: { bottom: number; height: number; left: number; right: number; top: number; width: number }): void {
  element.getBoundingClientRect = () => ({
    ...rect,
    x: rect.left,
    y: rect.top,
    toJSON: () => rect
  });
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
    expect(screen.queryByRole("button", { name: "Add connected shape" })).not.toBeInTheDocument();
    const line = container.querySelector(".diagram-canvas-line");
    expect(line?.getAttribute("d")).toBe("M 372 232 L 452 232");
    expect(line?.getAttribute("marker-end")).toMatch(/^url\(#diagram-canvas-arrow-/);
  });

  it("renders opposite diagram lines as separate paths", () => {
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithOppositeLines} fileName="World" />
      </I18nProvider>
    );

    const lines = Array.from(container.querySelectorAll(".diagram-canvas-line"));
    expect(lines.map((line) => line.getAttribute("d"))).toEqual([
      "M 372 220 L 452 220",
      "M 452 244 L 372 244"
    ]);
  });

  it("keeps selection-specific actions out of the fixed canvas toolbar", () => {
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" />
      </I18nProvider>
    );
    const toolbar = screen.getByLabelText("Diagram editing tools");

    expect(within(toolbar).getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(within(toolbar).getByLabelText("Current zoom")).toHaveTextContent("100%");
    expect(within(toolbar).queryByRole("button", { name: "Duplicate" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Selected shape tools")).not.toBeInTheDocument();
  });

  it("shows node-specific actions from the explicit node context menu", () => {
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={vi.fn()} />
      </I18nProvider>
    );
    const node = freeDrawingNode("alice");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.contextMenu(node, { clientX: 120, clientY: 80 });

    const menu = screen.getByRole("menu");
    expect(within(menu).queryByRole("button", { name: "Edit text" })).not.toBeInTheDocument();
    const copyItem = within(menu).getByRole("menuitem", { name: "Copy" });
    expect(copyItem.querySelector(".diagram-canvas-action-icon")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Duplicate" }).querySelector(".diagram-canvas-action-icon")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Delete" }).querySelector(".diagram-canvas-action-icon")).toBeInTheDocument();
    expect(screen.queryByLabelText("Selected line tools")).not.toBeInTheDocument();
  });

  it("opens the node context menu from the keyboard and closes it without clearing selection", () => {
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={vi.fn()} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("application", { name: "World" });
    const node = freeDrawingNode("alice");

    fireEvent(node, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(node, pointerEvent("pointerup", 1, 10, 10));
    fireEvent.keyDown(canvas, { key: "F10", shiftKey: true });

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(node).toHaveClass("diagram-canvas-node--selected");

    fireEvent.keyDown(canvas, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(node).toHaveClass("diagram-canvas-node--selected");

    fireEvent.contextMenu(node, { clientX: 120, clientY: 80 });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent(container.querySelector(".diagram-canvas-space") as Element, pointerEvent("pointerdown", 2, 5, 5));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(node).toHaveClass("diagram-canvas-node--selected");
  });

  it("shows line endpoint handles and line actions from the explicit line context menu", () => {
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={vi.fn()} />
      </I18nProvider>
    );
    const line = container.querySelector(".diagram-canvas-line-hit");
    expect(line).toBeInstanceOf(Element);

    fireEvent(line as Element, pointerEvent("pointerdown", 4, 10, 10));

    expect(screen.getByRole("button", { name: "Change line start" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change line end" })).toBeInTheDocument();
    fireEvent.contextMenu(line as Element, { clientX: 260, clientY: 120 });
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByRole("button", { name: "Edit line label" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Reverse arrow direction" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Selected shape tools")).not.toBeInTheDocument();
  });

  it("reports selection-specific status text to the parent status bar", () => {
    const onStatusChange = vi.fn();
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={vi.fn()} onStatusChange={onStatusChange} />
      </I18nProvider>
    );

    expect(onStatusChange).toHaveBeenLastCalledWith("2 shapes / 1 line");

    const node = freeDrawingNode("alice");
    fireEvent(node, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(node, pointerEvent("pointerup", 1, 10, 10));
    expect(onStatusChange).toHaveBeenLastCalledWith("1 shape selected");

    const line = container.querySelector(".diagram-canvas-line-hit");
    expect(line).toBeInstanceOf(Element);
    fireEvent(line as Element, pointerEvent("pointerdown", 4, 10, 10));
    expect(onStatusChange).toHaveBeenLastCalledWith("1 line selected");
  });

  it("uses translated shape names and selection state in node aria labels", () => {
    render(
      <I18nProvider language="ja">
        <DiagramCanvas content={freeDrawingContent} fileName="図解ファイル" onChange={vi.fn()} />
      </I18nProvider>
    );

    const node = screen.getByRole("button", { name: /主人公、処理、未選択/ });
    expect(node).toBeInTheDocument();

    fireEvent(node, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(node, pointerEvent("pointerup", 1, 10, 10));
    expect(screen.getByRole("button", { name: /主人公、処理、選択中/ })).toBeInTheDocument();
  });

  it("exposes rejection notices as a live status region", () => {
    render(
      <I18nProvider language="ja">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={vi.fn()} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("application", { name: /World/ });
    const alice = freeDrawingNode("alice");
    fireEvent(alice, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(alice, pointerEvent("pointerup", 1, 10, 10));
    const outline = alice.querySelector(".diagram-canvas-node-outline-hit--right");
    expect(outline).toBeInstanceOf(Element);

    fireEvent(outline as Element, pointerEvent("pointerdown", 3, 300, 120));
    fireEvent(canvas, pointerEvent("pointermove", 3, 340, 120));
    fireEvent(alice, pointerEvent("pointerup", 3, 340, 120));

    expect(screen.getByRole("status")).toHaveTextContent("同じ図形同士は接続できません。");
  });

  it("renders diagram text nodes and edits their text in Markdown", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={freeDrawingContent} onChange={onChange} />);

    const textNode = screen.getByText("主人公");
    expect(textNode).toBeInTheDocument();
    expect(screen.getByText("敵対組織")).toBeInTheDocument();
    expect(screen.getByText("対立")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Node" })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("主人公")).not.toBeInTheDocument();

    fireEvent.doubleClick(textNode);
    const input = screen.getByDisplayValue("主人公");
    fireEvent.change(input, { target: { value: "自由メモ" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("text: 自由メモ"));
  });

  it("moves a diagram node by dragging its shape body", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={freeDrawingContent} fileName="図解ファイル" onChange={onChange} />
      </I18nProvider>
    );
    const node = freeDrawingNode("主人公");

    fireEvent(node, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(node, pointerEvent("pointermove", 2, 50, 30));
    fireEvent(node, pointerEvent("pointerup", 2, 50, 30));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 152");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 112");
    expect(onChange.mock.calls[0]?.[0]).toContain("text: 主人公");
  });

  it("resizes a selected diagram shape with the resize handle", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={freeDrawingContent} fileName="図解ファイル" onChange={onChange} />
      </I18nProvider>
    );
    const decision = freeDrawingNode("敵対組織");
    expect(decision).toHaveClass("diagram-canvas-node--shape-decision");

    fireEvent(decision, pointerEvent("pointerdown", 2, 390, 90));
    fireEvent(decision, pointerEvent("pointerup", 2, 390, 90));
    const resizeHandle = screen.getByRole("button", { name: "Resize node" });

    fireEvent(resizeHandle, pointerEvent("pointerdown", 3, 560, 160));
    fireEvent(decision, pointerEvent("pointermove", 3, 620, 190));
    fireEvent(decision, pointerEvent("pointerup", 3, 620, 190));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("shape: decision");
    expect(onChange.mock.calls[0]?.[0]).toContain("width: 256");
    expect(onChange.mock.calls[0]?.[0]).toContain("height: 96");
  });

  it("drops a flowchart shape onto a diagram canvas", () => {
    const onChange = vi.fn();
    const emptyFreeDrawing = "---\ntype: diagram\n---\n\nnodes: []\nlines: []\n";
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={emptyFreeDrawing} fileName="図解ファイル" onChange={onChange} />
      </I18nProvider>
    );

    const canvas = container.querySelector(".diagram-canvas") as HTMLElement;
    expect(canvas).toBeInstanceOf(HTMLElement);
    mockRect(canvas, { bottom: 620, height: 620, left: 0, right: 900, top: 0, width: 900 });
    const dataTransfer = {
      dropEffect: "",
      getData: vi.fn(() => "decision"),
      types: [diagramShapeDragType]
    };

    const dragOver = createEvent.dragOver(canvas, { clientX: 240, clientY: 160 });
    Object.defineProperty(dragOver, "clientX", { value: 240 });
    Object.defineProperty(dragOver, "clientY", { value: 160 });
    Object.defineProperty(dragOver, "dataTransfer", { value: dataTransfer });
    fireEvent(canvas, dragOver);
    const drop = createEvent.drop(canvas, { clientX: 240, clientY: 160 });
    Object.defineProperty(drop, "clientX", { value: 240 });
    Object.defineProperty(drop, "clientY", { value: 160 });
    Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
    fireEvent(canvas, drop);

    expect(dataTransfer.getData).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("shape: decision");
    expect(onChange.mock.calls[0]?.[0]).toContain("text: 判断");
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 160");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 128");
    expect(onChange.mock.calls[0]?.[0]).toContain("width: 160");
    expect(onChange.mock.calls[0]?.[0]).toContain("height: 64");
  });

  it("shows a start panel on an empty Diagram and adds the first shape from it", () => {
    const onChange = vi.fn();
    const emptyFreeDrawing = "---\ntype: diagram\n---\n\nnodes: []\nlines: []\n";
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={emptyFreeDrawing} fileName="図解ファイル" onChange={onChange} />
      </I18nProvider>
    );

    expect(screen.queryByText("Add a shape to begin")).not.toBeInTheDocument();
    expect(screen.queryByText("Choose a shape, or drag one from the palette on the left onto the canvas.")).not.toBeInTheDocument();

    const menu = screen.getByRole("menu", { name: "Shape to add" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Process" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("shape: process");
    expect(onChange.mock.calls[0]?.[0]).not.toContain("pan");
    expect(onChange.mock.calls[0]?.[0]).not.toContain("zoom");
  });

  it("adds a sidebar-requested shape at the visible canvas center", () => {
    const onChange = vi.fn();
    const emptyFreeDrawing = "---\ntype: diagram\n---\n\nnodes: []\nlines: []\n";
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={emptyFreeDrawing} fileName="図解ファイル" onChange={onChange} />
      </I18nProvider>
    );
    const canvas = container.querySelector(".diagram-canvas") as HTMLElement;
    mockRect(canvas, { bottom: 620, height: 620, left: 0, right: 900, top: 0, width: 900 });
    const detail = { handled: false, shape: "terminator" as const };

    window.dispatchEvent(new CustomEvent("relic-diagram-shape-add", { detail }));

    expect(detail.handled).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("shape: terminator");
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 384");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 288");
  });

  it("does not offer a connected-shape add menu from a selected diagram node", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={freeDrawingContent} onChange={onChange} />);

    const source = freeDrawingNode("主人公");

    fireEvent(source, pointerEvent("pointerdown", 2, 130, 90));
    fireEvent(source, pointerEvent("pointerup", 2, 130, 90));

    expect(screen.queryByRole("button", { name: "Add connected shape" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menu", { name: "Shape to connect" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps shape creation in the empty-canvas palette instead of a connected shape menu", () => {
    const onChange = vi.fn();
    const emptyFreeDrawing = "---\ntype: diagram\n---\n\nnodes: []\nlines: []\n";
    render(<StatefulDiagramCanvas content={emptyFreeDrawing} onChange={onChange} />);

    const menu = screen.getByRole("menu", { name: "Shape to add" });
    expect(within(menu).queryByRole("menuitem", { name: "Label" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("adds a YES standard choice label when connecting from a decision shape port", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={freeDrawingContent} onChange={onChange} />);
    const canvas = screen.getByRole("application", { name: "World" });

    const source = freeDrawingNode("敵対組織");
    const target = freeDrawingNode("主人公");

    fireEvent(source, pointerEvent("pointerdown", 2, 390, 90));
    fireEvent(source, pointerEvent("pointerup", 2, 390, 90));
    const outline = source.querySelector(".diagram-canvas-node-outline-hit--right");
    expect(outline).toBeInstanceOf(HTMLElement);

    fireEvent(outline as HTMLElement, pointerEvent("pointerdown", 3, 560, 120));
    fireEvent(canvas, pointerEvent("pointermove", 3, 180, 120));
    fireEvent(target, pointerEvent("pointerup", 3, 180, 120));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("from: node-2");
    expect(onChange.mock.calls[0]?.[0]).toContain("to: node-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("label: 'YES'");
  });

  it("adds a NO standard choice label for the second decision outgoing line", () => {
    const onChange = vi.fn();
    const oneDecisionOutputContent = [
      "---",
      "type: diagram",
      "title: 図解ファイル",
      "---",
      "",
      "nodes:",
      "  - id: node-1",
      "    shape: decision",
      "    text: 判断",
      "    x: 120",
      "    y: 80",
      "    width: 180",
      "    height: 80",
      "  - id: node-2",
      "    shape: process",
      "    text: YES先",
      "    x: 380",
      "    y: 80",
      "    width: 180",
      "    height: 80",
      "  - id: node-3",
      "    shape: process",
      "    text: NO先",
      "    x: 380",
      "    y: 240",
      "    width: 180",
      "    height: 80",
      "lines:",
      "  - id: line-1",
      "    from: node-1",
      "    to: node-2",
      "    label: YES",
      ""
    ].join("\n");
    render(<StatefulDiagramCanvas content={oneDecisionOutputContent} onChange={onChange} />);

    const canvas = screen.getByRole("application", { name: "World" });
    const source = freeDrawingNode("判断");
    const target = freeDrawingNode("NO先");

    fireEvent(source, pointerEvent("pointerdown", 2, 130, 90));
    fireEvent(source, pointerEvent("pointerup", 2, 130, 90));
    const outline = source.querySelector(".diagram-canvas-node-outline-hit--right");
    expect(outline).toBeInstanceOf(HTMLElement);

    fireEvent(outline as HTMLElement, pointerEvent("pointerdown", 3, 300, 120));
    fireEvent(canvas, pointerEvent("pointermove", 3, 430, 280));
    fireEvent(target, pointerEvent("pointerup", 3, 430, 280));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("from: node-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("to: node-3");
    expect(onChange.mock.calls[0]?.[0]).toContain("label: 'NO'");
  });

  it("does not offer connected shapes from a decision with two outgoing lines", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={freeDrawingDecisionWithTwoOutputs} fileName="図解ファイル" onChange={onChange} />
      </I18nProvider>
    );

    const decision = freeDrawingNode("判断");

    fireEvent(decision, pointerEvent("pointerdown", 2, 300, 180));
    fireEvent(decision, pointerEvent("pointerup", 2, 300, 180));

    expect(screen.queryByRole("button", { name: "Add connected shape" })).not.toBeInTheDocument();
  });

  it("does not add a third outgoing line from a decision shape by dragging its outline", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={freeDrawingDecisionWithTwoOutputs} fileName="図解ファイル" onChange={onChange} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("application", { name: "図解ファイル" });
    const decision = freeDrawingNode("判断");
    const thirdTarget = freeDrawingNode("三本目");

    fireEvent(decision, pointerEvent("pointerdown", 2, 300, 180));
    fireEvent(decision, pointerEvent("pointerup", 2, 300, 180));
    const outline = decision.querySelector(".diagram-canvas-node-outline-hit--right");
    expect(outline).toBeInstanceOf(HTMLElement);

    fireEvent(outline as HTMLElement, pointerEvent("pointerdown", 3, 460, 220));
    fireEvent(canvas, pointerEvent("pointermove", 3, 580, 420));
    fireEvent(thirdTarget, pointerEvent("pointerup", 3, 580, 420));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("hides the third outgoing decision line from display and line hit targets", () => {
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={freeDrawingDecisionWithThreeOutputs} fileName="図解ファイル" />
      </I18nProvider>
    );

    expect(container.querySelectorAll(".diagram-canvas-line")).toHaveLength(2);
    expect(container.querySelectorAll(".diagram-canvas-line-hit")).toHaveLength(2);
    expect(screen.getByText("はい")).toBeInTheDocument();
    expect(screen.getByText("いいえ")).toBeInTheDocument();
    expect(screen.queryByText("選択肢3")).not.toBeInTheDocument();
  });

  it("does not show variable layer controls for diagram shapes", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={freeDrawingContent} onChange={onChange} />);

    const source = freeDrawingNode("主人公");
    expect(screen.queryByText("Layer 1")).not.toBeInTheDocument();

    fireEvent(source, pointerEvent("pointerdown", 2, 130, 90));
    fireEvent(source, pointerEvent("pointerup", 2, 130, 90));

    expect(screen.queryByText(/Layer/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send backward" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bring forward" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("drops an area shape onto a diagram canvas", () => {
    const onChange = vi.fn();
    const emptyFreeDrawing = "---\ntype: diagram\n---\n\nnodes: []\nlines: []\n";
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={emptyFreeDrawing} fileName="図解ファイル" onChange={onChange} />
      </I18nProvider>
    );

    const canvas = container.querySelector(".diagram-canvas") as HTMLElement;
    expect(canvas).toBeInstanceOf(HTMLElement);
    mockRect(canvas, { bottom: 620, height: 620, left: 0, right: 900, top: 0, width: 900 });
    const dataTransfer = {
      dropEffect: "",
      getData: vi.fn(() => "area"),
      types: [diagramShapeDragType]
    };

    const drop = createEvent.drop(canvas, { clientX: 320, clientY: 240 });
    Object.defineProperty(drop, "clientX", { value: 320 });
    Object.defineProperty(drop, "clientY", { value: 240 });
    Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
    fireEvent(canvas, drop);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("shape: area");
    expect(onChange.mock.calls[0]?.[0]).toContain("text: 領域");
    expect(onChange.mock.calls[0]?.[0]).toContain("width: 384");
    expect(onChange.mock.calls[0]?.[0]).toContain("height: 224");
    expect(onChange.mock.calls[0]?.[0]).toContain("layer: 0");
  });

  it("keeps background area shapes interactive with a safe z-index", () => {
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={freeDrawingContentWithArea} fileName="閾ｪ逕ｱ蝗ｳ" />
      </I18nProvider>
    );

    const area = freeDrawingNode("領域A");
    expect(area.style.zIndex).toBe("100");
    expect(area.style.getPropertyValue("--diagram-node-elevation-shadow")).toBe("0 0 0 rgba(15, 23, 42, 0)");
  });

  it("does not show layer controls for area shapes because layers are fixed", () => {
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={freeDrawingContentWithArea} fileName="閾ｪ逕ｱ蝗ｳ" />
      </I18nProvider>
    );

    const area = freeDrawingNode("領域A");

    fireEvent(area, pointerEvent("pointerdown", 2, 110, 110));
    fireEvent(area, pointerEvent("pointerup", 2, 110, 110));

    expect(screen.queryByRole("button", { name: "Bring forward" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send backward" })).not.toBeInTheDocument();
  });

  it("normalizes old diagram node layers to the fixed shape layer", () => {
    const layeredContent = [
      "---",
      "type: diagram",
      "title: 図解ファイル",
      "---",
      "",
      "nodes:",
      "  - id: low-1",
      "    shape: process",
      "    text: 低い",
      "    x: 120",
      "    y: 80",
      "    width: 180",
      "    height: 80",
      "    layer: 1",
      "  - id: high-1",
      "    shape: process",
      "    text: 高い",
      "    x: 380",
      "    y: 80",
      "    width: 180",
      "    height: 80",
      "    layer: 4",
      "lines: []",
      ""
    ].join("\n");

    render(
      <I18nProvider language="en">
        <DiagramCanvas content={layeredContent} fileName="図解ファイル" />
      </I18nProvider>
    );

    const lowNode = freeDrawingNode("低い");
    const highNode = freeDrawingNode("高い");

    const lowTransform = lowNode.style.transform;
    const highTransform = highNode.style.transform;
    expect(lowTransform).toMatch(/^translate\([-.\d]+px, [-.\d]+px\)$/);
    expect(highTransform).toMatch(/^translate\([-.\d]+px, [-.\d]+px\)$/);
    expect(lowTransform.split(", ")[1]).toBe(highTransform.split(", ")[1]);
    expect(lowNode.style.zIndex).toBe("101");
    expect(highNode.style.zIndex).toBe("101");
    expect(lowNode.style.getPropertyValue("--diagram-node-elevation-shadow")).toBe("0 8px 24px rgba(15, 23, 42, 0.1)");
    expect(highNode.style.getPropertyValue("--diagram-node-elevation-shadow")).toBe("0 8px 24px rgba(15, 23, 42, 0.1)");
    expect(lowNode.style.getPropertyValue("--diagram-node-layer-border")).toBe("color-mix(in srgb, var(--text-3) 64%, var(--border-medium))");
    expect(highNode.style.getPropertyValue("--diagram-node-layer-border")).toBe("color-mix(in srgb, var(--text-3) 64%, var(--border-medium))");
  });

  it("ignores old layer 8 values in the diagram UI", () => {
    const maxLayerContent = [
      "---",
      "type: diagram",
      "title: 図解ファイル",
      "---",
      "",
      "nodes:",
      "  - id: max-1",
      "    shape: process",
      "    text: 最大",
      "    x: 120",
      "    y: 80",
      "    width: 180",
      "    height: 80",
      "    layer: 8",
      "lines: []",
      ""
    ].join("\n");
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={maxLayerContent} fileName="図解ファイル" onChange={onChange} />
      </I18nProvider>
    );

    const node = freeDrawingNode("最大");

    fireEvent(node, pointerEvent("pointerdown", 2, 130, 90));
    fireEvent(node, pointerEvent("pointerup", 2, 130, 90));

    expect(node.style.zIndex).toBe("101");
    expect(screen.queryByText(/Layer/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bring forward" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send backward" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps all non-area diagram shapes on the fixed shape layer while selected", () => {
    const layeredContent = [
      "---",
      "type: diagram",
      "title: 図解ファイル",
      "---",
      "",
      "nodes:",
      "  - id: low-1",
      "    shape: process",
      "    text: 低い",
      "    x: 120",
      "    y: 80",
      "    width: 180",
      "    height: 80",
      "    layer: 1",
      "  - id: high-1",
      "    shape: process",
      "    text: 高い",
      "    x: 380",
      "    y: 80",
      "    width: 180",
      "    height: 80",
      "    layer: 4",
      "lines: []",
      ""
    ].join("\n");
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={layeredContent} fileName="図解ファイル" onChange={onChange} />
      </I18nProvider>
    );

    const lowNode = freeDrawingNode("低い");
    const highNode = freeDrawingNode("高い");

    fireEvent(lowNode, pointerEvent("pointerdown", 2, 130, 90));
    fireEvent(lowNode, pointerEvent("pointerup", 2, 130, 90));

    expect(lowNode).toHaveClass("diagram-canvas-node--selected");
    expect(highNode).not.toHaveClass("diagram-canvas-node--layer-above-selected");
    expect(lowNode.style.zIndex).toBe("101");
    expect(highNode.style.zIndex).toBe("101");

    fireEvent(highNode, pointerEvent("pointerdown", 3, 390, 90));
    fireEvent(highNode, pointerEvent("pointerup", 3, 390, 90));

    expect(highNode).toHaveClass("diagram-canvas-node--selected");
    expect(lowNode).not.toHaveClass("diagram-canvas-node--layer-below-selected");
  });

  it("renders diagram line labels separately from fixed node labels", () => {
    const layeredContent = [
      "---",
      "type: diagram",
      "title: 図解ファイル",
      "---",
      "",
      "nodes:",
      "  - id: low-1",
      "    shape: process",
      "    text: 低い",
      "    x: 120",
      "    y: 80",
      "    width: 180",
      "    height: 80",
      "    layer: 1",
      "  - id: high-1",
      "    shape: process",
      "    text: 高い",
      "    x: 380",
      "    y: 80",
      "    width: 180",
      "    height: 80",
      "    layer: 4",
      "lines:",
      "  - id: line-1",
      "    from: low-1",
      "    to: high-1",
      "    label: 高低",
      ""
    ].join("\n");
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={layeredContent} fileName="図解ファイル" />
      </I18nProvider>
    );

    const line = container.querySelector(".diagram-canvas-line");
    const lineSvg = line?.closest(".diagram-canvas-lines");
    const lineLabel = screen.getByText("高低").closest(".diagram-canvas-line-controls");
    const lowNodeLabel = screen.getByText("低い").closest(".diagram-canvas-node-label-frame");
    const highNodeLabel = screen.getByText("高い").closest(".diagram-canvas-node-label-frame");
    expect(lineSvg).toBeInstanceOf(SVGSVGElement);
    expect(lineLabel).toBeInstanceOf(HTMLElement);
    expect(lowNodeLabel).toBeInstanceOf(HTMLElement);
    expect(highNodeLabel).toBeInstanceOf(HTMLElement);
    expect((lineSvg as SVGSVGElement).style.zIndex).toBe("101");
    expect((lineLabel as HTMLElement).style.zIndex).toBe("101");
    expect((lowNodeLabel as HTMLElement).style.zIndex).toBe("102");
    expect((highNodeLabel as HTMLElement).style.zIndex).toBe("102");
  });

  it("moves nodes fully contained in an area when dragging the area", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={freeDrawingContentWithArea} fileName="閾ｪ逕ｱ蝗ｳ" onChange={onChange} />
      </I18nProvider>
    );
    const area = freeDrawingNode("領域A");

    fireEvent(area, pointerEvent("pointerdown", 2, 110, 110));
    fireEvent(area, pointerEvent("pointermove", 2, 142, 174));
    fireEvent(area, pointerEvent("pointerup", 2, 142, 174));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("id: area-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 132");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 164");
    expect(onChange.mock.calls[0]?.[0]).toContain("id: inside-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 172");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 204");
    expect(onChange.mock.calls[0]?.[0]).toContain("id: outside-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 420");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 140");
  });

  it("duplicates copied diagram nodes and keeps undo redo history in the canvas", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={diagramContent} onChange={onChange} />);
    const canvas = screen.getByRole("application", { name: "World" });
    const alice = freeDrawingNode("alice");

    fireEvent(alice, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice, pointerEvent("pointerup", 2, 10, 10));
    fireEvent.keyDown(canvas, { ctrlKey: true, key: "c" });
    fireEvent.keyDown(canvas, { ctrlKey: true, key: "v" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("id: node-3");
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 152");
    expect(onChange.mock.calls[0]?.[0]).not.toContain("id: line-2");

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1]?.[0]).not.toContain("id: node-3");

    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange.mock.calls[2]?.[0]).toContain("id: node-3");
  });

  it("changes the selected diagram shape from the node context menu", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={diagramContent} onChange={onChange} />);
    const alice = freeDrawingNode("alice");

    fireEvent(alice, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice, pointerEvent("pointerup", 2, 10, 10));
    fireEvent.contextMenu(alice, { clientX: 120, clientY: 80 });
    fireEvent.change(screen.getByLabelText("Shape"), { target: { value: "decision" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("id: node-1\n    shape: decision");
  });

  it("deletes multiple selected diagram nodes together", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={diagramContent} onChange={onChange} />);
    const canvas = screen.getByRole("application", { name: "World" });
    const alice = freeDrawingNode("alice");
    const bob = freeDrawingNode("bob");

    fireEvent(alice, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice, pointerEvent("pointerup", 2, 10, 10));
    fireEvent(bob, pointerEvent("pointerdown", 3, 390, 90, { shiftKey: true }));
    fireEvent(bob, pointerEvent("pointerup", 3, 390, 90, { shiftKey: true }));
    fireEvent.keyDown(canvas, { key: "Delete" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).not.toContain("id: node-1");
    expect(onChange.mock.calls[0]?.[0]).not.toContain("id: node-2");
    expect(onChange.mock.calls[0]?.[0]).not.toContain("id: line-1");
  });

  it("creates a diagram line from the keyboard", () => {
    const onChange = vi.fn();
    render(<StatefulDiagramCanvas content={diagramContentWithoutLines} onChange={onChange} />);
    const canvas = screen.getByRole("application", { name: "World" });
    const alice = freeDrawingNode("alice");
    const bob = freeDrawingNode("bob");

    fireEvent(alice, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice, pointerEvent("pointerup", 2, 10, 10));
    fireEvent.keyDown(canvas, { key: "l" });
    expect(screen.getByText("Select a target shape and press L again to connect.")).toBeInTheDocument();

    fireEvent(bob, pointerEvent("pointerdown", 3, 390, 90));
    fireEvent(bob, pointerEvent("pointerup", 3, 390, 90));
    fireEvent.keyDown(canvas, { key: "l" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("from: node-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("to: node-2");
  });

  it("does not show the Mermaid copy action in Diagram mode", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    renderDiagramCanvas();

    expect(screen.queryByRole("button", { name: "Copy Mermaid source" })).not.toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("shows parse details and source mode action for invalid Diagram Markdown", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const onSourceModeToggle = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    renderDiagramCanvas("---\ntype: diagram\n---\n\nnotes: body", onSourceModeToggle);

    expect(screen.getByRole("alert")).toHaveTextContent("Could not read this Diagram file. Check the source.");
    expect(screen.getByText("DIAGRAM_UNKNOWN_FIELD")).toBeInTheDocument();
    expect(screen.getByText("Unsupported field")).toBeInTheDocument();
    expect(screen.getByText("This file contains a field that the current Diagram format does not support.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy error details" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("code: DIAGRAM_UNKNOWN_FIELD"));

    fireEvent.click(screen.getByRole("button", { name: "Open in source mode" }));
    expect(onSourceModeToggle).toHaveBeenCalledTimes(1);
  });

  it("shows line and column when Diagram YAML details include a location", () => {
    renderDiagramCanvas("---\ntype: diagram\n---\n\nnodes:\n  - id: node-1\n    shape: process\n    text: Alice\n    x: [\nlines: []");

    expect(screen.getByText("YAML syntax")).toBeInTheDocument();
    expect(screen.getByText(/Line \d+, column \d+/)).toBeInTheDocument();
  });

  it("commits moved node coordinates on pointer up", () => {
    const onChange = vi.fn();
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const node = freeDrawingNode("alice");
    expect(node).toBeInstanceOf(HTMLElement);

    fireEvent(node as HTMLElement, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(node as HTMLElement, pointerEvent("pointermove", 1, 50, 30));

    const dropPreview = container.querySelector(".diagram-canvas-drop-preview") as HTMLElement | null;
    expect(dropPreview).toBeInTheDocument();
    expect(dropPreview?.style.left).toBe("224px");
    expect(dropPreview?.style.top).toBe("224px");
    expect(dropPreview?.style.width).toBe("180px");
    expect(dropPreview?.style.height).toBe("80px");
    expect((node as HTMLElement).style.transform).toContain("translate(232px, 212px)");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent(node as HTMLElement, pointerEvent("pointerup", 1, 50, 30));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 152");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 112");
  });

  it("snaps moved nodes to nearby node edges and only saves the final position", () => {
    const onChange = vi.fn();
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const node = freeDrawingNode("alice");
    expect(node).toBeInstanceOf(HTMLElement);

    fireEvent(node as HTMLElement, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(node as HTMLElement, pointerEvent("pointermove", 1, 92, 10));

    expect(container.querySelector(".diagram-canvas-snap-guides line")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent(node as HTMLElement, pointerEvent("pointerup", 1, 92, 10));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 216");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 80");
    expect(onChange.mock.calls[0]?.[0]).not.toContain("snap");
  });

  it("keeps the diagram viewport stable when a committed node move expands the canvas origin", () => {
    const onChange = vi.fn();
    const { container } = render(<StatefulDiagramCanvas content={diagramContentWithoutLines} onChange={onChange} />);
    const node = freeDrawingNode("alice");
    const space = container.querySelector(".diagram-canvas-space");
    expect(node).toBeInstanceOf(HTMLElement);
    expect(space).toBeInstanceOf(HTMLElement);

    fireEvent(node as HTMLElement, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(node as HTMLElement, pointerEvent("pointermove", 1, -50, 10));
    fireEvent(node as HTMLElement, pointerEvent("pointerup", 1, -50, 10));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 56");
    expect((space as HTMLElement).style.transform).toContain("translate(-64px, 0px)");
  });

  it("does not navigate away from the Diagram when a node is double clicked", () => {
    const onOpenFile = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" />
      </I18nProvider>
    );
    const node = freeDrawingNode("alice");
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
    const canvas = screen.getByRole("application", { name: "World" });
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
    const canvas = screen.getByRole("application", { name: "World" });
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
    const canvas = screen.getByRole("application", { name: "World" });
    const space = container.querySelector(".diagram-canvas-space");
    expect(space).toBeInstanceOf(HTMLElement);

    fireEvent.wheel(canvas, { clientX: 100, clientY: 100, deltaY: -100 });

    expect((space as HTMLElement).style.transform).toContain("scale(1.1)");
  });

  it("renders the diagram grid as the full canvas background instead of a transformed content patch", () => {
    const css = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");

    expect(css).toMatch(/\.diagram-canvas\s*\{[^}]*background-color:\s*var\(--bg\);/s);
    expect(css).toMatch(/\.diagram-canvas\s*\{[^}]*linear-gradient\(var\(--border-soft\) 1px, transparent 1px\)[^}]*background-position:[^}]*var\(--diagram-canvas-grid-x, 0\) var\(--diagram-canvas-grid-y, 0\)[^}]*background-size:[^}]*var\(--diagram-canvas-grid-size, 32px\)/s);
    expect(css).not.toMatch(/\.diagram-canvas-space\s*\{[^}]*linear-gradient\(var\(--border-soft\) 1px, transparent 1px\)/s);
  });

  it("does not show rectangular selection frames around non-rectangular diagram shapes", () => {
    const css = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");

    expect(css).toMatch(/\.diagram-canvas-node--selected\.diagram-canvas-node--shape-decision,\s*\.diagram-canvas-node--selected\.diagram-canvas-node--shape-input-output\s*\{[^}]*box-shadow:\s*none;/s);
    expect(css).toMatch(/\.diagram-canvas-node--dragging\.diagram-canvas-node--shape-decision,\s*\.diagram-canvas-node--dragging\.diagram-canvas-node--shape-input-output\s*\{[^}]*box-shadow:\s*none;/s);
  });

  it("keeps area shape fill translucent without fading the whole shape", () => {
    const css = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");

    expect(css).toMatch(/\.diagram-canvas-node--shape-area\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--accent\) 14%, transparent\);/s);
    expect(css).not.toMatch(/\.diagram-canvas-node--shape-area\s*\{[^}]*opacity:/s);
  });

  it("keeps the fixed diagram toolbar compact and icon-led", () => {
    const css = readFileSync("src/renderer/styles/workspace-editor.css", "utf8");

    expect(css).toMatch(/\.diagram-canvas-toolbar \.diagram-canvas-icon-button\s*\{[^}]*height:\s*30px;[^}]*width:\s*30px;/s);
    expect(css).toMatch(/\.diagram-canvas-action-icon\s*\{[^}]*display:\s*block;[^}]*flex:\s*0 0 auto;/s);
    expect(css).toMatch(/\.diagram-canvas-toolbar-separator\s*\{[^}]*width:\s*1px;/s);
    expect(css).not.toMatch(/\.diagram-canvas-context-toolbar/);
  });

  it("moves and scales the diagram grid with the viewport", () => {
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" />
      </I18nProvider>
    );
    const canvas = screen.getByRole("application", { name: "World" }) as HTMLElement;

    expect(canvas.style.getPropertyValue("--diagram-canvas-grid-size")).toBe("32px");
    expect(canvas.style.getPropertyValue("--diagram-canvas-grid-x")).toBe("0px");
    expect(canvas.style.getPropertyValue("--diagram-canvas-grid-y")).toBe("0px");

    fireEvent(canvas, pointerEvent("pointerdown", 5, 10, 10));
    fireEvent(canvas, pointerEvent("pointermove", 5, 40, 30));
    fireEvent(canvas, pointerEvent("pointerup", 5, 40, 30));

    expect(canvas.style.getPropertyValue("--diagram-canvas-grid-x")).toBe("30px");
    expect(canvas.style.getPropertyValue("--diagram-canvas-grid-y")).toBe("20px");

    fireEvent.wheel(canvas, { clientX: 100, clientY: 100, deltaY: -100 });

    expect(canvas.style.getPropertyValue("--diagram-canvas-grid-size")).toBe("35.2px");
  });

  it("commits moved node coordinates in canvas units while zoomed", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("application", { name: "World" });
    const node = freeDrawingNode("alice");
    expect(node).toBeInstanceOf(HTMLElement);

    fireEvent.wheel(canvas, { clientX: 100, clientY: 100, deltaY: -100 });
    fireEvent(node as HTMLElement, pointerEvent("pointerdown", 6, 10, 10));
    fireEvent(node as HTMLElement, pointerEvent("pointermove", 6, 54, 32));
    fireEvent(node as HTMLElement, pointerEvent("pointerup", 6, 54, 32));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 152");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 112");
  });

  it("does not rewrite Diagram Markdown when a node is clicked without moving", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const node = freeDrawingNode("alice");
    expect(node).toBeInstanceOf(HTMLElement);

    fireEvent(node as HTMLElement, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(node as HTMLElement, pointerEvent("pointerup", 1, 10, 10));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders node connection ports as direct handles", () => {
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" />
      </I18nProvider>
    );

    const alice = freeDrawingNode("alice");
    const bob = freeDrawingNode("bob");

    expect(alice.querySelectorAll(".diagram-canvas-node-outline-hit")).toHaveLength(4);
    expect(bob.querySelectorAll(".diagram-canvas-node-outline-hit")).toHaveLength(4);
  });

  it("adds a line by dragging from a selected node to another node", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("application", { name: "World" });
    const alice = freeDrawingNode("alice");
    const bob = freeDrawingNode("bob");
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
    const canvas = screen.getByRole("application", { name: "World" });
    const alice = freeDrawingNode("alice");
    const bob = freeDrawingNode("bob");
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
    const canvas = screen.getByRole("application", { name: "World" });
    const alice = freeDrawingNode("alice");
    const bob = freeDrawingNode("bob");
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

  it("shows an inline add-label target for a selected unlabeled line", () => {
    const onChange = vi.fn();
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithEmptyLabel} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const line = container.querySelector(".diagram-canvas-line-hit");
    expect(line).toBeInstanceOf(Element);

    expect(screen.queryByText("Add line label")).not.toBeInTheDocument();
    fireEvent(line as Element, pointerEvent("pointerdown", 4, 10, 10));

    expect(screen.getByText("Add line label")).toBeInTheDocument();
  });

  it("clears diagram selection with Escape without saving", () => {
    const onChange = vi.fn();
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithEmptyLabel} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("application", { name: "World" });
    const line = container.querySelector(".diagram-canvas-line-hit");
    expect(line).toBeInstanceOf(Element);

    fireEvent(line as Element, pointerEvent("pointerdown", 4, 10, 10));
    expect(screen.getByText("Add line label")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change line start" })).toBeInTheDocument();

    fireEvent.keyDown(canvas, { key: "Escape" });

    expect(screen.queryByText("Add line label")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change line start" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps Backspace inside the diagram label editor from deleting the line", () => {
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
    const alice = freeDrawingNode("alice");
    expect(alice).toBeInstanceOf(HTMLElement);

    fireEvent(alice as HTMLElement, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointermove", 2, 50, 30));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 2, 50, 30));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 152");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 112");
    expect(onChange.mock.calls[0]?.[0]).not.toContain("from: node-1");
  });

  it("moves a selected node when dragging inside the node", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const alice = freeDrawingNode("alice");
    expect(alice).toBeInstanceOf(HTMLElement);

    fireEvent(alice as HTMLElement, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 2, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointerdown", 3, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointermove", 3, 260, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 3, 260, 10));

    expect(screen.getByRole("application", { name: "World" })).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 376");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 80");
    expect(onChange.mock.calls[0]?.[0]).not.toContain("from: node-1");
  });

  it("commits selected node size on resize handle pointer up", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const alice = freeDrawingNode("alice");
    expect(alice).toBeInstanceOf(HTMLElement);

    fireEvent(alice as HTMLElement, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 2, 10, 10));
    const resizeHandle = screen.getByRole("button", { name: "Resize node" });

    fireEvent(resizeHandle, pointerEvent("pointerdown", 3, 190, 90));
    fireEvent(alice as HTMLElement, pointerEvent("pointermove", 3, 230, 110));

    const resizePreview = document.querySelector(".diagram-canvas-resize-preview") as HTMLElement | null;
    expect(resizePreview).toBeInTheDocument();
    expect(resizePreview).toHaveClass("diagram-canvas-drop-preview");
    expect(resizePreview?.style.width).toBe("224px");
    expect(resizePreview?.style.height).toBe("96px");
    expect((alice as HTMLElement).style.width).toBe("224px");
    expect((alice as HTMLElement).style.minHeight).toBe("96px");

    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 3, 230, 110));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("width: 224");
    expect(onChange.mock.calls[0]?.[0]).toContain("height: 96");
  });

  it("keeps resized node above the minimum size", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const alice = freeDrawingNode("alice");
    expect(alice).toBeInstanceOf(HTMLElement);

    fireEvent(alice as HTMLElement, pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 2, 10, 10));
    const resizeHandle = screen.getByRole("button", { name: "Resize node" });

    fireEvent(resizeHandle, pointerEvent("pointerdown", 3, 190, 90));
    fireEvent(alice as HTMLElement, pointerEvent("pointermove", 3, -500, -500));
    fireEvent(alice as HTMLElement, pointerEvent("pointerup", 3, -500, -500));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("width: 96");
    expect(onChange.mock.calls[0]?.[0]).toContain("height: 64");
  });

  it("does not move a selected node when dragging its outline without a target node", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContentWithoutLines} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("application", { name: "World" });
    const alice = freeDrawingNode("alice");
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
    const node = freeDrawingNode("alice");
    expect(node).toBeInstanceOf(HTMLElement);

    fireEvent(node as HTMLElement, pointerEvent("pointerdown", 3, 10, 10));
    fireEvent(node as HTMLElement, pointerEvent("pointerup", 3, 10, 10));
    fireEvent.keyDown(screen.getByRole("application", { name: "World" }), { key: "Delete" });

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
    fireEvent.keyDown(screen.getByRole("application", { name: "World" }), { key: "Backspace" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).not.toContain("id: line-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("id: node-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("id: node-2");
  });

  it("reverses a selected diagram line direction", () => {
    const onChange = vi.fn();
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const line = container.querySelector(".diagram-canvas-line-hit");
    expect(line).toBeInstanceOf(Element);

    expect(screen.queryByRole("menuitem", { name: "Reverse arrow direction" })).not.toBeInTheDocument();
    fireEvent(line as Element, pointerEvent("pointerdown", 4, 10, 10));
    fireEvent.contextMenu(line as Element, { clientX: 260, clientY: 120 });
    fireEvent.pointerDown(screen.getByRole("menuitem", { name: "Reverse arrow direction" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("from: node-2");
    expect(onChange.mock.calls[0]?.[0]).toContain("to: node-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("label: 幼なじみ");
  });

  it("retargets the selected line end to another node", () => {
    const onChange = vi.fn();
    const contentWithThirdNode = diagramContent.replace("lines:", [
      "  - id: node-3",
      "    shape: process",
      "    text: carol",
      "    x: 640",
      "    y: 80",
      "    width: 180",
      "    height: 80",
      "lines:"
    ].join("\n"));
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={contentWithThirdNode} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("application", { name: "World" });
    const line = container.querySelector(".diagram-canvas-line-hit");
    const carol = freeDrawingNode("carol");
    expect(line).toBeInstanceOf(Element);

    fireEvent(line as Element, pointerEvent("pointerdown", 4, 10, 10));
    const endHandle = screen.getByRole("button", { name: "Change line end" });
    fireEvent(endHandle, pointerEvent("pointerdown", 5, 570, 120));
    expect(carol).toHaveClass("diagram-canvas-node--connection-available");
    fireEvent(canvas, pointerEvent("pointermove", 5, 650, 120));
    fireEvent(carol, pointerEvent("pointerup", 5, 650, 120));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("id: line-1\n    from: node-1\n    to: node-3\n    label: 幼なじみ");
  });

  it("keeps the line unchanged when retargeting would create an invalid connection", () => {
    const onChange = vi.fn();
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("application", { name: "World" });
    const line = container.querySelector(".diagram-canvas-line-hit");
    const bob = freeDrawingNode("bob");
    expect(line).toBeInstanceOf(Element);

    fireEvent(line as Element, pointerEvent("pointerdown", 4, 10, 10));
    const startHandle = screen.getByRole("button", { name: "Change line start" });
    fireEvent(startHandle, pointerEvent("pointerdown", 5, 300, 120));
    expect(bob).toHaveClass("diagram-canvas-node--connection-blocked");
    fireEvent(canvas, pointerEvent("pointermove", 5, 420, 120));
    fireEvent(bob, pointerEvent("pointerup", 5, 420, 120));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("同じNode同士をLineでつなげません。")).toBeInTheDocument();
  });

  it("cancels line retargeting with Escape", () => {
    const onChange = vi.fn();
    const { container } = render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const canvas = screen.getByRole("application", { name: "World" });
    const line = container.querySelector(".diagram-canvas-line-hit");
    const bob = freeDrawingNode("bob");
    expect(line).toBeInstanceOf(Element);

    fireEvent(line as Element, pointerEvent("pointerdown", 4, 10, 10));
    fireEvent(screen.getByRole("button", { name: "Change line end" }), pointerEvent("pointerdown", 5, 570, 120));
    fireEvent.keyDown(canvas, { key: "Escape" });
    fireEvent(bob, pointerEvent("pointerup", 5, 420, 120));

    expect(onChange).not.toHaveBeenCalled();
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

  it("applies a preset color from the node context menu", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <DiagramCanvas content={diagramContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );

    fireEvent.contextMenu(freeDrawingNode("alice"));
    fireEvent.click(screen.getByRole("button", { name: "Blue" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("id: node-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("color: blue");
  });
});

function pointerEvent(
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
  init: MouseEventInit = {}
): Event {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    ...init
  });

  Object.defineProperty(event, "pointerId", { value: pointerId });

  return event;
}

function freeDrawingNode(title: string): HTMLElement {
  const node = Array.from(document.querySelectorAll<HTMLElement>(".diagram-canvas-node"))
    .find((candidate) => candidate.title === title);
  expect(node).toBeInstanceOf(HTMLElement);

  return node as HTMLElement;
}
