import { describe, expect, it } from "vitest";

import {
  buildApplyOperationsMessage,
  buildAssistantFallback,
  buildChatOnlyAssistantMessage,
  normalizeAIProviderError
} from "./aiWorkspaceMessages";
import type { AIWorkspaceFileOperation } from "../../shared/ipc";

describe("aiWorkspaceMessages", () => {
  it("summarizes applied, stale, and failed operations with path-level lines", () => {
    const operations = [operation("a.md"), operation("b.md"), operation("c.md")];

    expect(buildApplyOperationsMessage(operations, new Set(["b.md"]), new Set(["c.md"]))).toContain("- 再作業が必要: b.md");
    expect(buildApplyOperationsMessage(operations, new Set(["b.md"]), new Set(["c.md"]))).toContain("- 失敗: c.md");
  });

  it("adds rejected and dirty operation details to assistant messages", () => {
    const message = buildChatOnlyAssistantMessage(
      "更新しました。",
      [{ path: "../outside.md", reason: "ワークスペース外です。" }],
      {
        applied: [operation("ok.md")],
        blockedDirtyPaths: ["dirty.md", "dirty.md"],
        failed: [],
        stale: []
      }
    );

    expect(message).toContain("Markdownへ反映しました。");
    expect(message).toContain("- ok.md");
    expect(message.match(/dirty\.md/g)).toHaveLength(1);
    expect(message).toContain("../outside.md: ワークスペース外です。");
  });

  it("normalizes common OpenAI API errors into Japanese guidance", () => {
    expect(normalizeAIProviderError("openai-api", new Error("insufficient_quota"))).toContain("利用枠");
    expect(normalizeAIProviderError("openai-api", new Error("rate_limit"))).toContain("一時的に集中");
    expect(normalizeAIProviderError("openai-api", new Error("model_not_found"))).toContain("OpenAIモデル");
    expect(normalizeAIProviderError("codex-app-server", new Error("ENOENT"))).toBe("ENOENT");
  });

  it("builds provider fallback messages without creating Markdown operation text", () => {
    const message = buildAssistantFallback("codex-app-server", "整理して", [{ path: "note.md", preview: "# Note" }], "ENOENT");

    expect(message).toContain("Codex App ServerでAI処理を完了できませんでした。");
    expect(message).toContain("- note.md");
    expect(message).toContain("Markdownの作成・編集・削除案は作っていません。");
  });
});

function operation(filePath: string): AIWorkspaceFileOperation {
  return {
    createdAt: "2026-05-31T00:00:00.000Z",
    id: filePath,
    kind: "update",
    path: filePath,
    status: "pending",
    summary: `update ${filePath}`
  };
}
