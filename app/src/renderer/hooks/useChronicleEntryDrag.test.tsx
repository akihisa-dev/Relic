import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GanttChartEntry, GanttChartEntryEditKind } from "../../shared/ipc";
import { useChronicleEntryDrag } from "./useChronicleEntryDrag";

function entry(overrides: Partial<GanttChartEntry> = {}): GanttChartEntry {
  return {
    dateKind: "planned",
    endLabel: "2026-05-03",
    endValue: 12,
    fileName: "実装タスク",
    path: "tasks/implementation.md",
    startLabel: "2026-05-01",
    startValue: 10,
    statuses: ["完了"],
    ...overrides
  };
}

function makePointerDown(overrides: Partial<{
  button: number;
  clientX: number;
  currentTarget: HTMLElement;
  pointerId: number;
  preventDefault: () => void;
  stopPropagation: () => void;
  timeStamp: number;
}> = {}): never {
  const currentTarget = overrides.currentTarget ?? document.createElement("button");
  currentTarget.setPointerCapture = vi.fn();
  currentTarget.hasPointerCapture = vi.fn().mockReturnValue(true);
  currentTarget.releasePointerCapture = vi.fn();

  return {
    button: 0,
    clientX: 0,
    currentTarget,
    pointerId: 1,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    timeStamp: 0,
    ...overrides
  } as never;
}

async function runEdit(kind: GanttChartEntryEditKind, clientX: number) {
  const onUpdateEntry = vi.fn();
  const hook = renderHook(() => useChronicleEntryDrag({
    activeSource: "date",
    onUpdateEntry,
    resetKey: "date",
    unitWidth: 10
  }));

  act(() => {
    hook.result.current.startEntryEdit(makePointerDown(), entry(), kind);
  });
  act(() => {
    window.dispatchEvent(new MouseEvent("pointerup", { clientX }));
  });

  await waitFor(() => {
    expect(hook.result.current.dragPreview).toBeNull();
  });

  return onUpdateEntry;
}

describe("useChronicleEntryDrag", () => {
  it("move/resize-start/resize-endの更新inputを生成する", async () => {
    await expect(runEdit("move", 7)).resolves.toHaveBeenCalledWith(expect.objectContaining({
      endValue: 13,
      kind: "move",
      originalEndValue: 12,
      originalStartValue: 10,
      path: "tasks/implementation.md",
      source: "date",
      startValue: 11
    }));
    await expect(runEdit("resize-start", 20)).resolves.toHaveBeenCalledWith(expect.objectContaining({
      endValue: 12,
      kind: "resize-start",
      startValue: 12
    }));
    await expect(runEdit("resize-end", 20)).resolves.toHaveBeenCalledWith(expect.objectContaining({
      endValue: 14,
      kind: "resize-end",
      startValue: 10
    }));
  });

  it("delta 0では更新callbackを呼ばずpreviewを消す", async () => {
    const onUpdateEntry = await runEdit("move", 0);

    expect(onUpdateEntry).not.toHaveBeenCalled();
  });

  it("callbackがない場合はdragを開始しない", () => {
    const hook = renderHook(() => useChronicleEntryDrag({
      activeSource: "date",
      resetKey: "date",
      unitWidth: 10
    }));
    const preventDefault = vi.fn();

    act(() => {
      hook.result.current.startEntryEdit(makePointerDown({ preventDefault }), entry(), "move");
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(hook.result.current.dragPreview).toBeNull();
  });
});
