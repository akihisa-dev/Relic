import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { defaultEditorSettings, defaultFeatureToggles, defaultFrontmatterTemplates, defaultUserDefinedFields } from "../../shared/ipc";
import {
  addOrActivateCardbook,
  activateCardbook,
  createCardbookSummary,
  prepareCardbook,
  renameCardbookRegistration,
  removeCardbookRegistration,
  toCardbookState
} from "./cardbookService";

const baseSettings = {
  editorSettings: defaultEditorSettings,
  featureToggles: defaultFeatureToggles,
  frontmatterTemplates: defaultFrontmatterTemplates,
  userDefinedFields: defaultUserDefinedFields
};

describe("cardbookService", () => {
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

  it("カードブック準備時に専用カードフォルダを作成しない", async () => {
    const cardbookPath = await mkdtemp(path.join(os.tmpdir(), "relic-cardbook-"));
    temporaryPaths.push(cardbookPath);

    await prepareCardbook(cardbookPath);

    expect((await stat(cardbookPath)).isDirectory()).toBe(true);
    await expect(stat(path.join(cardbookPath, "attachments"))).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(stat(path.join(cardbookPath, "templates"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("同じパスのカードブックを重複登録せずアクティブにする", () => {
    const cardbook = createCardbookSummary("/tmp/relic-notes");
    const firstSettings = addOrActivateCardbook(
      { ...baseSettings, lastCardbookId: null, cardbooks: [] },
      cardbook
    );
    const nextSettings = addOrActivateCardbook(firstSettings, cardbook);

    expect(nextSettings.cardbooks).toHaveLength(1);
    expect(toCardbookState(nextSettings).activeCardbook).toEqual(cardbook);
  });

  it("登録済みカードブックをアクティブに切り替える", () => {
    const firstCardbook = createCardbookSummary("/tmp/relic-notes-1");
    const secondCardbook = createCardbookSummary("/tmp/relic-notes-2");

    const settings = {
      ...baseSettings,
      lastCardbookId: firstCardbook.id,
      cardbooks: [firstCardbook, secondCardbook]
    };
    const result = activateCardbook(settings, secondCardbook.id);

    expect(result).toEqual({
      ok: true,
      value: {
        ...baseSettings,
        lastCardbookId: secondCardbook.id,
        cardbooks: [firstCardbook, secondCardbook]
      }
    });
  });

  it("未登録カードブックへの切り替えを拒否する", () => {
    expect(
      activateCardbook(
        { ...baseSettings, lastCardbookId: null, cardbooks: [] },
        "missing"
      ).ok
    ).toBe(false);
  });

  it("登録済みカードブックを一覧から外し、アクティブなら次の候補へ移る", () => {
    const firstCardbook = createCardbookSummary("/tmp/relic-notes-1");
    const secondCardbook = createCardbookSummary("/tmp/relic-notes-2");
    const settings = {
      ...baseSettings,
      lastCardbookId: firstCardbook.id,
      cardbooks: [firstCardbook, secondCardbook]
    };

    const result = removeCardbookRegistration(settings, firstCardbook.id);

    expect(result).toEqual({
      ok: true,
      value: {
        ...baseSettings,
        lastCardbookId: secondCardbook.id,
        cardbooks: [secondCardbook]
      }
    });
  });

  it("登録済みカードブックのカードフォルダ名を変更する", async () => {
    const parentPath = await mkdtemp(path.join(os.tmpdir(), "relic-cardbook-parent-"));
    temporaryPaths.push(parentPath);
    const cardbookPath = path.join(parentPath, "relic-notes");
    await mkdir(cardbookPath);
    await prepareCardbook(cardbookPath);
    const cardbook = createCardbookSummary(cardbookPath);
    const settings = {
      ...baseSettings,
      lastCardbookId: cardbook.id,
      cardbooks: [cardbook]
    };

    const result = await renameCardbookRegistration(settings, cardbook.id, "小説メモ");
    const nextCardbook = createCardbookSummary(path.join(parentPath, "小説メモ"));

    expect(result).toEqual({
      ok: true,
      value: {
        nextSettings: {
          ...baseSettings,
          lastCardbookId: nextCardbook.id,
          cardbooks: [nextCardbook]
        },
        newCardbookId: nextCardbook.id,
        oldCardbookId: cardbook.id
      }
    });
    await expect(stat(path.join(parentPath, "小説メモ"))).resolves.toBeTruthy();
  });

  it("登録済みカードブックの大文字小文字だけの名前変更を許可する", async () => {
    const parentPath = await mkdtemp(path.join(os.tmpdir(), "relic-cardbook-parent-"));
    temporaryPaths.push(parentPath);
    const cardbookPath = path.join(parentPath, "Relic Notes");
    await mkdir(cardbookPath);
    await prepareCardbook(cardbookPath);
    const cardbook = createCardbookSummary(cardbookPath);
    const settings = {
      ...baseSettings,
      lastCardbookId: cardbook.id,
      cardbooks: [cardbook]
    };

    const result = await renameCardbookRegistration(settings, cardbook.id, "relic notes");
    const nextCardbook = createCardbookSummary(path.join(parentPath, "relic notes"));

    expect(result).toEqual({
      ok: true,
      value: {
        nextSettings: {
          ...baseSettings,
          lastCardbookId: nextCardbook.id,
          cardbooks: [nextCardbook]
        },
        newCardbookId: nextCardbook.id,
        oldCardbookId: cardbook.id
      }
    });
  });

  it("空のカードブック名は拒否する", async () => {
    const cardbook = createCardbookSummary("/tmp/relic-notes");
    const result = await renameCardbookRegistration(
      { ...baseSettings, lastCardbookId: cardbook.id, cardbooks: [cardbook] },
      cardbook.id,
      "  "
    );

    expect(result.ok).toBe(false);
  });
});
