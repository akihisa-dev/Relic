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
