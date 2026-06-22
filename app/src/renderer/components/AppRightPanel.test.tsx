import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import type { ResolvedWikiLink } from "../../shared/links";
import { I18nProvider } from "../i18n";
import type { FileTab } from "../store/editorStore";
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
    backlinks: [],
    editorSettings: defaultEditorSettings,
    frontmatterCandidates: {},
    isLoadingBacklinks: false,
    isOpen: true,
    isResizing: false,
    onOpenFile: vi.fn(),
    onOpenWikiLink: vi.fn(),
    onOutlineHeadingClick: vi.fn(),
    onResizeStart: vi.fn(),
    onUpdateTabContent: vi.fn(),
    outlineHeadings: [],
    outgoingLinks: [],
    outgoingLinksLimited: false,
    setLinkContextMenu: vi.fn(),
    userDefinedFields: [],
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

  it("updates only the frontmatter block from the frontmatter panel", () => {
    const onUpdateTabContent = vi.fn();
    const activeFileTab: FileTab = {
      content: "---\ntags: [draft]\n---\n# Body\nKeep this.",
      id: "tab-1",
      kind: "file",
      name: "Note",
      path: "Note.md",
      savedContent: "---\ntags: [draft]\n---\n# Body\nKeep this."
    };

    render(
      <I18nProvider language="en">
        <AppRightPanel
          {...defaultProps}
          activeFileTab={activeFileTab}
          onUpdateTabContent={onUpdateTabContent}
          rightPanelView="frontmatter"
        />
      </I18nProvider>
    );

    const tagInput = screen.getByDisplayValue("draft");
    fireEvent.change(tagInput, { target: { value: "review" } });
    fireEvent.blur(tagInput);

    expect(onUpdateTabContent).toHaveBeenCalledWith(
      "tab-1",
      "---\ntags: [\"review\"]\n---\n# Body\nKeep this."
    );
  });

  it("treats unregistered frontmatter properties as text fields in the frontmatter panel", () => {
    const onUpdateTabContent = vi.fn();
    const activeFileTab: FileTab = {
      content: "---\nunknown: [first, second]\n---\n# Body\nKeep this.",
      id: "tab-1",
      kind: "file",
      name: "Note",
      path: "Note.md",
      savedContent: "---\nunknown: [first, second]\n---\n# Body\nKeep this."
    };

    render(
      <I18nProvider language="en">
        <AppRightPanel
          {...defaultProps}
          activeFileTab={activeFileTab}
          onUpdateTabContent={onUpdateTabContent}
          rightPanelView="frontmatter"
        />
      </I18nProvider>
    );

    expect(screen.queryByTitle("Add value")).not.toBeInTheDocument();
    const input = screen.getByDisplayValue("first");
    expect(input.getAttribute("list")).toBeNull();
    fireEvent.change(input, { target: { value: "updated" } });
    fireEvent.blur(input);

    expect(onUpdateTabContent).toHaveBeenCalledWith(
      "tab-1",
      "---\nunknown: [\"updated\"]\n---\n# Body\nKeep this."
    );
  });

  it("does not show form inputs for invalid frontmatter", () => {
    const activeFileTab: FileTab = {
      content: "---\ntags: [broken\n# Body",
      id: "tab-1",
      kind: "file",
      name: "Broken",
      path: "Broken.md",
      savedContent: "---\ntags: [broken\n# Body"
    };

    render(
      <I18nProvider language="en">
        <AppRightPanel
          {...defaultProps}
          activeFileTab={activeFileTab}
          rightPanelView="frontmatter"
        />
      </I18nProvider>
    );

    expect(screen.getByText("Frontmatter cannot be read, so form editing is unavailable.")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("broken")).not.toBeInTheDocument();
  });

  it("uses date inputs for registered date properties in the frontmatter panel", () => {
    const activeFileTab: FileTab = {
      content: "---\ndeadline: 2026-06-08\n---\n# Body",
      id: "tab-1",
      kind: "file",
      name: "Note",
      path: "Note.md",
      savedContent: "---\ndeadline: 2026-06-08\n---\n# Body"
    };

    render(
      <I18nProvider language="en">
        <AppRightPanel
          {...defaultProps}
          activeFileTab={activeFileTab}
          rightPanelView="frontmatter"
          userDefinedFields={[{ name: "deadline", type: "date" }]}
        />
      </I18nProvider>
    );

    expect((screen.getByDisplayValue("2026-06-08") as HTMLInputElement).type).toBe("date");
  });
});
