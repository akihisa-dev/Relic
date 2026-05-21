import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createMarkdownCard,
  createMarkdownCardAtPath,
  duplicateMarkdownCard,
  moveMarkdownCard,
  normalizeMarkdownCardName,
  readMarkdownCard,
  renameMarkdownCard
} from "./markdownCards";

describe("normalizeMarkdownCardName", () => {
  it("拡張子なしのカード名に .md を付与する", () => {
    expect(normalizeMarkdownCardName("読書メモ")).toEqual({
      ok: true,
      value: "読書メモ.md"
    });
  });

  it("スラッシュを含むカード名を拒否する", () => {
    expect(normalizeMarkdownCardName("notes/読書メモ").ok).toBe(false);
  });
});

describe("createMarkdownCard", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("Markdownカードを空の本文で作成する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-create-card-"));
    temporaryPaths.push(cardbookPath);

    await expect(createMarkdownCard(cardbookPath, "読書メモ")).resolves.toEqual({
      ok: true,
      value: {
        path: "読書メモ.md"
      }
    });
    await expect(readFile(path.join(cardbookPath, "読書メモ.md"), "utf8")).resolves.toBe("");
  });

  it("同名カードがある場合は上書きしない", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-create-card-"));
    temporaryPaths.push(cardbookPath);

    await writeFile(path.join(cardbookPath, "読書メモ.md"), "既存", "utf8");

    const result = await createMarkdownCard(cardbookPath, "読書メモ");

    expect(result.ok).toBe(false);
    await expect(readFile(path.join(cardbookPath, "読書メモ.md"), "utf8")).resolves.toBe("既存");
  });

});

describe("createMarkdownCardAtPath", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("カードブック相対パスにMarkdownカードを作成する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-create-linked-card-"));
    temporaryPaths.push(cardbookPath);

    await expect(createMarkdownCardAtPath(cardbookPath, "cardFolder/新規ノート.md")).resolves.toEqual({
      ok: true,
      value: {
        content: "",
        name: "新規ノート",
        path: "cardFolder/新規ノート.md"
      }
    });
    await expect(readFile(path.join(cardbookPath, "cardFolder", "新規ノート.md"), "utf8")).resolves.toBe("");
  });

  it("カードブック外とMarkdown以外への作成を拒否する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-create-linked-card-"));
    temporaryPaths.push(cardbookPath);

    await expect(createMarkdownCardAtPath(cardbookPath, "../outside.md")).resolves.toMatchObject({
      ok: false
    });
    await expect(createMarkdownCardAtPath(cardbookPath, "image.png")).resolves.toMatchObject({
      ok: false
    });
  });
});

describe("readMarkdownCard", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("カードブック内のMarkdownカードを読み込む", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-read-card-"));
    temporaryPaths.push(cardbookPath);

    await writeFile(path.join(cardbookPath, "読書メモ.md"), "# 読書メモ", "utf8");

    await expect(readMarkdownCard(cardbookPath, "読書メモ.md")).resolves.toEqual({
      ok: true,
      value: {
        content: "# 読書メモ",
        name: "読書メモ",
        path: "読書メモ.md"
      }
    });
  });

  it("Markdown以外とカードブック外への参照を拒否する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-read-card-"));
    temporaryPaths.push(cardbookPath);

    await expect(readMarkdownCard(cardbookPath, "image.png")).resolves.toMatchObject({
      ok: false
    });
    await expect(readMarkdownCard(cardbookPath, "../outside.md")).resolves.toMatchObject({
      ok: false
    });
  });
});

