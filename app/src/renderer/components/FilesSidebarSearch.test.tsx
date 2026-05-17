import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { FilesSidebarSearch } from "./FilesSidebarSearch";

function renderSearch(overrides: Partial<Parameters<typeof FilesSidebarSearch>[0]> = {}) {
  const props = {
    onSearchFrontmatterFieldChange: vi.fn(),
    onSearchModeChange: vi.fn(),
    onSearchQueryChange: vi.fn(),
    searchError: null,
    searchFocusRequest: 0,
    searchFrontmatterCandidates: { status: ["Draft", "Done"] },
    searchFrontmatterField: "",
    searchFrontmatterFields: ["aliases", "status", "tags"],
    searchMode: "fullText" as const,
    searchQuery: "",
    ...overrides
  };

  render(
    <I18nProvider language="en">
      <FilesSidebarSearch {...props} />
    </I18nProvider>
  );

  return props;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FilesSidebarSearch", () => {
  it("changes query and search mode from the menu", () => {
    const props = renderSearch();

    fireEvent.change(screen.getByLabelText("File search"), { target: { value: "note" } });
    expect(props.onSearchQueryChange).toHaveBeenCalledWith("note");

    fireEvent.click(screen.getByRole("button", { name: "Search method" }));
    expect(screen.getByRole("listbox", { name: "Search method" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Property" }));

    expect(props.onSearchModeChange).toHaveBeenCalledWith("frontmatter");
    expect(screen.queryByRole("listbox", { name: "Search method" })).not.toBeInTheDocument();
  });

  it("shows frontmatter field and value candidates in property search mode", () => {
    const props = renderSearch({
      searchFrontmatterField: "status",
      searchMode: "frontmatter"
    });
    const fileSearchInput = screen.getByLabelText("File search");

    expect(fileSearchInput).toHaveAttribute("list", "files-search-frontmatter-values");
    expect(screen.getByLabelText("Property name")).toHaveValue("status");
    expect(document.querySelector('option[value="Draft"]')).toBeInTheDocument();

    expect(screen.queryByRole("option", { name: "author" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Property name"), { target: { value: "aliases" } });
    expect(props.onSearchFrontmatterFieldChange).toHaveBeenCalledWith("aliases");
  });
});
