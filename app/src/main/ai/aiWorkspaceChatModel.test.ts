import { describe, expect, it } from "vitest";

import { buildOptionalUserHistory, titleFromMessage, upsertChat } from "./aiWorkspaceChatModel";
import type { AIWorkspaceChatData } from "./aiWorkspaceData";

describe("aiWorkspaceChatModel", () => {
  it("creates short chat titles from user messages with whitespace normalized", () => {
    expect(titleFromMessage("  設定資料を\n整理して  ")).toBe("設定資料を 整理して");
    expect(titleFromMessage("")).toBe("新しいチャット");
    expect(titleFromMessage("あ".repeat(40))).toBe(`${"あ".repeat(28)}…`);
  });

  it("upserts chats without duplicating an existing chat id", () => {
    const original = chat("chat-1", "古い題名");
    const updated = chat("chat-1", "新しい題名");

    expect(upsertChat([original], updated)).toEqual([updated]);
    expect(upsertChat([original], chat("chat-2", "別チャット")).map((item) => item.id)).toEqual(["chat-2", "chat-1"]);
  });

  it("builds optional user history only for non-empty messages", () => {
    expect(buildOptionalUserHistory("   ")).toEqual([]);
    expect(buildOptionalUserHistory("反映して")[0]).toMatchObject({
      content: "反映して",
      references: [],
      role: "user"
    });
  });
});

function chat(id: string, title: string): AIWorkspaceChatData {
  return {
    createdAt: "2026-05-31T00:00:00.000Z",
    history: [],
    id,
    operations: [],
    title,
    updatedAt: "2026-05-31T00:00:00.000Z"
  };
}
