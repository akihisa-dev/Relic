import { fireEvent, render, screen } from "@testing-library/react";
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

  it("登録済みフィールドを後から追加できる", () => {
    const onChange = vi.fn();

    render(
      <FrontmatterForm
        candidates={{}}
        content={"# 本文だけ"}
        onChange={onChange}
        userDefinedFields={[{ name: "締切", type: "date" }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /締切/ }));

    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("締切"));
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("# 本文だけ"));
  });

  it("任意フィールドを後から追加できる", () => {
    const onChange = vi.fn();

    render(
      <FrontmatterForm
        candidates={{}}
        content={"# 本文だけ"}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Add field"), { target: { value: "気分" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("気分"));
  });

  it("このファイルからフィールドを削除できる", () => {
    const onChange = vi.fn();

    render(
      <FrontmatterForm
        candidates={{}}
        content={"---\nstatus: draft\n---\n本文"}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTitle("Remove from this file"));

    expect(onChange).toHaveBeenCalledWith("本文");
  });

  it("保存済みテンプレートを適用できる", () => {
    const onChange = vi.fn();

    render(
      <FrontmatterForm
        candidates={{}}
        content={"---\ntags: [memo]\n---\n本文"}
        frontmatterTemplates={[{ fieldNames: ["tags", "締切"], name: "原稿" }]}
        onChange={onChange}
        userDefinedFields={[{ name: "締切", type: "date" }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /原稿/ }));

    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("tags:"));
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("締切"));
  });

  it("未認識キーに入力能力を割り当てられる", () => {
    const onUserDefinedFieldsChange = vi.fn();

    render(
      <FrontmatterForm
        candidates={{}}
        content={"---\n気分: good\n---\n本文"}
        onChange={vi.fn()}
        onUserDefinedFieldsChange={onUserDefinedFieldsChange}
      />
    );

    fireEvent.click(screen.getByTitle("Assign input ability"));
    fireEvent.click(screen.getByTitle("Assign input ability"));

    expect(onUserDefinedFieldsChange).toHaveBeenCalledWith([{ name: "気分", type: "text" }]);
  });
});
