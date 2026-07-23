import { app, clipboard, ipcMain, nativeImage, shell } from "electron";
import { stat } from "node:fs/promises";
import path from "node:path";

import {
  copyWorkspaceItemPathChannel,
  type CopyWorkspaceItemPathInput,
  revealWorkspaceItemChannel,
  type RevealWorkspaceItemInput,
  startWorkspaceFileDragChannel,
  type StartWorkspaceFileDragInput
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import {
  resolveExistingWorkspacePath,
  resolveExistingWorkspacePathOrRoot,
  resolveNewWorkspacePath,
  verifyExistingWorkspacePath
} from "../files/paths";
import { getActiveWorkspaceContext, ipcErrorDetails } from "./activeWorkspace";
import {
  isPathInput,
  isRevealWorkspaceItemInput,
  isStartWorkspaceFileDragInput
} from "./fileHandlerValidators";
import { isAuthorizedIpcSender } from "./ipcSenderAuthorization";
import { handleLocalizedIpc } from "./localizedIpcHandler";

export function registerWorkspaceItemHandlers(): void {
  handleLocalizedIpc(
    copyWorkspaceItemPathChannel,
    async (_event, input: CopyWorkspaceItemPathInput): Promise<RelicResult<void>> => {
      try {
        if (!isPathInput(input)) {
          return fail("COPY_PATH_INVALID_INPUT", "コピーする項目を選択してください。");
        }
        const context = await getActiveWorkspaceContext();
        if (!context.ok) return context;
        const absolutePath = await resolveNewWorkspacePath(context.value.activeWorkspace.path, input.path);
        if (!absolutePath.ok) return absolutePath;
        clipboard.writeText(absolutePath.value);
        return ok(undefined);
      } catch (error) {
        return fail("COPY_PATH_FAILED", "ファイルのパスをコピーできませんでした。", ipcErrorDetails(error));
      }
    }
  );

  ipcMain.on(
    startWorkspaceFileDragChannel,
    async (event, input: StartWorkspaceFileDragInput): Promise<void> => {
      try {
        if (!isAuthorizedIpcSender(event.sender)) return;
        if (!isStartWorkspaceFileDragInput(input)) return;
        const context = await getActiveWorkspaceContext();
        if (!context.ok) return;

        const filePaths: string[] = [];
        for (const relativePath of input.paths) {
          const absolutePath = await resolveExistingWorkspacePath(context.value.activeWorkspace.path, relativePath);
          if (!absolutePath.ok) return;
          const fileStat = await stat(absolutePath.value);
          if (!fileStat.isFile()) return;
          const safeDragPath = await verifyExistingWorkspacePath(
            context.value.activeWorkspace.path,
            absolutePath.value
          );
          if (!safeDragPath.ok) return;
          filePaths.push(safeDragPath.value);
        }

        if (filePaths.length === 0) return;
        event.sender.startDrag({
          file: filePaths[0]!,
          files: filePaths,
          icon: workspaceFileDragIcon()
        });
      } catch {
        // Drag start is a fire-and-forget user gesture; invalid or stale paths simply do not start an OS drag.
      }
    }
  );

  handleLocalizedIpc(
    revealWorkspaceItemChannel,
    async (_event, input: RevealWorkspaceItemInput): Promise<RelicResult<void>> => {
      try {
        if (!isRevealWorkspaceItemInput(input)) {
          return fail("REVEAL_INVALID_INPUT", "表示する項目を選択してください。");
        }
        const context = await getActiveWorkspaceContext();
        if (!context.ok) return context;
        const workspaceSummary = input.workspaceId === undefined
          ? context.value.activeWorkspace
          : context.value.settings.workspaces.find((workspace) => workspace.id === input.workspaceId);
        if (!workspaceSummary) {
          return fail("WORKSPACE_NOT_FOUND", "登録済みワークスペースが見つかりませんでした。");
        }
        const absolutePath = await resolveExistingWorkspacePathOrRoot(workspaceSummary.path, input.path);
        if (!absolutePath.ok) return absolutePath;
        const safePath = await verifyExistingWorkspacePath(workspaceSummary.path, absolutePath.value);
        if (!safePath.ok) return safePath;
        shell.showItemInFolder(absolutePath.value);
        return ok(undefined);
      } catch (error) {
        return fail("REVEAL_FAILED", "ファイルの場所を表示できませんでした。", ipcErrorDetails(error));
      }
    }
  );
}

function workspaceFileDragIcon(): Electron.NativeImage {
  const icon = nativeImage.createFromPath(path.join(app.getAppPath(), "assets/icon.iconset/icon_32x32.png"));
  if (!icon.isEmpty()) return icon;
  return nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lDqWqgAAAABJRU5ErkJggg=="
  );
}
