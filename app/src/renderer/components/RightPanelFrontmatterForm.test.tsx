import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import { I18nProvider } from "../i18n";
import { RightPanelFrontmatterForm } from "./RightPanelFrontmatterForm";

const initialContent = [
  "---",
  "chronicle:",
  "  - [メイン暦, [[1185, null], [1185, null]]]",
  "tags: [資料]",
  "---",
  "# 本文"
].join("\n");

function renderForm(onUpdateTabContent = vi.fn()) {
  function Harness() {
    const [content, setContent] = useState(initialContent);
    const handleUpdate = (tabId: string, nextContent: string): void => {
      onUpdateTabContent(tabId, nextContent);
      setContent(nextContent);
    };

    return (
      <I18nProvider language="ja">
        <RightPanelFrontmatterForm
          activeFileTab={{
            content,
            id: "tab-1",
            kind: "file",
            name: "鎌倉時代",
            path: "history/kamakura.md",
            savedContent: initialContent
          }}
          editorSettings={defaultEditorSettings}
          frontmatterCandidates={{ chronicle: ["メイン暦", "帝国暦"] }}
          userDefinedFields={[]}
          onUpdateTabContent={handleUpdate}
        />
      </I18nProvider>
    );
  }

  render(
    <Harness />
  );
  return onUpdateTabContent;
}

describe("RightPanelFrontmatterForm chronicle", () => {
  it("chronicleの暦名を候補から選べる", () => {
    renderForm();

    const input = screen.getByLabelText("chronicle 0 calendar");

    expect(input).toHaveAttribute("list", "right-chronicle-calendar-options-0");
    expect(document.querySelector("datalist#right-chronicle-calendar-options-0 option[value='帝国暦']")).not.toBeNull();
  });

  it("chronicle entryの年月編集を新形式で書き戻す", async () => {
    const onUpdateTabContent = renderForm();

    fireEvent.change(screen.getByLabelText("chronicle 0 start month"), { target: { value: "5" } });
    fireEvent.blur(screen.getByLabelText("chronicle 0 start month"));

    fireEvent.change(screen.getByLabelText("chronicle 0 end month"), { target: { value: "5" } });
    fireEvent.blur(screen.getByLabelText("chronicle 0 end month"));

    await waitFor(() => expect(onUpdateTabContent).toHaveBeenLastCalledWith(
      "tab-1",
      expect.stringContaining([
        "chronicle:",
        "  - [メイン暦, [[1185, 5], [1185, 5]]]"
      ].join("\n"))
    ));
    expect(onUpdateTabContent).toHaveBeenLastCalledWith("tab-1", expect.stringContaining("tags: [\"資料\"]"));
    expect(onUpdateTabContent).toHaveBeenLastCalledWith("tab-1", expect.stringContaining("# 本文"));
  });

  it("chronicle entryを追加・削除でき、空欄月はnullで保存する", async () => {
    const onUpdateTabContent = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "+" }));

    await waitFor(() => expect(onUpdateTabContent).toHaveBeenLastCalledWith(
      "tab-1",
      expect.stringContaining([
        "  - [メイン暦, [[1, null], [1, null]]]"
      ].join("\n"))
    ));

    fireEvent.click(screen.getAllByRole("button", { name: "×" })[1]);

    expect(onUpdateTabContent).toHaveBeenLastCalledWith(
      "tab-1",
      expect.stringContaining("[メイン暦, [[1185, null], [1185, null]]]")
    );
    expect(onUpdateTabContent).toHaveBeenLastCalledWith(
      "tab-1",
      expect.not.stringContaining("[メイン暦, [[1, null], [1, null]]]")
    );
  });
});
