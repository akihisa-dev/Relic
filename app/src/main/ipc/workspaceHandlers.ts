import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { app, dialog, ipcMain, shell } from "electron";

import {
  createFolderChannel,
  type CreateFolderInput,
  createGitCommitChannel,
  type CreateGitCommitInput,
  createLinkedMarkdownFileChannel,
  type CreateLinkedMarkdownFileInput,
  createMarkdownFileChannel,
  type CreateMarkdownFileInput,
  duplicateMarkdownFileChannel,
  type DuplicateMarkdownFileInput,
  getBacklinksChannel,
  type GetBacklinksInput,
  getGitCommitHistoryChannel,
  getGitCommitDiffChannel,
  getGitStatusChannel,
  getGitWorkingChangesChannel,
  getWorkspaceTagsChannel,
  getWorkspaceStateChannel,
  initializeGitRepositoryChannel,
  moveFolderChannel,
  type MoveFolderInput,
  moveItemToTrashChannel,
  type MoveItemToTrashInput,
  moveMarkdownFileChannel,
  type MoveMarkdownFileInput,
  openWorkspaceChannel,
  readMarkdownFileChannel,
  type ReadMarkdownFileInput,
  renameFolderChannel,
  type RenameFolderInput,
  renameMarkdownFileChannel,
  type RenameMarkdownFileInput,
  applySearchAndReplaceChannel,
  replaceInFileChannel,
  type ReplaceInFileInput,
  searchAndReplaceChannel,
  type SearchAndReplaceInput,
  searchWorkspaceChannel,
  type SearchWorkspaceInput,
  switchWorkspaceChannel,
  type SwitchWorkspaceInput,
  type GitStatus,
  type GitCommitSummary,
  type GitCommitDiff,
  type GitWorkingChange,
  type WorkspaceState,
  getFrontmatterCandidatesChannel,
  createFrontmatterTemplateChannel
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readBacklinks } from "../files/backlinks";
import { readWorkspaceFileTree } from "../files/fileTree";
import { createFolder, moveFolder, renameFolder } from "../files/folders";
import {
  createGitCommit,
  initializeGitRepository,
  readGitCommitDiff,
  readGitCommitHistory,
  readGitStatus,
  readGitWorkingChanges
} from "../files/git";
import {
  createMarkdownFileAtPath,
  createMarkdownFile,
  duplicateMarkdownFile,
  moveMarkdownFile,
  readMarkdownFile,
  renameMarkdownFile
} from "../files/markdownFiles";
import { applySearchAndReplace, replaceInFile, searchAndReplace } from "../files/replace";
import { moveWorkspaceItemToTrash } from "../files/trash";
import { parseFrontmatterCandidates } from "../files/frontmatter";
import { readWorkspaceTags } from "../files/tags";
import { searchWorkspace } from "../files/search";
import { readAppSettings, writeAppSettings } from "../settings/appSettings";
import {
  addOrActivateWorkspace,
  activateWorkspace,
  createWorkspaceSummary,
  prepareWorkspace,
  toWorkspaceState
} from "../workspace/workspaceService";

