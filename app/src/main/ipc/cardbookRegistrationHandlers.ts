import { mkdir } from "node:fs/promises";

import { app, dialog, ipcMain } from "electron";

import {
  createNewCardbookChannel,
  getCardbookStateChannel,
  openCardbookChannel,
  removeCardbookChannel,
  renameCardbookChannel,
  type RemoveCardbookInput,
  type RenameCardbookInput,
  switchCardbookChannel,
  type SwitchCardbookInput,
  togglePinChannel,
  type CardbookState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { getMainTranslator } from "../i18n";
import { readAppSettings, writeAppSettings } from "../settings/appSettings";
import { readCardbookSettings, writeCardbookSettings } from "../settings/cardbookSettings";
import {
  addOrActivateCardbook,
  activateCardbook,
  createCardbookSummary,
  prepareCardbook,
  removeCardbookRegistration,
  renameCardbookRegistration
} from "../cardbook/cardbookService";
import { syncCardbookWatcher } from "../cardbook/cardbookWatcher";
import { ipcErrorDetails } from "./activeCardbook";
import {
  isRenameCardbookInput,
  isSwitchCardbookInput,
  isCardbookIdInput
} from "./cardbookHandlerValidators";
import { buildCardbookState } from "./cardbookState";

export function registerCardbookRegistrationHandlers(): void {
  ipcMain.handle(getCardbookStateChannel, async (): Promise<RelicResult<CardbookState>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      syncCardbookWatcher(settings);

      return ok(await buildCardbookState(settings));
    } catch (error) {
      return fail(
        "CARDBOOK_STATE_FAILED",
        "カードブック情報を読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(openCardbookChannel, async (): Promise<RelicResult<CardbookState>> => {
    try {
      const t = await getMainTranslator();
      const selection = await dialog.showOpenDialog({
        buttonLabel: t("dialogs.openCardbookButton"),
        message: t("dialogs.openCardbookMessage"),
        properties: ["openDirectory", "createDirectory"]
      });

      if (selection.canceled || selection.filePaths.length === 0) {
        const settings = await readAppSettings(app.getPath("userData"));
        syncCardbookWatcher(settings);

        return ok(await buildCardbookState(settings));
      }

      const cardbook = createCardbookSummary(selection.filePaths[0]);
      await prepareCardbook(cardbook.path);

      const settings = await readAppSettings(app.getPath("userData"));
      const nextSettings = addOrActivateCardbook(settings, cardbook);
      await writeAppSettings(app.getPath("userData"), nextSettings);
      syncCardbookWatcher(nextSettings);

      return ok(await buildCardbookState(nextSettings));
    } catch (error) {
      return fail(
        "CARDBOOK_OPEN_FAILED",
        "カードブックを開けませんでした。カードフォルダの権限や保存場所を確認してください。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(createNewCardbookChannel, async (): Promise<RelicResult<CardbookState>> => {
    try {
      const t = await getMainTranslator();
      const selection = await dialog.showSaveDialog({
        buttonLabel: t("dialogs.createCardbookButton"),
        message: t("dialogs.createCardbookMessage"),
        nameFieldLabel: t("dialogs.cardbookName"),
        showsTagField: false
      });

      if (selection.canceled || !selection.filePath) {
        const settings = await readAppSettings(app.getPath("userData"));
        syncCardbookWatcher(settings);

        return ok(await buildCardbookState(settings));
      }

      await mkdir(selection.filePath, { recursive: true });
      const cardbook = createCardbookSummary(selection.filePath);
      await prepareCardbook(cardbook.path);

      const settings = await readAppSettings(app.getPath("userData"));
      const nextSettings = addOrActivateCardbook(settings, cardbook);
      await writeAppSettings(app.getPath("userData"), nextSettings);
      syncCardbookWatcher(nextSettings);

      return ok(await buildCardbookState(nextSettings));
    } catch (error) {
      return fail(
        "CARDBOOK_CREATE_FAILED",
        "カードブックを作成できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(togglePinChannel, async (_event, path: unknown): Promise<RelicResult<CardbookState>> => {
    try {
      if (typeof path !== "string") {
        return fail("TOGGLE_PIN_INVALID_INPUT", "パスが無効です。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const activeCardbook = settings.cardbooks.find((ws) => ws.id === settings.lastCardbookId);

      if (!activeCardbook) {
        return fail("TOGGLE_PIN_NO_CARDBOOK", "アクティブなカードブックがありません。");
      }

      const wsSettings = await readCardbookSettings(app.getPath("userData"), activeCardbook.id);
      const updated = wsSettings.pinnedPaths.includes(path)
        ? wsSettings.pinnedPaths.filter((p) => p !== path)
        : [...wsSettings.pinnedPaths, path];

      await writeCardbookSettings(app.getPath("userData"), activeCardbook.id, {
        ...wsSettings,
        pinnedPaths: updated
      });

      return ok(await buildCardbookState(settings));
    } catch (error) {
      return fail(
        "TOGGLE_PIN_FAILED",
        "ピン留め操作に失敗しました。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(
    switchCardbookChannel,
    async (_event, input: SwitchCardbookInput): Promise<RelicResult<CardbookState>> => {
      try {
        if (!isSwitchCardbookInput(input)) {
          return fail("CARDBOOK_SWITCH_INVALID_INPUT", "カードブックを選択してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const nextSettings = activateCardbook(settings, input.cardbookId);

        if (!nextSettings.ok) {
          return nextSettings;
        }

        const activeCardbook = nextSettings.value.cardbooks.find(
          (cardbook) => cardbook.id === input.cardbookId
        );

        if (!activeCardbook) {
          return fail("CARDBOOK_NOT_FOUND", "登録済みカードブックが見つかりませんでした。");
        }

        await prepareCardbook(activeCardbook.path);
        await writeAppSettings(app.getPath("userData"), nextSettings.value);
        syncCardbookWatcher(nextSettings.value);

        return ok(await buildCardbookState(nextSettings.value));
      } catch (error) {
        return fail(
          "CARDBOOK_SWITCH_FAILED",
          "カードブックを切り替えられませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );

  ipcMain.handle(
    removeCardbookChannel,
    async (_event, input: RemoveCardbookInput): Promise<RelicResult<CardbookState>> => {
      try {
        if (!isCardbookIdInput(input)) {
          return fail("CARDBOOK_REMOVE_INVALID_INPUT", "カードブックを選択してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const nextSettings = removeCardbookRegistration(settings, input.cardbookId);

        if (!nextSettings.ok) {
          return nextSettings;
        }

        await writeAppSettings(app.getPath("userData"), nextSettings.value);
        syncCardbookWatcher(nextSettings.value);

        return ok(await buildCardbookState(nextSettings.value));
      } catch (error) {
        return fail(
          "CARDBOOK_REMOVE_FAILED",
          "カードブックを一覧から削除できませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );

  ipcMain.handle(
    renameCardbookChannel,
    async (_event, input: RenameCardbookInput): Promise<RelicResult<CardbookState>> => {
      try {
        if (!isRenameCardbookInput(input)) {
          return fail("CARDBOOK_RENAME_INVALID_INPUT", "カードブック名を入力してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const renameResult = await renameCardbookRegistration(settings, input.cardbookId, input.name);

        if (!renameResult.ok) {
          return renameResult;
        }

        if (renameResult.value.oldCardbookId !== renameResult.value.newCardbookId) {
          const cardbookSettings = await readCardbookSettings(
            app.getPath("userData"),
            renameResult.value.oldCardbookId
          );
          await writeCardbookSettings(
            app.getPath("userData"),
            renameResult.value.newCardbookId,
            cardbookSettings
          );
        }

        await writeAppSettings(app.getPath("userData"), renameResult.value.nextSettings);
        syncCardbookWatcher(renameResult.value.nextSettings);

        return ok(await buildCardbookState(renameResult.value.nextSettings));
      } catch (error) {
        return fail(
          "CARDBOOK_RENAME_FAILED",
          "カードブック名を変更できませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );
}