describe("renameMarkdownCard", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("Markdownカード名を変更する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-card-"));
    temporaryPaths.push(cardbookPath);

    await writeFile(path.join(cardbookPath, "before.md"), "# Before", "utf8");

    await expect(renameMarkdownCard(cardbookPath, "before.md", "after")).resolves.toEqual({
      ok: true,
      value: {
        content: "# Before",
        name: "after",
        path: "after.md"
      }
    });
    await expect(readFile(path.join(cardbookPath, "after.md"), "utf8")).resolves.toBe("# Before");
  });

  it("同名カードがある場合は上書きしない", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-card-"));
    temporaryPaths.push(cardbookPath);

    await writeFile(path.join(cardbookPath, "before.md"), "before", "utf8");
    await writeFile(path.join(cardbookPath, "after.md"), "after", "utf8");

    const result = await renameMarkdownCard(cardbookPath, "before.md", "after");

    expect(result.ok).toBe(false);
    await expect(readFile(path.join(cardbookPath, "before.md"), "utf8")).resolves.toBe("before");
    await expect(readFile(path.join(cardbookPath, "after.md"), "utf8")).resolves.toBe("after");
  });

  it("Markdown以外とカードブック外への参照を拒否する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-rename-card-"));
    temporaryPaths.push(cardbookPath);

    await expect(renameMarkdownCard(cardbookPath, "image.png", "image2")).resolves.toMatchObject({
      ok: false
    });
    await expect(renameMarkdownCard(cardbookPath, "../outside.md", "inside")).resolves.toMatchObject({
      ok: false
    });
  });
});

describe("duplicateMarkdownCard", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("同じカードフォルダにMarkdownカードを複製する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-duplicate-card-"));
    temporaryPaths.push(cardbookPath);

    await writeFile(path.join(cardbookPath, "読書メモ.md"), "# 読書メモ", "utf8");

    await expect(duplicateMarkdownCard(cardbookPath, "読書メモ.md")).resolves.toEqual({
      ok: true,
      value: {
        content: "# 読書メモ",
        name: "読書メモ のコピー",
        path: "読書メモ のコピー.md"
      }
    });
    await expect(readFile(path.join(cardbookPath, "読書メモ のコピー.md"), "utf8")).resolves.toBe(
      "# 読書メモ"
    );
  });

  it("コピー名が既にある場合は連番で複製する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-duplicate-card-"));
    temporaryPaths.push(cardbookPath);

    await writeFile(path.join(cardbookPath, "読書メモ.md"), "original", "utf8");
    await writeFile(path.join(cardbookPath, "読書メモ のコピー.md"), "copy", "utf8");

    await expect(duplicateMarkdownCard(cardbookPath, "読書メモ.md")).resolves.toMatchObject({
      ok: true,
      value: {
        path: "読書メモ のコピー 2.md"
      }
    });
  });

  it("Markdown以外とカードブック外への参照を拒否する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-duplicate-card-"));
    temporaryPaths.push(cardbookPath);

    await expect(duplicateMarkdownCard(cardbookPath, "image.png")).resolves.toMatchObject({
      ok: false
    });
    await expect(duplicateMarkdownCard(cardbookPath, "../outside.md")).resolves.toMatchObject({
      ok: false
    });
  });
});

describe("moveMarkdownCard", () => {
  const temporaryPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryPaths.splice(0).map((temporaryPath) =>
        rm(temporaryPath, {
          force: true,
          recursive: true
        })
      )
    );
  });

  it("Markdownカードを別カードフォルダへ移動する", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-move-card-"));
    temporaryPaths.push(cardbookPath);

    await mkdir(path.join(cardbookPath, "archive"));
    await writeFile(path.join(cardbookPath, "note.md"), "# Note", "utf8");

    await expect(moveMarkdownCard(cardbookPath, "note.md", "archive")).resolves.toEqual({
      ok: true,
      value: {
        content: "# Note",
        name: "note",
        path: "archive/note.md"
      }
    });
    await expect(readFile(path.join(cardbookPath, "archive/note.md"), "utf8")).resolves.toBe("# Note");
  });

  it("移動先に同名カードがある場合は上書きしない", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-move-card-"));
    temporaryPaths.push(cardbookPath);

    await mkdir(path.join(cardbookPath, "archive"));
    await writeFile(path.join(cardbookPath, "note.md"), "source", "utf8");
    await writeFile(path.join(cardbookPath, "archive/note.md"), "existing", "utf8");

    await expect(moveMarkdownCard(cardbookPath, "note.md", "archive")).resolves.toMatchObject({
      ok: false
    });
    await expect(readFile(path.join(cardbookPath, "note.md"), "utf8")).resolves.toBe("source");
    await expect(readFile(path.join(cardbookPath, "archive/note.md"), "utf8")).resolves.toBe("existing");
  });
});
