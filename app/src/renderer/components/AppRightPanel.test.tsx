import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ResolvedWikiLink } from "../../shared/links";
import { I18nProvider } from "../i18n";
import { AppRightPanel } from "./AppRightPanel";

const outgoingLink: ResolvedWikiLink = {
  displayName: "Target",
  exists: true,
  path: "Target.md",
  wikiLink: {
    alias: null,
    blockId: null,
    heading: null,
    kind: "link",
    raw: "[[Target]]",
    target: "Target"
  }
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AppRightPanel", () => {
  it("does not render the AI workspace panel", () => {
    render(
      <I18nProvider language="en">
        <AppRightPanel
          backlinks={[]}
          isLoadingBacklinks={false}
          isOpen
          isResizing={false}
          onOpenFile={vi.fn()}
          onOpenWikiLink={vi.fn()}
          onOutlineHeadingClick={vi.fn()}
          onResizeStart={vi.fn()}
          outlineHeadings={[]}
          outgoingLinks={[]}
          outgoingLinksLimited={false}
          rightPanelView="outline"
          setLinkContextMenu={vi.fn()}
          width={260}
        />
      </I18nProvider>
    );

    expect(screen.queryByLabelText("AIへのメッセージ")).not.toBeInTheDocument();
  });

  it("shows outline headings", () => {
    const onOutlineHeadingClick = vi.fn();

    render(
      <I18nProvider language="en">
        <AppRightPanel
          backlinks={[]}
          isLoadingBacklinks={false}
          isOpen
          isResizing={false}
          onOpenFile={vi.fn()}
          onOpenWikiLink={vi.fn()}
          onOutlineHeadingClick={onOutlineHeadingClick}
          onResizeStart={vi.fn()}
          outlineHeadings={[{ from: 12, level: 2, text: "Overview" }]}
          outgoingLinks={[]}
          outgoingLinksLimited={false}
          rightPanelView="outline"
          setLinkContextMenu={vi.fn()}
          width={260}
        />
      </I18nProvider>
    );

    expect(screen.queryByText("01")).not.toBeInTheDocument();
    screen.getByRole("button", { name: "Overview" }).click();

    expect(onOutlineHeadingClick).toHaveBeenCalledWith({ from: 12, level: 2, text: "Overview" });
  });

  it("passes the clicked duplicate outline heading with its document position", () => {
    const onOutlineHeadingClick = vi.fn();

    render(
      <I18nProvider language="en">
        <AppRightPanel
          backlinks={[]}
          isLoadingBacklinks={false}
          isOpen
          isResizing={false}
          onOpenFile={vi.fn()}
          onOpenWikiLink={vi.fn()}
          onOutlineHeadingClick={onOutlineHeadingClick}
          onResizeStart={vi.fn()}
          outlineHeadings={[
            { from: 0, level: 1, text: "Scene" },
            { from: 24, level: 2, text: "Scene" }
          ]}
          outgoingLinks={[]}
          outgoingLinksLimited={false}
          rightPanelView="outline"
          setLinkContextMenu={vi.fn()}
          width={260}
        />
      </I18nProvider>
    );

    screen.getAllByRole("button", { name: "Scene" })[1]?.click();

    expect(onOutlineHeadingClick).toHaveBeenCalledWith({ from: 24, level: 2, text: "Scene" });
  });

  it("shows a notice when outgoing links are limited", () => {
    render(
      <I18nProvider language="en">
        <AppRightPanel
          backlinks={[]}
          isLoadingBacklinks={false}
          isOpen
          isResizing={false}
          onOpenFile={vi.fn()}
          onOpenWikiLink={vi.fn()}
          onOutlineHeadingClick={vi.fn()}
          onResizeStart={vi.fn()}
          outlineHeadings={[]}
          outgoingLinks={[outgoingLink]}
          outgoingLinksLimited
          rightPanelView="links"
          setLinkContextMenu={vi.fn()}
          width={260}
        />
      </I18nProvider>
    );

    expect(screen.getByText("Only some links are shown because there are many links.")).toBeInTheDocument();
  });
});