export function registerWorkspaceHandlers(): void {
  ipcMain.handle(getWorkspaceStateChannel, async (): Promise<RelicResult<WorkspaceState>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));

      return ok(await buildWorkspaceState(settings));
    } catch (error) {
      return fail(
        "WORKSPACE_STATE_FAILED",
        "ワークスペース情報を読み込めませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getWorkspaceTagsChannel, async () => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readWorkspaceTags(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "TAGS_READ_FAILED",
        "タグを読み込めませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getGitStatusChannel, async (): Promise<RelicResult<GitStatus>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readGitStatus(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_STATUS_FAILED",
        "Git状態を取得できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getGitWorkingChangesChannel, async (): Promise<RelicResult<GitWorkingChange[]>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readGitWorkingChanges(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_WORKING_CHANGES_FAILED",
        "変更一覧を取得できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getGitCommitHistoryChannel, async (): Promise<RelicResult<GitCommitSummary[]>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readGitCommitHistory(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_HISTORY_FAILED",
        "コミット履歴を取得できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getGitCommitDiffChannel, async (_event, hash: string): Promise<RelicResult<GitCommitDiff>> => {
    try {
      if (typeof hash !== "string" || hash.trim() === "") {
        return fail("GIT_COMMIT_NOT_FOUND", "表示するコミットを選択してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readGitCommitDiff(state.activeWorkspace.path, hash);
    } catch (error) {
      return fail(
        "GIT_COMMIT_DIFF_FAILED",
        "コミット差分を取得できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(searchWorkspaceChannel, async (_event, input: SearchWorkspaceInput) => {
    try {
      if (!isSearchWorkspaceInput(input)) {
        return fail("SEARCH_INVALID_INPUT", "検索語句を入力してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return searchWorkspace(state.activeWorkspace.path, input.query, input.mode, input.frontmatterField);
    } catch (error) {
      return fail(
        "SEARCH_FAILED",
        "検索できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(openWorkspaceChannel, async (): Promise<RelicResult<WorkspaceState>> => {
    try {
      const selection = await dialog.showOpenDialog({
        buttonLabel: "開く",
        message: "Relicで使うワークスペースフォルダを選んでください。",
        properties: ["openDirectory", "createDirectory"]
      });

      if (selection.canceled || selection.filePaths.length === 0) {
        const settings = await readAppSettings(app.getPath("userData"));

        return ok(await buildWorkspaceState(settings));
      }

      const workspace = createWorkspaceSummary(selection.filePaths[0]);
      await prepareWorkspace(workspace.path);

      const settings = await readAppSettings(app.getPath("userData"));
      const nextSettings = addOrActivateWorkspace(settings, workspace);
      await writeAppSettings(app.getPath("userData"), nextSettings);

      return ok(await buildWorkspaceState(nextSettings));
    } catch (error) {
      return fail(
        "WORKSPACE_OPEN_FAILED",
        "ワークスペースを開けませんでした。フォルダの権限や保存場所を確認してください。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(
    createMarkdownFileChannel,
    async (_event, input: CreateMarkdownFileInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isCreateMarkdownFileInput(input)) {
          return fail("FILE_CREATE_INVALID_INPUT", "ファイル名を入力してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const state = toWorkspaceState(settings);

        if (!state.activeWorkspace) {
          return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
        }

        const createdFile = await createMarkdownFile(state.activeWorkspace.path, input.name);

        if (!createdFile.ok) {
          return createdFile;
        }

        return ok(await buildWorkspaceState(settings));
      } catch (error) {
        return fail(
          "FILE_CREATE_FAILED",
          "ファイルを作成できませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  ipcMain.handle(
    createLinkedMarkdownFileChannel,
    async (_event, input: CreateLinkedMarkdownFileInput) => {
      try {
        if (!isPathInput(input)) {
          return fail("FILE_CREATE_INVALID_INPUT", "作成するファイルを指定してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const state = toWorkspaceState(settings);

        if (!state.activeWorkspace) {
          return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
        }

        const createdFile = await createMarkdownFileAtPath(state.activeWorkspace.path, input.path);

        if (!createdFile.ok) {
          return createdFile;
        }

        return ok({
          file: createdFile.value,
          workspaceState: await buildWorkspaceState(settings)
        });
      } catch (error) {
        return fail(
          "FILE_CREATE_FAILED",
          "ファイルを作成できませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  ipcMain.handle(
    createFolderChannel,
    async (_event, input: CreateFolderInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isNameInput(input)) {
          return fail("FOLDER_CREATE_INVALID_INPUT", "フォルダ名を入力してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const state = toWorkspaceState(settings);

        if (!state.activeWorkspace) {
          return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
        }

        const createdFolder = await createFolder(state.activeWorkspace.path, input.name);

        if (!createdFolder.ok) {
          return createdFolder;
        }

        return ok(await buildWorkspaceState(settings));
      } catch (error) {
        return fail(
          "FOLDER_CREATE_FAILED",
          "フォルダを作成できませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  ipcMain.handle(readMarkdownFileChannel, async (_event, input: ReadMarkdownFileInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("FILE_READ_INVALID_INPUT", "ファイルパスを指定してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readMarkdownFile(state.activeWorkspace.path, input.path);
    } catch (error) {
      return fail(
        "FILE_READ_FAILED",
        "ファイルを読み込めませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getBacklinksChannel, async (_event, input: GetBacklinksInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("BACKLINKS_INVALID_INPUT", "バックリンクを確認するファイルを指定してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readBacklinks(state.activeWorkspace.path, input.path);
    } catch (error) {
      return fail(
        "BACKLINKS_READ_FAILED",
        "バックリンクを読み込めませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(duplicateMarkdownFileChannel, async (_event, input: DuplicateMarkdownFileInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("FILE_DUPLICATE_INVALID_INPUT", "複製するファイルを選択してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      const duplicatedFile = await duplicateMarkdownFile(state.activeWorkspace.path, input.path);

      if (!duplicatedFile.ok) {
        return duplicatedFile;
      }

      return ok({
        file: duplicatedFile.value,
        workspaceState: await buildWorkspaceState(settings)
      });
    } catch (error) {
      return fail(
        "FILE_DUPLICATE_FAILED",
        "ファイルを複製できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(renameMarkdownFileChannel, async (_event, input: RenameMarkdownFileInput) => {
    try {
      if (!isRenameMarkdownFileInput(input)) {
        return fail("FILE_RENAME_INVALID_INPUT", "変更後のファイル名を入力してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      const renamedFile = await renameMarkdownFile(
        state.activeWorkspace.path,
        input.path,
        input.newName
      );

      if (!renamedFile.ok) {
        return renamedFile;
      }

      return ok({
        file: renamedFile.value,
        workspaceState: await buildWorkspaceState(settings)
      });
    } catch (error) {
      return fail(
        "FILE_RENAME_FAILED",
        "ファイル名を変更できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(moveMarkdownFileChannel, async (_event, input: MoveMarkdownFileInput) => {
    try {
      if (!isMoveMarkdownFileInput(input)) {
        return fail("FILE_MOVE_INVALID_INPUT", "移動先フォルダを指定してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      const movedFile = await moveMarkdownFile(
        state.activeWorkspace.path,
        input.path,
        input.destinationFolder
      );

      if (!movedFile.ok) {
        return movedFile;
      }

      return ok({
        file: movedFile.value,
        workspaceState: await buildWorkspaceState(settings)
      });
    } catch (error) {
      return fail(
        "FILE_MOVE_FAILED",
        "ファイルを移動できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(moveFolderChannel, async (_event, input: MoveFolderInput) => {
    try {
      if (!isMoveFolderInput(input)) {
        return fail("FOLDER_MOVE_INVALID_INPUT", "移動先フォルダを指定してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      const movedFolder = await moveFolder(
        state.activeWorkspace.path,
        input.path,
        input.destinationFolder
      );

      if (!movedFolder.ok) {
        return movedFolder;
      }

      return ok(await buildWorkspaceState(settings));
    } catch (error) {
      return fail(
        "FOLDER_MOVE_FAILED",
        "フォルダを移動できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(replaceInFileChannel, async (_event, input: ReplaceInFileInput) => {
    try {
      if (!isReplaceInFileInput(input)) {
        return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return replaceInFile(
        state.activeWorkspace.path,
        input.path,
        input.searchQuery,
        input.replacement,
        input.isRegex
      );
    } catch (error) {
      return fail(
        "REPLACE_FAILED",
        "置換できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(searchAndReplaceChannel, async (_event, input: SearchAndReplaceInput) => {
    try {
      if (!isSearchAndReplaceInput(input)) {
        return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return searchAndReplace(
        state.activeWorkspace.path,
        input.searchQuery,
        input.replacement,
        input.isRegex
      );
    } catch (error) {
      return fail(
        "REPLACE_FAILED",
        "置換プレビューを生成できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(applySearchAndReplaceChannel, async (_event, input: SearchAndReplaceInput) => {
    try {
      if (!isSearchAndReplaceInput(input)) {
        return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return applySearchAndReplace(
        state.activeWorkspace.path,
        input.searchQuery,
        input.replacement,
        input.isRegex
      );
    } catch (error) {
      return fail(
        "REPLACE_FAILED",
        "一括置換できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(renameFolderChannel, async (_event, input: RenameFolderInput) => {
    try {
      if (!isRenameFolderInput(input)) {
        return fail("FOLDER_RENAME_INVALID_INPUT", "変更後のフォルダ名を入力してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      const renamedFolder = await renameFolder(state.activeWorkspace.path, input.path, input.newName);

      if (!renamedFolder.ok) {
        return renamedFolder;
      }

      return ok(await buildWorkspaceState(settings));
    } catch (error) {
      return fail(
        "FOLDER_RENAME_FAILED",
        "フォルダ名を変更できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(
    moveItemToTrashChannel,
    async (_event, input: MoveItemToTrashInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isMoveItemToTrashInput(input)) {
          return fail("TRASH_MOVE_INVALID_INPUT", "ゴミ箱に移動する項目を選択してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const state = toWorkspaceState(settings);

        if (!state.activeWorkspace) {
          return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
        }

        const movedItem = await moveWorkspaceItemToTrash(
          state.activeWorkspace.path,
          input.path,
          input.type,
          shell.trashItem
        );

        if (!movedItem.ok) {
          return movedItem;
        }

        return ok(await buildWorkspaceState(settings));
      } catch (error) {
        return fail(
          "TRASH_MOVE_FAILED",
          "ゴミ箱に移動できませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  ipcMain.handle(getFrontmatterCandidatesChannel, async (): Promise<RelicResult<Record<string, string[]>>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const activeWorkspace = settings.workspaces.find((ws) => ws.id === settings.lastWorkspaceId);

      if (!activeWorkspace) {
        return ok({});
      }

      const filePath = path.join(activeWorkspace.path, "frontmatter.md");

      try {
        const content = await readFile(filePath, "utf8");
        const candidates = parseFrontmatterCandidates(content);
        const result: Record<string, string[]> = {};

        for (const [field, values] of candidates) {
          result[field] = values;
        }

        return ok(result);
      } catch {
        return ok({});
      }
    } catch (error) {
      return fail("FRONTMATTER_CANDIDATES_FAILED", String(error));
    }
  });

  ipcMain.handle(createFrontmatterTemplateChannel, async (): Promise<RelicResult<WorkspaceState>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const activeWorkspace = settings.workspaces.find((ws) => ws.id === settings.lastWorkspaceId);

      if (!activeWorkspace) {
        return fail("NO_WORKSPACE", "ワークスペースが開かれていません。");
      }

      const filePath = path.join(activeWorkspace.path, "frontmatter.md");
      const template = [
        "# フロントマター候補",
        "",
        "## status",
        "- draft",
        "- review",
        "- published",
        "",
        "## author",
        ""
      ].join("\n");

      await writeFile(filePath, template, { encoding: "utf8", flag: "wx" });

      return ok(await buildWorkspaceState(settings));
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "EEXIST") {
        return fail("FRONTMATTER_TEMPLATE_EXISTS", "frontmatter.md はすでに存在します。");
      }

      return fail("FRONTMATTER_TEMPLATE_FAILED", String(error));
    }
  });

  ipcMain.handle(initializeGitRepositoryChannel, async (): Promise<RelicResult<GitStatus>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return initializeGitRepository(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_INIT_FAILED",
        "Gitリポジトリを初期化できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(createGitCommitChannel, async (_event, input: CreateGitCommitInput): Promise<RelicResult<GitCommitSummary>> => {
    try {
      if (!isCreateGitCommitInput(input)) {
        return fail("GIT_COMMIT_INVALID_INPUT", "コミットに必要な情報を入力してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return createGitCommit(state.activeWorkspace.path, input);
    } catch (error) {
      return fail(
        "GIT_COMMIT_FAILED",
        "コミットを作成できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(
    switchWorkspaceChannel,
    async (_event, input: SwitchWorkspaceInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isSwitchWorkspaceInput(input)) {
          return fail("WORKSPACE_SWITCH_INVALID_INPUT", "ワークスペースを選択してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const nextSettings = activateWorkspace(settings, input.workspaceId);

        if (!nextSettings.ok) {
          return nextSettings;
        }

        const activeWorkspace = nextSettings.value.workspaces.find(
          (workspace) => workspace.id === input.workspaceId
        );

        if (!activeWorkspace) {
          return fail("WORKSPACE_NOT_FOUND", "登録済みワークスペースが見つかりませんでした。");
        }

        await prepareWorkspace(activeWorkspace.path);
        await writeAppSettings(app.getPath("userData"), nextSettings.value);

        return ok(await buildWorkspaceState(nextSettings.value));
      } catch (error) {
        return fail(
          "WORKSPACE_SWITCH_FAILED",
          "ワークスペースを切り替えられませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );
}

async function buildWorkspaceState(
  settings: Awaited<ReturnType<typeof readAppSettings>>
): Promise<WorkspaceState> {
  const state = toWorkspaceState(settings);

  if (!state.activeWorkspace) {
    return state;
  }

  return toWorkspaceState(settings, await readWorkspaceFileTree(state.activeWorkspace.path));
}

function isCreateMarkdownFileInput(input: unknown): input is CreateMarkdownFileInput {
  return isNameInput(input);
}

function isNameInput(input: unknown): input is { name: string } {
  return (
    typeof input === "object" &&
    input !== null &&
    "name" in input &&
    typeof (input as { name?: unknown }).name === "string"
  );
}

function isPathInput(input: unknown): input is { path: string } {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    typeof (input as { path?: unknown }).path === "string"
  );
}

function isRenameMarkdownFileInput(input: unknown): input is RenameMarkdownFileInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "newName" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { newName?: unknown }).newName === "string"
  );
}

function isRenameFolderInput(input: unknown): input is RenameFolderInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "newName" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { newName?: unknown }).newName === "string"
  );
}

function isSwitchWorkspaceInput(input: unknown): input is SwitchWorkspaceInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "workspaceId" in input &&
    typeof (input as { workspaceId?: unknown }).workspaceId === "string"
  );
}

function isMoveItemToTrashInput(input: unknown): input is MoveItemToTrashInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "type" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    ((input as { type?: unknown }).type === "file" || (input as { type?: unknown }).type === "folder")
  );
}

function isMoveMarkdownFileInput(input: unknown): input is MoveMarkdownFileInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "destinationFolder" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { destinationFolder?: unknown }).destinationFolder === "string"
  );
}

function isMoveFolderInput(input: unknown): input is MoveFolderInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "destinationFolder" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { destinationFolder?: unknown }).destinationFolder === "string"
  );
}

function isReplaceInFileInput(input: unknown): input is ReplaceInFileInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "searchQuery" in input &&
    "replacement" in input &&
    "isRegex" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { searchQuery?: unknown }).searchQuery === "string" &&
    typeof (input as { replacement?: unknown }).replacement === "string" &&
    typeof (input as { isRegex?: unknown }).isRegex === "boolean"
  );
}

function isSearchAndReplaceInput(input: unknown): input is SearchAndReplaceInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "searchQuery" in input &&
    "replacement" in input &&
    "isRegex" in input &&
    typeof (input as { searchQuery?: unknown }).searchQuery === "string" &&
    typeof (input as { replacement?: unknown }).replacement === "string" &&
    typeof (input as { isRegex?: unknown }).isRegex === "boolean"
  );
}

function isSearchWorkspaceInput(input: unknown): input is SearchWorkspaceInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "query" in input &&
    "mode" in input &&
    typeof (input as { query?: unknown }).query === "string" &&
    (!("frontmatterField" in input) || typeof (input as { frontmatterField?: unknown }).frontmatterField === "string") &&
    ((input as { mode?: unknown }).mode === "fullText" ||
      (input as { mode?: unknown }).mode === "fileName" ||
      (input as { mode?: unknown }).mode === "tag" ||
      (input as { mode?: unknown }).mode === "regex" ||
      (input as { mode?: unknown }).mode === "frontmatter")
  );
}

function isCreateGitCommitInput(input: unknown): input is CreateGitCommitInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "authorEmail" in input &&
    "authorName" in input &&
    "message" in input &&
    typeof (input as { authorEmail?: unknown }).authorEmail === "string" &&
    typeof (input as { authorName?: unknown }).authorName === "string" &&
    typeof (input as { message?: unknown }).message === "string"
  );
}
