import { describe, expect, it } from "vitest";

import { cardForFrontmatterData, readWorkspaceCards } from "./cards";

describe("cards", () => {
  it("cardの空でない文字列だけをカードとして扱う", () => {
    const file = { name: "Moonlight.md", path: "notes/Moonlight.md" };

    expect(cardForFrontmatterData(file, { card: " ./images/moon.webp " })).toEqual({
      imagePath: "./images/moon.webp",
      name: file.name,
      path: file.path
    });
    expect(cardForFrontmatterData(file, {})).toBeNull();
    expect(cardForFrontmatterData(file, { card: "  " })).toBeNull();
    expect(cardForFrontmatterData(file, { card: true })).toBeNull();
    expect(cardForFrontmatterData(file, { card: 1 })).toBeNull();
    expect(cardForFrontmatterData(file, { card: ["images/moon.webp"] })).toBeNull();
  });

  it("共有索引の読込済み本文とparse cacheからカード一覧を作る", async () => {
    const result = await readWorkspaceCards("/workspace", {
      fileIndex: {
        entries: [],
        records: [
          {
            kind: "markdown",
            lines: ["---", "card: ./images/one.webp", "---", "# One"],
            mtimeMs: 1,
            name: "one",
            path: "one.md",
            readStatus: "ok",
            searchable: true,
            size: 40
          },
          {
            kind: "markdown",
            lines: ["---", "card: false", "---", "# Two"],
            mtimeMs: 1,
            name: "two",
            path: "two.md",
            readStatus: "ok",
            searchable: true,
            size: 30
          }
        ],
        stats: {
          cacheHitCount: 0,
          cachedContentHitCount: 0,
          cacheMissCount: 0,
          readFileCount: 0,
          readHeadCount: 0,
          statCount: 0,
          targetPathCount: 2,
          unreadableCount: 0
        }
      }
    });

    expect(result).toEqual({
      ok: true,
      value: [{ imagePath: "./images/one.webp", name: "one", path: "one.md" }]
    });
  });
});
