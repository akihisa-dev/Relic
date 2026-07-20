import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { ChronicleCalendarTreeRail } from "./ChronicleCalendarTreeRail";

afterEach(cleanup);

const nodes = [{
  calendarName: "基準暦",
  files: [{ fileName: "王都.md", path: "地誌/王都.md" }],
  hue: null
}, {
  calendarName: "灰王暦",
  files: [{ fileName: "七門攻防.md", path: "戦役/七門攻防.md" }],
  hue: 137
}];

describe("ChronicleCalendarTreeRail", () => {
  it("暦から所属ファイルをたどり、ファイルを開く", () => {
    const onOpenFile = vi.fn();
    render(
      <I18nProvider language="ja">
        <ChronicleCalendarTreeRail collapsed={false} nodes={nodes} onCollapsedChange={vi.fn()} onOpenFile={onOpenFile} />
      </I18nProvider>
    );

    expect(screen.getByText("基準暦")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "七門攻防.md" }));
    expect(onOpenFile).toHaveBeenCalledWith("戦役/七門攻防.md");

    fireEvent.click(screen.getByRole("button", { name: "灰王暦を折りたたむ" }));
    expect(screen.queryByRole("button", { name: "七門攻防.md" })).not.toBeInTheDocument();
  });

  it("暦名とファイル名を検索し、Escapeで解除する", () => {
    render(
      <I18nProvider language="ja">
        <ChronicleCalendarTreeRail collapsed={false} nodes={nodes} onCollapsedChange={vi.fn()} onOpenFile={vi.fn()} />
      </I18nProvider>
    );
    const search = screen.getByRole("searchbox", { name: "暦・ファイルを検索" });
    fireEvent.change(search, { target: { value: "七門" } });
    expect(screen.queryByText("王都.md")).not.toBeInTheDocument();
    expect(screen.getByText("七門攻防.md")).toBeInTheDocument();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.getByText("王都.md")).toBeInTheDocument();
  });
});
