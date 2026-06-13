import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { MapCanvas } from "./MapCanvas";

const mapContent = [
  "type: map",
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

const mapContentWithoutLines = [
  "type: map",
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

function renderMapCanvas(content = mapContent) {
  render(
    <I18nProvider language="en">
      <MapCanvas content={content} fileName="World" />
    </I18nProvider>
  );
}

afterEach(() => {
  cleanup();
});

describe("MapCanvas", () => {
  it("renders nodes and line labels from Map Markdown", () => {
    renderMapCanvas();

    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("characters/alice.md")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("幼なじみ")).toBeInTheDocument();
  });

  it("shows an error for invalid Map Markdown", () => {
    renderMapCanvas("type: map\n\nnotes: body");

    expect(screen.getByRole("alert")).toHaveTextContent("Could not read this Map file. Check the source.");
  });

  it("commits moved node coordinates on pointer up", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <MapCanvas content={mapContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const node = screen.getByText("alice").closest(".map-canvas-node");
    expect(node).toBeInstanceOf(HTMLElement);

    fireEvent(node as HTMLElement, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(node as HTMLElement, pointerEvent("pointermove", 1, 50, 30));
    fireEvent(node as HTMLElement, pointerEvent("pointerup", 1, 50, 30));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("x: 160");
    expect(onChange.mock.calls[0]?.[0]).toContain("y: 100");
  });

  it("does not rewrite Map Markdown when a node is clicked without moving", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <MapCanvas content={mapContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const node = screen.getByText("alice").closest(".map-canvas-node");
    expect(node).toBeInstanceOf(HTMLElement);

    fireEvent(node as HTMLElement, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(node as HTMLElement, pointerEvent("pointerup", 1, 10, 10));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("adds a line by connecting node handles", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <MapCanvas content={mapContentWithoutLines} fileName="World" onChange={onChange} />
      </I18nProvider>
    );

    fireEvent(screen.getByLabelText("Connect alice"), pointerEvent("pointerdown", 2, 10, 10));
    fireEvent(screen.getByLabelText("Connect bob"), pointerEvent("pointerup", 2, 260, 10));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toContain("from: node-1");
    expect(onChange.mock.calls[0]?.[0]).toContain("to: node-2");
  });

  it("deletes a selected node and connected lines with Delete", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider language="en">
        <MapCanvas content={mapContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const node = screen.getByText("alice").closest(".map-canvas-node");
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
        <MapCanvas content={mapContent} fileName="World" onChange={onChange} />
      </I18nProvider>
    );
    const line = container.querySelector(".map-canvas-line");
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
        <MapCanvas content={mapContent} fileName="World" onChange={onChange} />
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
