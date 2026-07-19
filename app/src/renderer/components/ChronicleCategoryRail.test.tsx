import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChronicleCategoryOption } from "../chronicleCategoryModel";
import { I18nProvider } from "../i18n";
import { ChronicleCategoryRail } from "./ChronicleCategoryRail";

const options: ChronicleCategoryOption[] = [
  { count: 2, hue: 0, key: "category:War", label: "War" },
  { count: 1, hue: 137, key: "category:People", label: "People" },
  { count: 1, hue: null, key: "uncategorized", label: "Uncategorized" }
];

afterEach(cleanup);

describe("ChronicleCategoryRail", () => {
  it("カテゴリを直接切り替え、表示件数と全表示操作を更新する", () => {
    const onHiddenCategoryKeysChange = vi.fn();
    const { rerender } = render(
      <I18nProvider language="en">
        <ChronicleCategoryRail
          collapsed={false}
          hiddenCategoryKeys={new Set()}
          onCollapsedChange={vi.fn()}
          onHiddenCategoryKeysChange={onHiddenCategoryKeysChange}
          options={options}
        />
      </I18nProvider>
    );

    expect(screen.getByText("4 / 4 items")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide all" }));
    expect(onHiddenCategoryKeysChange).toHaveBeenLastCalledWith([
      "category:War",
      "category:People",
      "uncategorized"
    ]);
    fireEvent.click(screen.getByRole("button", { name: /War/ }));
    expect(onHiddenCategoryKeysChange).toHaveBeenLastCalledWith(["category:War"]);

    rerender(
      <I18nProvider language="en">
        <ChronicleCategoryRail
          collapsed={false}
          hiddenCategoryKeys={new Set(["category:War"])}
          onCollapsedChange={vi.fn()}
          onHiddenCategoryKeysChange={onHiddenCategoryKeysChange}
          options={options}
        />
      </I18nProvider>
    );

    expect(screen.getByRole("button", { name: /War/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("2 / 4 items")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(onHiddenCategoryKeysChange).toHaveBeenLastCalledWith([]);
  });

  it("検索はカテゴリ一覧だけを絞り込み、Escapeで解除する", () => {
    render(
      <I18nProvider language="en">
        <ChronicleCategoryRail
          collapsed={false}
          hiddenCategoryKeys={new Set()}
          onCollapsedChange={vi.fn()}
          onHiddenCategoryKeysChange={vi.fn()}
          options={options}
        />
      </I18nProvider>
    );

    const search = screen.getByRole("searchbox", { name: "Search categories" });
    fireEvent.change(search, { target: { value: "Peo" } });
    expect(screen.getByRole("button", { name: /People/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /War/ })).not.toBeInTheDocument();

    fireEvent.keyDown(search, { key: "Escape" });
    expect(search).toHaveValue("");
    expect(screen.getByRole("button", { name: /War/ })).toBeInTheDocument();
  });

  it("折りたたみ中も非表示カテゴリ数を示して再展開できる", () => {
    const onCollapsedChange = vi.fn();
    render(
      <I18nProvider language="en">
        <ChronicleCategoryRail
          collapsed
          hiddenCategoryKeys={new Set(["category:War", "category:People"])}
          onCollapsedChange={onCollapsedChange}
          onHiddenCategoryKeysChange={vi.fn()}
          options={options}
        />
      </I18nProvider>
    );

    expect(screen.getByText("2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand category rail" }));
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });
});
