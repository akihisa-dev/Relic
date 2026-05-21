import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { CardsSearchResults } from "./CardsSearchResults";

function renderResults(overrides: Partial<Parameters<typeof CardsSearchResults>[0]> = {}) {
  const props = {
    error: null,
    frontmatterField: "",
    isSearching: false,
    mode: "fullText" as const,
    onOpenCard: vi.fn(),
    query: "note",
    results: [
      {
        cardName: "Note",
        lineNumber: 3,
        lineText: "matched line",
        path: "CardFolder/Note.md"
      }
    ],
    ...overrides
  };

  render(
    <I18nProvider language="en">
      <CardsSearchResults {...props} />
    </I18nProvider>
  );

  return props;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CardsSearchResults", () => {
  it("opens a search result card", () => {
    const props = renderResults();

    expect(screen.getByText("1 search results")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Note/ }));

    expect(props.onOpenCard).toHaveBeenCalledWith("CardFolder/Note.md", expect.any(Object));
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
