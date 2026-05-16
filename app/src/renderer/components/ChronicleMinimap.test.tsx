import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceGanttChart } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { ChronicleMinimap, type ChronicleMinimapProps } from "./ChronicleMinimap";

function chart(): WorkspaceGanttChart {
  return {
    entries: [],
    id: "chronicle",
    name: "chronicle",
    source: "chronicle"
  };
}

function renderMinimap(overrides: Partial<ChronicleMinimapProps> = {}) {
  const props: ChronicleMinimapProps = {
    activeChart: chart(),
    activeSource: "chronicle",
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
        <ChronicleMinimap {...props} />
      </I18nProvider>
    )
  };
}

describe("ChronicleMinimap", () => {
  it("chronicle chartでは既存classとslider roleでminimapを描画する", () => {
    const { container, props } = renderMinimap();

    expect(screen.getByText("全体")).toHaveClass("chronicle-minimap-label");
    expect(screen.getByRole("slider", { name: "年表ミニマップ" })).toHaveClass("chronicle-minimap");
    expect(container.querySelectorAll(".chronicle-minimap-item")).toHaveLength(2);
    expect(container.querySelector(".chronicle-minimap-window")).toHaveStyle({ left: "25%", width: "30%" });

    fireEvent.pointerDown(screen.getByRole("slider", { name: "年表ミニマップ" }));

    expect(props.onMinimapPointerDown).toHaveBeenCalledTimes(1);
  });

  it("active chartなし、date source、itemなしでは描画しない", () => {
    const { container: noChart } = renderMinimap({ activeChart: null });
    expect(noChart.firstChild).toBeNull();

    const { container: dateSource } = renderMinimap({ activeSource: "date" });
    expect(dateSource.firstChild).toBeNull();

    const { container: noItems } = renderMinimap({ minimapItems: [] });
    expect(noItems.firstChild).toBeNull();
  });
});
