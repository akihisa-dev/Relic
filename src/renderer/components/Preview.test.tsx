import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import { Preview } from "./Preview";

const settings = defaultEditorSettings;

describe("Preview", () => {
  it("Markdownを見出しとしてレンダリングする", () => {
    render(<Preview content="# タイトル" settings={settings} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("タイトル");
  });

  it("チェックボックスをクリックすると onChange が呼ばれる", () => {
    const onChange = vi.fn();

    render(
      <Preview
        content="- [ ] タスク"
        onChange={onChange}
        settings={settings}
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith("- [x] タスク");
  });

  it("チェック済みをクリックすると未チェックに戻る", () => {
    const onChange = vi.fn();

    render(
      <Preview
        content="- [x] 完了"
        onChange={onChange}
        settings={settings}
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith("- [ ] 完了");
  });

  it("複数チェックボックスで正しいインデックスのみ切り替わる", () => {
    const onChange = vi.fn();
    const content = "- [ ] 一\n- [ ] 二\n- [ ] 三";

    render(<Preview content={content} onChange={onChange} settings={settings} />);

    const checkboxes = screen.getAllByRole("checkbox");

    fireEvent.click(checkboxes[1]);

    expect(onChange).toHaveBeenCalledWith("- [ ] 一\n- [x] 二\n- [ ] 三");
  });
});
