import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LayoutResizeBoundary } from "./LayoutResizeBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LayoutResizeBoundary", () => {
  it("keeps the existing resize boundary classes and mouse handler", () => {
    const onResizeStart = vi.fn();

    render(
      <LayoutResizeBoundary
        aria-label="Resize right panel"
        isActive
        onResizeStart={onResizeStart}
        side="right-panel"
      />
    );

    const boundary = screen.getByRole("button", { name: "Resize right panel" });
    expect(boundary).toHaveClass("layout-resize-boundary");
    expect(boundary).toHaveClass("layout-resize-boundary--right-panel");
    expect(boundary).toHaveClass("layout-resize-boundary--active");

    fireEvent.mouseDown(boundary);

    expect(onResizeStart).toHaveBeenCalledTimes(1);
  });
});
