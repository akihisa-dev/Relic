import { describe, expect, it } from "vitest";

import {
  cardForFrontmatterData,
  flavorTextFromMarkdownBody,
  readWorkspaceCards
} from "./cards";

describe("cards", () => {
  it("cardキーがあれば値が空または画像パス以外でもカードとして扱う", () => {
    const file = { name: "Moonlight.md", path: "notes/Moonlight.md" };

    expect(cardForFrontmatterData(file, { card: " ./images/moon.webp " })).toEqual({
      flavorText: null,
      imagePath: "./images/moon.webp",
      name: file.name,
      path: file.path
    });
    expect(cardForFrontmatterData(file, {})).toBeNull();
    expect(cardForFrontmatterData(file, { card: "  " })?.imagePath).toBeNull();
    expect(cardForFrontmatterData(file, { card: null })?.imagePath).toBeNull();
    expect(cardForFrontmatterData(file, { card: true })?.imagePath).toBeNull();
    expect(cardForFrontmatterData(file, { card: 1 })?.imagePath).toBeNull();
    expect(cardForFrontmatterData(file, { card: ["images/moon.webp"] })?.imagePath).toBeNull();
  });

  it("本文で最初に完結したflavortextブロックの改行を保って取り出す", () => {
    expect(flavorTextFromMarkdownBody([
      "# Moonlight",
      "",
      "```js",
      "const ignored = true;",
      "```",
      "",
      "```FlavorText optional-label",
      "",
      "かつて王家の儀礼に用いられた剣。",
      "その光は、持ち主の記憶を映すという。",
      "",
      "```",
      "",
      "```flavortext",
      "二つ目は使わない。",
      "```"
    ].join("\n"))).toBe([
      "かつて王家の儀礼に用いられた剣。",
      "その光は、持ち主の記憶を映すという。"
    ].join("\n"));

    expect(flavorTextFromMarkdownBody("```flavortext\n未完了")).toBeNull();
    expect(flavorTextFromMarkdownBody("本文だけ")).toBeNull();
  });

  it("共有索引の読込済み本文とparse cacheからカード一覧を作る", async () => {
    const result = await readWorkspaceCards("/workspace", {
      fileIndex: {
        entries: [],
        records: [
          {
            kind: "markdown",
            lines: [
              "---",
              "card: ./images/one.webp",
              "---",
              "# One",
              "```flavortext",
              "最初の説明。",
              "二行目。",
              "```"
            ],
            mtimeMs: 1,
            name: "one",
            path: "one.md",
            readStatus: "ok",
            searchable: true,
            size: 40
          },
          {
            kind: "markdown",
            lines: ["---", "card:", "---", "# Two"],
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
      value: [
        {
          flavorText: "最初の説明。\n二行目。",
          imagePath: "./images/one.webp",
          name: "one",
          path: "one.md"
        },
        { flavorText: null, imagePath: null, name: "two", path: "two.md" }
      ]
    });
  });
});
