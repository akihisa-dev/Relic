import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  const defaultProps = {
    activeFileTab: null,
    applyingReferenceKey: null,
    backlinks: [],
    isLoadingBacklinks: false,
    isLoadingUnlinkedReferences: false,
    isOpen: true,
    isResizing: false,
    onOpenFile: vi.fn(),
    onOpenWikiLink: vi.fn(),
    onApplyUnlinkedReference: vi.fn(),
    onOutlineHeadingClick: vi.fn(),
    onResizeStart: vi.fn(),
    onUpdateTabContent: vi.fn(),
    outlineHeadings: [],
    outgoingLinks: [],
    outgoingLinksLimited: false,
    setLinkContextMenu: vi.fn(),
    unlinkedReferences: { references: [], skippedUnreadableFileCount: 0, truncated: false },
    width: 260
  };

  it("shows outline headings", () => {
    const onOutlineHeadingClick = vi.fn();

    render(
      <I18nProvider language="en">
        <AppRightPanel
          {...defaultProps}
          onOutlineHeadingClick={onOutlineHeadingClick}
          outlineHeadings={[{ from: 12, level: 2, text: "Overview" }]}
          rightPanelView="outline"
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
          {...defaultProps}
          onOutlineHeadingClick={onOutlineHeadingClick}
          outlineHeadings={[
            { from: 0, level: 1, text: "Scene" },
            { from: 24, level: 2, text: "Scene" }
          ]}
          rightPanelView="outline"
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
          {...defaultProps}
          outgoingLinks={[outgoingLink]}
          outgoingLinksLimited
          rightPanelView="links"
        />
      </I18nProvider>
    );

    expect(screen.getByText("Only some links are shown because there are many links.")).toBeInTheDocument();
  });

  it("shows unlinked references and applies a selected reference", () => {
    const onApplyUnlinkedReference = vi.fn().mockResolvedValue(undefined);
    const reference = {
      from: 8,
      lineNumber: 2,
      lineText: "Read Target before editing.",
      linkText: "[[Target]]",
      matchText: "Target",
      sourceName: "Source",
      sourcePath: "Source.md",
      targetPath: "Target.md",
      to: 14
    };

    render(
      <I18nProvider language="en">
        <AppRightPanel
          {...defaultProps}
          onApplyUnlinkedReference={onApplyUnlinkedReference}
          rightPanelView="links"
          unlinkedReferences={{
            references: [reference],
            skippedUnreadableFileCount: 0,
            truncated: false
          }}
        />
      </I18nProvider>
    );

    expect(screen.getByText("Unlinked references")).toBeInTheDocument();
    expect(screen.getByText("Read Target before editing.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Link" }));

    expect(onApplyUnlinkedReference).toHaveBeenCalledWith(reference);
  });
});
