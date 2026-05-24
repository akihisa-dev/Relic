import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { FilesSearchResults } from "./FilesSearchResults";

function renderResults(overrides: Partial<Parameters<typeof FilesSearchResults>[0]> = {}) {
  const props = {
    error: null,
    frontmatterField: "",
    isSearching: false,
    mode: "fullText" as const,
    onOpenFile: vi.fn(),
    query: "note",
    results: [
      {
        fileName: "Note",
        lineNumber: 3,
        lineText: "matched line",
        path: "Folder/Note.md"
      }
    ],
    ...overrides
  };

  render(
    <I18nProvider language="en">
      <FilesSearchResults {...props} />
    </I18nProvider>
  );

  return props;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FilesSearchResults", () => {
  it("opens a search result file", () => {
    const props = renderResults();

    expect(screen.getByText("1 search results")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Note/ }));

    expect(props.onOpenFile).toHaveBeenCalledWith("Folder/Note.md", expect.any(Object));
  });

  it("shows error, loading, missing-field, and empty states", () => {
    renderResults({ error: "Bad regex" });
    expect(screen.getByText("Bad regex")).toBeInTheDocument();

    cleanup();
    renderResults({ isSearching: true });
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    cleanup();
    renderResults({ frontmatterField: "", mode: "frontmatter", query: "draft", results: [] });
    expect(screen.getByText("Enter a field name.")).toBeInTheDocument();

    cleanup();
    renderResults({ query: "missing", results: [] });
    expect(screen.getByText("No matches.")).toBeInTheDocument();
  });
});
