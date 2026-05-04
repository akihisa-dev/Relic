import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import { Preview, resolveAttachmentImageSrc } from "./Preview";

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

  it("attachments配下の画像をワークスペース内のfile URLとして表示する", () => {
    render(
      <Preview
        content="![図](attachments/diagram.png)"
        settings={settings}
        workspacePath="/tmp/relic workspace"
      />
    );

    const image = screen.getByRole("img", { name: "図" });

    expect(image).toHaveAttribute("src", "file:///tmp/relic%20workspace/attachments/diagram.png");
  });

  it("外部URL画像は初期対象外として画像表示しない", () => {
    render(
      <Preview
        content="![外部](https://example.com/image.png)"
        settings={settings}
        workspacePath="/tmp/relic"
      />
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("外部")).toBeInTheDocument();
  });
});

describe("resolveAttachmentImageSrc", () => {
  it("attachments配下のラスター画像だけを許可する", () => {
    expect(resolveAttachmentImageSrc("/tmp/relic", "attachments/image.webp")).toBe(
      "file:///tmp/relic/attachments/image.webp"
    );
    expect(resolveAttachmentImageSrc("/tmp/relic", "notes/image.png")).toBeNull();
    expect(resolveAttachmentImageSrc("/tmp/relic", "attachments/../secret.png")).toBeNull();
    expect(resolveAttachmentImageSrc("/tmp/relic", "attachments/icon.svg")).toBeNull();
    expect(resolveAttachmentImageSrc("/tmp/relic", "https://example.com/image.png")).toBeNull();
  });
});
