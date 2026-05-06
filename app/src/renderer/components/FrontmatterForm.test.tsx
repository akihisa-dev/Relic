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
});
