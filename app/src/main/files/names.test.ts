import { describe, expect, it } from "vitest";

import { validateBaseName } from "./names";

describe("validateBaseName", () => {
  it("Windows予約名を拡張子付きでも拒否する", () => {
    for (const name of ["CON", "CON.md", "aux", "LPT1.md", "COM9.txt", "NUL"]) {
      expect(validateBaseName(name, "名前を入力してください。")).toMatchObject({
        error: { code: "FILE_NAME_INVALID" },
        ok: false
      });
    }
  });

  it("Windowsで扱えない文字と制御文字を拒否する", () => {
    for (const name of ["a:b", "a*b", "a?b", "a<b", "a>b", "a|b", "a\"b", "a\u0000b"]) {
      expect(validateBaseName(name, "名前を入力してください。")).toMatchObject({
        error: { code: "FILE_NAME_INVALID" },
        ok: false
      });
    }
  });

  it("末尾ドットと末尾スペースを拒否する", () => {
    for (const name of ["note.", "note "]) {
      expect(validateBaseName(name, "名前を入力してください。")).toMatchObject({
        error: { code: "FILE_NAME_INVALID" },
        ok: false
      });
    }
  });

  it.each([".note", ".note.md", ".folder"])("隠し項目名を拒否する: %s", (name) => {
    expect(validateBaseName(name, "名前を入力してください。")).toMatchObject({
      error: { code: "FILE_NAME_HIDDEN" },
      ok: false
    });
  });

  it("通常の日本語名、英数字名、途中スペースを許可する", () => {
    expect(validateBaseName("読書メモ", "名前を入力してください。")).toEqual({
      ok: true,
      value: "読書メモ"
    });
    expect(validateBaseName("relic notes", "名前を入力してください。")).toEqual({
      ok: true,
      value: "relic notes"
    });
  });
});
