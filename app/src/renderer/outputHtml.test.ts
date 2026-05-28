import { afterEach, describe, expect, it } from "vitest";

import { createTranslator } from "./i18nModel";
import {
  buildDiagramDefaultFileName,
  buildPreviewOutputHtml,
  firstH1,
  safeOutputFileName
} from "./outputHtml";

describe("outputHtml", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("印刷/PDF用HTMLにアプリUIを含めない", async () => {
    const t = createTranslator("ja");
    const result = await buildPreviewOutputHtml({
      content: "# タイトル\n\n本文\n\n| A | B |\n| - | - |\n| 1 | 2 |",
      fileName: "Note",
      path: "Folder/Note.md",
      t,
      title: "Note",
      workspacePath: "/tmp/relic"
    });

    expect(result.defaultFileName).toBe("Note");
    expect(result.html).toContain('<main class="relic-output-body">');
    expect(result.html).toContain("<h1");
    expect(result.html).not.toContain("title-bar");
    expect(result.html).not.toContain("files-sidebar");
    expect(result.html).not.toContain("toolbar-btn");
    expect(result.html).not.toContain("right-panel");
  });

  it("初期ファイル名に使えない文字を安全な文字にする", () => {
    expect(safeOutputFileName('A/B:C*D?"E.md')).toBe("A_B_C_D__E");
    expect(firstH1("前\n# 見出し\n本文")).toBe("見出し");
    expect(buildDiagramDefaultFileName("Note", 2, "d2")).toBe("Note-diagram-2-d2");
  });
});
