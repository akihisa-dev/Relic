import { describe, expect, it } from "vitest";

import { createTranslator } from "../i18nModel";
import { workspaceFileErrorMessage } from "./workspaceFileError";

describe("workspaceFileErrorMessage", () => {
  it("隠し項目名の拒否を選択言語で表示する", () => {
    const error = { code: "FILE_NAME_HIDDEN", message: "fallback" };

    expect(workspaceFileErrorMessage(error, createTranslator("ja"))).toBe(
      "名前が . で始まるファイルやフォルダは使用できません。"
    );
    expect(workspaceFileErrorMessage(error, createTranslator("en"))).toBe(
      "Files and folders whose names begin with . cannot be used."
    );
  });
});
