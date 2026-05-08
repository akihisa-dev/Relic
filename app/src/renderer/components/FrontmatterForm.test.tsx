import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FrontmatterForm } from "./FrontmatterForm";

function makeContent(fieldCount: number): string {
  const lines = ["---"];

  for (let index = 1; index <= fieldCount; index += 1) {
    lines.push(`field_${index}: value_${index}`);
  }

  lines.push("---", "本文");

  return lines.join("\n");
}

describe("FrontmatterForm", () => {
  it("フィールド数が20件以下なら警告を出さない", () => {
    render(
      <FrontmatterForm
        candidates={{}}
        content={makeContent(20)}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("フィールド数が21件以上なら警告を出す", () => {
    render(
      <FrontmatterForm
        candidates={{}}
        content={makeContent(21)}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The field limit is 20. You currently have 21 fields."
    );
  });

  it("フロントマターがあると初期表示でフォームを表示する", () => {
    render(
      <FrontmatterForm
        candidates={{}}
        content={makeContent(3)}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("Frontmatter")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByDisplayValue("value_1")).toBeInTheDocument();
  });

  it("本文中に存在するフロントマター項目だけを表示する", () => {
    render(
      <FrontmatterForm
        candidates={{}}
        content={"---\nstatus: draft\npublish: false\n---\n本文"}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("status")).toBeInTheDocument();
    expect(screen.getByDisplayValue("draft")).toBeInTheDocument();
    expect(screen.getByText("publish")).toBeInTheDocument();
    expect(screen.queryByText("tags")).not.toBeInTheDocument();
    expect(screen.queryByText("aliases")).not.toBeInTheDocument();
    expect(screen.queryByText("date")).not.toBeInTheDocument();
  });

  it("フロントマター項目がない場合は空表示にする", () => {
    render(
      <FrontmatterForm
        candidates={{}}
        content={"# 本文だけ"}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("This note has no frontmatter fields.")).toBeInTheDocument();
    expect(screen.queryByText("tags")).not.toBeInTheDocument();
  });
});
