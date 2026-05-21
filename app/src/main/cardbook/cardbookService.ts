import { rename, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import type { CardbookState, CardbookSummary, CardbookTreeNode } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import type { AppSettings } from "../settings/appSettings";
import { validateBaseName } from "../cards/names";

export function createCardbookSummary(cardbookPath: string): CardbookSummary {
  const normalizedPath = path.resolve(cardbookPath);

  return {
    id: createHash("sha256").update(normalizedPath).digest("hex").slice(0, 16),
    name: path.basename(normalizedPath),
    path: normalizedPath
  };
}

export async function prepareCardbook(cardbookPath: string): Promise<void> {
  await stat(cardbookPath);
}

export function addOrActivateCardbook(
  settings: AppSettings,
  cardbook: CardbookSummary
): AppSettings {
  const existingIndex = settings.cardbooks.findIndex((item) => item.id === cardbook.id);
  const cardbooks = [...settings.cardbooks];

  if (existingIndex >= 0) {
    cardbooks[existingIndex] = cardbook;
  } else {
    cardbooks.push(cardbook);
  }

  return {
    ...settings,
    lastCardbookId: cardbook.id,
    cardbooks
  };
}

export function activateCardbook(settings: AppSettings, cardbookId: string): RelicResult<AppSettings> {
  if (!settings.cardbooks.some((cardbook) => cardbook.id === cardbookId)) {
    return fail("CARDBOOK_NOT_FOUND", "登録済みカードブックが見つかりませんでした。");
  }

  return ok({
    ...settings,
    lastCardbookId: cardbookId
  });
}

export function removeCardbookRegistration(
  settings: AppSettings,
  cardbookId: string
): RelicResult<AppSettings> {
  if (!settings.cardbooks.some((cardbook) => cardbook.id === cardbookId)) {
    return fail("CARDBOOK_NOT_FOUND", "登録済みカードブックが見つかりませんでした。");
  }

  const cardbooks = settings.cardbooks.filter((cardbook) => cardbook.id !== cardbookId);
  const lastCardbookId =
    settings.lastCardbookId === cardbookId
      ? cardbooks.at(0)?.id ?? null
      : settings.lastCardbookId;

  return ok({
    ...settings,
    lastCardbookId,
    cardbooks
  });
}

export interface RenamedCardbookRegistration {
  nextSettings: AppSettings;
  newCardbookId: string;
  oldCardbookId: string;
}

export async function renameCardbookRegistration(
  settings: AppSettings,
  cardbookId: string,
  name: string
): Promise<RelicResult<RenamedCardbookRegistration>> {
  const validatedName = validateBaseName(name, "カードブック名を入力してください。");

  if (!validatedName.ok) {
    return validatedName;
  }

  const cardbook = settings.cardbooks.find((item) => item.id === cardbookId);

  if (!cardbook) {
    return fail("CARDBOOK_NOT_FOUND", "登録済みカードブックが見つかりませんでした。");
  }

  const nextPath = path.join(path.dirname(cardbook.path), validatedName.value);
  const nextCardbook = createCardbookSummary(nextPath);

  if (cardbook.path === nextCardbook.path) {
    return ok({
      nextSettings: settings,
      newCardbookId: cardbook.id,
      oldCardbookId: cardbook.id
    });
  }

  try {
    const sourceStats = await stat(cardbook.path);

    if (!sourceStats.isDirectory()) {
      return fail("CARDBOOK_RENAME_NOT_DIRECTORY", "カードブック用ディレクトリが見つかりませんでした。");
    }

    let targetIsSourceDirectory = false;

    try {
      const targetStats = await stat(nextCardbook.path);
      if (sourceStats.dev !== targetStats.dev || sourceStats.ino !== targetStats.ino) {
        return fail("CARDBOOK_ALREADY_EXISTS", "同じ名前のカードフォルダがすでにあります。");
      }
      targetIsSourceDirectory = true;
    } catch (error) {
      if (!isMissingCardError(error)) throw error;
    }

    if (targetIsSourceDirectory) {
      const temporaryPath = path.join(
        path.dirname(cardbook.path),
        `.relic-rename-${nextCardbook.id}-${Date.now()}`
      );
      await rename(cardbook.path, temporaryPath);
      await rename(temporaryPath, nextCardbook.path);
    } else {
      await rename(cardbook.path, nextCardbook.path);
    }

    const nextSettings: AppSettings = {
      ...settings,
      lastCardbookId: settings.lastCardbookId === cardbook.id
        ? nextCardbook.id
        : settings.lastCardbookId,
      cardbooks: settings.cardbooks.map((item) => (
        item.id === cardbook.id ? nextCardbook : item
      ))
    };

    return ok({
      nextSettings,
      newCardbookId: nextCardbook.id,
      oldCardbookId: cardbook.id
    });
  } catch (error) {
    return fail(
      "CARDBOOK_RENAME_FAILED",
      "カードブック名を変更できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export function toCardbookState(
  settings: AppSettings,
  cardTree: CardbookTreeNode[] = [],
  pinnedPaths: string[] = []
): CardbookState {
  const activeCardbook =
    settings.cardbooks.find((cardbook) => cardbook.id === settings.lastCardbookId) ?? null;

  return {
    activeCardbook,
    cardTree,
    pinnedPaths,
    cardbooks: settings.cardbooks
  };
}

function isMissingCardError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
