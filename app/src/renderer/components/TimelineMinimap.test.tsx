import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CardbookTimelineChart } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { TimelineMinimap, type TimelineMinimapProps } from "./TimelineMinimap";

function chart(overrides: Partial<CardbookTimelineChart> = {}): CardbookTimelineChart {
  return {
    entries: [],
    id: "timeline",
    name: "timeline",
    source: "timeline",
    ...overrides
  };
}

function renderMinimap(overrides: Partial<TimelineMinimapProps> = {}) {
  const props: TimelineMinimapProps = {
    activeChart: chart(),
    minimapItems: [
      { key: "a.md:default", leftPercent: 10, widthPercent: 20 },
      { key: "b.md:default", leftPercent: 50, widthPercent: 12 }
    ],
    minimapRef: createRef<HTMLDivElement>(),
    minimapViewport: { leftPercent: 25, widthPercent: 30 },
    onMinimapPointerDown: vi.fn(),
    ...overrides
  };

  return {
    props,
    ...render(
      <I18nProvider language="ja">
        <TimelineMinimap {...props} />
      </I18nProvider>
    )
  };
}

describe("TimelineMinimap", () => {
  it("timeline chartでは既存classとslider roleでminimapを描画する", () => {
    const { container, props } = renderMinimap();

    expect(screen.getByText("全体")).toHaveClass("timeline-minimap-label");
    expect(screen.getByRole("slider", { name: "年表ミニマップ" })).toHaveClass("timeline-minimap");
    expect(container.querySelectorAll(".timeline-minimap-item")).toHaveLength(2);
    expect(container.querySelector(".timeline-minimap-window")).toHaveStyle({ left: "25%", width: "30%" });

    fireEvent.pointerDown(screen.getByRole("slider", { name: "年表ミニマップ" }));

    expect(props.onMinimapPointerDown).toHaveBeenCalledTimes(1);
  });

  it("active chartなし、itemなしでは描画しない", () => {
    const { container: noChart } = renderMinimap({ activeChart: null });
    expect(noChart.firstChild).toBeNull();

    const { container: noItems } = renderMinimap({ minimapItems: [] });
    expect(noItems.firstChild).toBeNull();
  });
});
