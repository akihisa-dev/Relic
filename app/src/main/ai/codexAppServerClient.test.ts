import { describe, expect, it } from "vitest";

import { parseCodexResponse } from "./codexAppServerClient";

describe("parseCodexResponse", () => {
  it("parses structured AI Workspace responses", () => {
    const result = parseCodexResponse(JSON.stringify({
      message: "READMEを更新します。",
      operations: [{
        content: "# Updated",
        kind: "update",
        path: "README.md",
        summary: "READMEを更新"
      }]
    }));

    expect(result).toEqual({
      message: "READMEを更新します。",
      operations: [{
        content: "# Updated",
        kind: "update",
        path: "README.md",
        summary: "READMEを更新"
      }]
    });
  });

  it("parses structured responses even when Codex adds surrounding text", () => {
    const result = parseCodexResponse([
      "承知しました。",
      JSON.stringify({
        message: "READMEを更新します。",
        operations: [{
          content: "# Updated {with braces}",
          kind: "update",
          path: "README.md",
          summary: "READMEを更新"
        }]
      }),
      "補足です。"
    ].join("\n"));

    expect(result).toEqual({
      message: "READMEを更新します。",
      operations: [{
        content: "# Updated {with braces}",
        kind: "update",
        path: "README.md",
        summary: "READMEを更新"
      }]
    });
  });

  it("normalizes common operation field name variations", () => {
    const result = parseCodexResponse(JSON.stringify({
      message: "変更案を作成します。",
      operations: [{
        description: "認証仕様を更新",
        filePath: "docs/auth.md",
        kind: "UPDATE",
        markdown: "# Auth\nupdated"
      }]
    }));

    expect(result.operations).toEqual([{
      content: "# Auth\nupdated",
      kind: "update",
      path: "docs/auth.md",
      summary: "認証仕様を更新"
    }]);
  });

  it("uses a safe fallback summary for valid operations without a summary", () => {
    const result = parseCodexResponse(JSON.stringify({
      message: "変更案を作成します。",
      operations: [{
        content: "# Auth",
        kind: "create",
        path: "docs/auth.md"
      }]
    }));

    expect(result.operations).toEqual([{
      content: "# Auth",
      kind: "create",
      path: "docs/auth.md",
      summary: "docs/auth.md を作成"
    }]);
  });

  it("keeps plain text responses visible without creating file operations", () => {
    const result = parseCodexResponse("現在の要件は認証と同期に分けて整理できます。");

    expect(result.message).toContain("現在の要件は認証と同期に分けて整理できます。");
    expect(result.message).toContain("Markdown変更案は構造化形式で取得できなかったため作成しませんでした。");
    expect(result.operations).toEqual([]);
  });

  it("keeps malformed structured responses visible without creating file operations", () => {
    const result = parseCodexResponse("```json\n{\"message\":\"途中で切れました\"\n```");

    expect(result.message).toContain("途中で切れました");
    expect(result.message).toContain("Markdown変更案は構造化形式で取得できなかったため作成しませんでした。");
    expect(result.operations).toEqual([]);
  });
});
