import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderEditorWithView } from "./editorTestHelpers";

describe("Editor accessibility", () => {
  it("本文入力欄を名前付きtextboxとして公開する", async () => {
    await renderEditorWithView({
      content: "本文"
    });

    expect(screen.getByRole("textbox", { name: "Markdown editor" })).toBeInTheDocument();
  });
});
