import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

import type {
  AIWorkspaceFileOperation,
  AIWorkspaceMessage,
  AIWorkspaceReference,
  AIWorkspaceState,
  ApplyAIWorkspaceOperationsInput,
  ClearAIWorkspaceDataInput,
  DiscardAIWorkspaceOperationsInput,
  PreviewAIWorkspaceMessageInput,
  AIWorkspaceMessagePreview,
  SendAIWorkspaceMessageInput
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { createMarkdownFileAtPath, readMarkdownFile, writeMarkdownFileContent } from "../files/markdownFiles";
import { resolveWorkspaceRelativePath } from "../files/paths";
import { moveWorkspaceItemToTrash, type TrashItem } from "../files/trash";
import { buildAIWorkspaceIndex, searchAIWorkspaceChunks } from "./aiWorkspaceIndex";
import {
  clearAIWorkspaceData,
  emptyAIWorkspaceData,
  readAIWorkspaceData,
  writeAIWorkspaceData,
  type AIWorkspaceData
} from "./aiWorkspaceData";
import { runCodexAIWorkspaceTurn } from "./codexAppServerClient";

interface AIWorkspaceContext {
  userDataPath: string;
  workspaceId: string;
  workspacePath: string;
}

interface RejectedAIWorkspaceOperation {
  path: string;
  reason: string;
}

interface PreparedAIWorkspaceOperations {
  operations: AIWorkspaceFileOperation[];
  rejectedOperations: RejectedAIWorkspaceOperation[];
}

export async function getAIWorkspaceState(context: AIWorkspaceContext): Promise<RelicResult<AIWorkspaceState>> {
  const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);

  return ok(toState(data));
}

export async function rebuildAIWorkspaceIndex(context: AIWorkspaceContext): Promise<RelicResult<AIWorkspaceState>> {
  try {
    const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
    const nextData: AIWorkspaceData = {
      ...data,
      index: await buildAIWorkspaceIndex(context.workspacePath)
    };
    await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

    return ok(toState(nextData));
  } catch (error) {
    return fail("AI_WORKSPACE_INDEX_FAILED", "AI Workspaceのインデックスを作成できませんでした。", String(error));
  }
}

export async function previewAIWorkspaceMessage(
  context: AIWorkspaceContext,
  input: PreviewAIWorkspaceMessageInput
): Promise<RelicResult<AIWorkspaceMessagePreview>> {
  const message = input.message.trim();

  if (!message) {
    return fail("AI_WORKSPACE_MESSAGE_EMPTY", "AIに送る内容を入力してください。");
  }

  try {
    const data = await ensureIndexed(context);
    const hasPendingOperations = data.operations.some((operation) => operation.status === "pending");
    const requiresExternalAI = !(
      hasPendingOperations &&
      (shouldDiscardPendingOperations(message) || shouldApplyPendingOperations(message))
    );

    return ok({
      message,
      references: requiresExternalAI ? buildReferences(data, message, input.activeFilePath) : [],
      requiresExternalAI,
      skippedLargeFiles: data.index.skippedLargeFiles,
      unreadableFiles: data.index.unreadableFiles
    });
  } catch (error) {
    return fail("AI_WORKSPACE_PREVIEW_FAILED", "AIへ送るMarkdown参照を確認できませんでした。", String(error));
  }
}

export async function sendAIWorkspaceMessage(
  context: AIWorkspaceContext,
  input: SendAIWorkspaceMessageInput,
  trashItem?: TrashItem
): Promise<RelicResult<AIWorkspaceState>> {
  const message = input.message.trim();

  if (!message) {
    return fail("AI_WORKSPACE_MESSAGE_EMPTY", "AIに送る内容を入力してください。");
  }

  try {
    const data = await ensureIndexed(context);
    if (shouldDiscardPendingOperations(message) && data.operations.some((operation) => operation.status === "pending")) {
      return discardAIWorkspaceOperations(context, {
        operationIds: selectPendingOperationIdsFromMessage(data.operations, message, input.activeFilePath)
      });
    }

    if (shouldApplyPendingOperations(message) && data.operations.some((operation) => operation.status === "pending")) {
      return applyAIWorkspaceOperations(context, {
        dirtyFilePaths: input.dirtyFilePaths,
        operationIds: selectPendingOperationIdsFromMessage(data.operations, message, input.activeFilePath)
      }, trashItem);
    }

    if (shouldRevertAppliedOperations(message) && data.operations.some((operation) => operation.status === "applied")) {
      return createRevertOperations(context, data, message, input.activeFilePath);
    }

    const references = buildReferences(data, message, input.activeFilePath);
    const userMessage: AIWorkspaceMessage = {
      content: message,
      createdAt: new Date().toISOString(),
      id: createMessageId("user"),
      references: [],
      role: "user"
    };
    let codexError: string | null = null;
    const codexResponse = await runCodexAIWorkspaceTurn({
      history: data.history.map((item) => ({ content: item.content, role: item.role })),
      message,
      pendingOperations: data.operations.filter((operation) => operation.status === "pending"),
      referenceContents: await readReferenceContents(context.workspacePath, references),
      references,
      workspacePath: context.workspacePath
    }).catch((error) => {
      codexError = error instanceof Error ? error.message : String(error);
      return null;
    });
    const preparedOperations = codexResponse
      ? await prepareOperations(context.workspacePath, codexResponse.operations)
      : { operations: [], rejectedOperations: [] };
    const assistantMessage: AIWorkspaceMessage = {
      content: codexResponse
        ? appendRejectedOperationsNotice(codexResponse.message, preparedOperations.rejectedOperations)
        : buildAssistantFallback(message, references, codexError),
      createdAt: new Date().toISOString(),
      id: createMessageId("assistant"),
      operations: preparedOperations.operations,
      references,
      role: "assistant"
    };
    const nextData = {
      ...data,
      history: [...data.history, userMessage, assistantMessage],
      operations: mergeNewOperations(data.operations, preparedOperations.operations)
    };
    await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

    return ok(toState(nextData));
  } catch (error) {
    return fail("AI_WORKSPACE_MESSAGE_FAILED", "AI Workspaceで処理できませんでした。", String(error));
  }
}

function mergeNewOperations(
  currentOperations: AIWorkspaceFileOperation[],
  newOperations: AIWorkspaceFileOperation[]
): AIWorkspaceFileOperation[] {
  if (newOperations.length === 0) return currentOperations;

  const replacedPaths = new Set(newOperations.map((operation) => operation.path));
  return [
    ...currentOperations.map((operation) => {
      if (operation.status === "pending" && replacedPaths.has(operation.path)) {
        return { ...operation, status: "replaced" as const };
      }

      return operation;
    }),
    ...newOperations
  ];
}

export async function applyAIWorkspaceOperations(
  context: AIWorkspaceContext,
  input: ApplyAIWorkspaceOperationsInput,
  trashItem?: TrashItem
): Promise<RelicResult<AIWorkspaceState>> {
  const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
  const targetIds = new Set(input.operationIds ?? []);
  const targetOperations = data.operations.filter((operation) => {
    if (operation.status !== "pending") return false;
    return targetIds.size === 0 || targetIds.has(operation.id);
  });

  if (targetOperations.length === 0) {
    return fail("AI_WORKSPACE_NO_PENDING_OPERATIONS", "反映できるAI変更案がありません。");
  }

  const dirtyPaths = blockedDirtyPaths(targetOperations, input.dirtyFilePaths ?? []);
  if (dirtyPaths.length > 0) {
    return fail(
      "AI_WORKSPACE_DIRTY_FILE_BLOCKED",
      `未保存のMarkdownがあるためAI変更案を反映できません。先に保存または破棄してください: ${dirtyPaths.join(", ")}`
    );
  }

  const appliedIds = new Set<string>();
  const failedIds = new Set<string>();
  const staleIds = new Set<string>();

  for (const operation of targetOperations) {
    const result = await applyOperation(context.workspacePath, operation, trashItem);
    if (result.ok) {
      appliedIds.add(operation.id);
    } else if (result.error.code === "AI_WORKSPACE_STALE_OPERATION") {
      staleIds.add(operation.id);
    } else {
      failedIds.add(operation.id);
    }
  }

  const nextData: AIWorkspaceData = {
    ...data,
    index: await buildAIWorkspaceIndex(context.workspacePath),
    operations: data.operations.map((operation) => {
      if (appliedIds.has(operation.id)) return { ...operation, status: "applied" };
      if (staleIds.has(operation.id)) return { ...operation, status: "stale" };
      if (failedIds.has(operation.id)) return { ...operation, status: "failed" };
      return operation;
    })
  };
  const assistantMessage: AIWorkspaceMessage = {
    content: buildApplyOperationsMessage(targetOperations, staleIds, failedIds),
    createdAt: new Date().toISOString(),
    id: createMessageId("assistant"),
    references: targetOperations.map((operation) => ({
      path: operation.path,
      preview: operation.summary
    })),
    role: "assistant"
  };
  nextData.history = [...nextData.history, assistantMessage];
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return ok(toState(nextData));
}

export async function discardAIWorkspaceOperations(
  context: AIWorkspaceContext,
  input: DiscardAIWorkspaceOperationsInput
): Promise<RelicResult<AIWorkspaceState>> {
  const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
  const targetIds = new Set(input.operationIds ?? []);
  const targetOperations = data.operations.filter((operation) => {
    if (operation.status !== "pending") return false;
    return targetIds.size === 0 || targetIds.has(operation.id);
  });

  if (targetOperations.length === 0) {
    return fail("AI_WORKSPACE_NO_PENDING_OPERATIONS", "取りやめできるAI変更案がありません。");
  }

  const discardedIds = new Set(targetOperations.map((operation) => operation.id));
  const nextData: AIWorkspaceData = {
    ...data,
    operations: data.operations.map((operation) => {
      if (discardedIds.has(operation.id)) return { ...operation, status: "discarded" };
      return operation;
    })
  };
  const assistantMessage: AIWorkspaceMessage = {
    content: buildDiscardOperationsMessage(targetOperations),
    createdAt: new Date().toISOString(),
    id: createMessageId("assistant"),
    references: targetOperations.map((operation) => ({
      path: operation.path,
      preview: operation.summary
    })),
    role: "assistant"
  };
  nextData.history = [...nextData.history, assistantMessage];
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return ok(toState(nextData));
}

async function createRevertOperations(
  context: AIWorkspaceContext,
  data: AIWorkspaceData,
  message: string,
  activeFilePath?: string | null
): Promise<RelicResult<AIWorkspaceState>> {
  const targetOperations = selectAppliedOperationsForRevert(data.operations, message, activeFilePath);
  if (targetOperations.length === 0) {
    return fail("AI_WORKSPACE_NO_REVERTABLE_OPERATIONS", "元に戻せるAI変更履歴がありません。");
  }

  const revertOperations: AIWorkspaceFileOperation[] = [];
  for (const operation of targetOperations) {
    const revertOperation = await buildRevertOperation(context.workspacePath, operation);
    if (revertOperation) revertOperations.push(revertOperation);
  }

  if (revertOperations.length === 0) {
    return fail("AI_WORKSPACE_NO_REVERTABLE_OPERATIONS", "元に戻せるAI変更履歴がありません。");
  }

  const userMessage: AIWorkspaceMessage = {
    content: message,
    createdAt: new Date().toISOString(),
    id: createMessageId("user"),
    references: [],
    role: "user"
  };
  const assistantMessage: AIWorkspaceMessage = {
    content: buildRevertOperationsMessage(revertOperations),
    createdAt: new Date().toISOString(),
    id: createMessageId("assistant"),
    operations: revertOperations,
    references: revertOperations.map((operation) => ({
      path: operation.path,
      preview: operation.summary
    })),
    role: "assistant"
  };
  const nextData: AIWorkspaceData = {
    ...data,
    history: [...data.history, userMessage, assistantMessage],
    operations: mergeNewOperations(data.operations, revertOperations)
  };
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return ok(toState(nextData));
}

export async function clearAIWorkspaceState(
  context: AIWorkspaceContext,
  input: ClearAIWorkspaceDataInput
): Promise<RelicResult<AIWorkspaceState>> {
  const includeHistory = input.includeHistory ?? true;
  const includeIndex = input.includeIndex ?? true;

  if (includeHistory && includeIndex) {
    await clearAIWorkspaceData(context.userDataPath, context.workspaceId);
    return ok(toState(emptyAIWorkspaceData()));
  }

  const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);
  const nextData: AIWorkspaceData = {
    history: includeHistory ? [] : data.history,
    index: includeIndex ? emptyAIWorkspaceData().index : data.index,
    operations: includeHistory ? [] : data.operations
  };
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return ok(toState(nextData));
}

async function ensureIndexed(context: AIWorkspaceContext): Promise<AIWorkspaceData> {
  const data = await readAIWorkspaceData(context.userDataPath, context.workspaceId);

  if (data.index.indexedAt && data.index.chunks.length > 0) return data;

  const nextData = {
    ...data,
    index: await buildAIWorkspaceIndex(context.workspacePath)
  };
  await writeAIWorkspaceData(context.userDataPath, context.workspaceId, nextData);

  return nextData;
}

function toState(data: AIWorkspaceData): AIWorkspaceState {
  return {
    codexAppServerAvailable: existsSync("/Applications/Codex.app/Contents/Resources/codex"),
    history: data.history,
    index: {
      chunkCount: data.index.chunks.length,
      indexedAt: data.index.indexedAt,
      indexedFileCount: new Set(data.index.chunks.map((chunk) => chunk.path)).size,
      skippedLargeFiles: data.index.skippedLargeFiles,
      unreadableFiles: data.index.unreadableFiles
    },
    operationHistory: data.operations,
    pendingOperations: data.operations.filter((operation) => operation.status === "pending")
  };
}

function buildReferences(
  data: AIWorkspaceData,
  message: string,
  activeFilePath?: string | null
): AIWorkspaceReference[] {
  const references = searchAIWorkspaceChunks(data.index.chunks, message).map<AIWorkspaceReference>((chunk) => ({
    line: chunk.startLine,
    path: chunk.path,
    preview: chunk.content.split("\n").find((line) => line.trim())?.trim().slice(0, 160) ?? chunk.path
  }));

  if (!activeFilePath || !hasCurrentFileReference(message)) return references;

  const normalizedActiveFilePath = normalizeOperationText(activeFilePath);
  const activeChunk = data.index.chunks.find((chunk) => {
    return normalizeOperationText(chunk.path) === normalizedActiveFilePath;
  });
  if (!activeChunk) return references;

  return [{
    line: activeChunk.startLine,
    path: activeChunk.path,
    preview: activeChunk.content.split("\n").find((line) => line.trim())?.trim().slice(0, 160) ?? activeChunk.path
  }, ...references.filter((reference) => {
    return normalizeOperationText(reference.path) !== normalizedActiveFilePath;
  })];
}

async function readReferenceContents(
  workspacePath: string,
  references: AIWorkspaceReference[]
): Promise<Array<{ content: string; path: string }>> {
  const uniquePaths = [...new Set(references.map((reference) => reference.path))].slice(0, 8);
  const contents: Array<{ content: string; path: string }> = [];

  for (const path of uniquePaths) {
    const file = await readMarkdownFile(workspacePath, path);
    if (file.ok) {
      contents.push({ content: file.value.content.slice(0, 16_000), path });
    }
  }

  return contents;
}

async function applyOperation(
  workspacePath: string,
  operation: AIWorkspaceFileOperation,
  trashItem?: TrashItem
): Promise<RelicResult<void>> {
  if (operation.kind === "create") {
    const created = await createMarkdownFileAtPath(workspacePath, operation.path);
    if (!created.ok) return created;
    return writeMarkdownFileContent(workspacePath, operation.path, operation.content ?? "");
  }

  const currentFile = await readMarkdownFile(workspacePath, operation.path);
  if (!currentFile.ok) return currentFile;

  if (operation.baseContentHash && hashContent(currentFile.value.content) !== operation.baseContentHash) {
    return fail(
      "AI_WORKSPACE_STALE_OPERATION",
      "AI変更案の作成後に対象Markdownが変更されています。"
    );
  }

  if (operation.kind === "update") {
    return writeMarkdownFileContent(workspacePath, operation.path, operation.content ?? "");
  }

  if (!trashItem) {
    return fail("AI_WORKSPACE_TRASH_UNAVAILABLE", "AI変更案の削除を実行できませんでした。");
  }

  const moved = await moveWorkspaceItemToTrash(workspacePath, operation.path, "file", trashItem);
  if (!moved.ok) return moved;
  return ok(undefined);
}

async function prepareOperations(
  workspacePath: string,
  operations: AIWorkspaceFileOperation[]
): Promise<PreparedAIWorkspaceOperations> {
  const nextOperations: AIWorkspaceFileOperation[] = [];
  const rejectedOperations: RejectedAIWorkspaceOperation[] = [];

  for (const operation of operations) {
    const pathResult = validateOperationPath(workspacePath, operation.path);
    if (!pathResult.ok) {
      rejectedOperations.push({ path: operation.path, reason: pathResult.error.message });
      continue;
    }

    if (operation.kind === "create") {
      const existingFile = await readMarkdownFile(workspacePath, pathResult.value);
      if (existingFile.ok) {
        rejectedOperations.push({
          path: pathResult.value,
          reason: "同じパスのMarkdownがすでにあるため、新規作成案としては採用しませんでした。"
        });
        continue;
      }

      nextOperations.push({ ...operation, path: pathResult.value });
      continue;
    }

    const file = await readMarkdownFile(workspacePath, pathResult.value);
    if (!file.ok) {
      rejectedOperations.push({ path: pathResult.value, reason: file.error.message });
      continue;
    }

    nextOperations.push({
      ...operation,
      baseContent: file.value.content,
      baseContentHash: hashContent(file.value.content),
      path: pathResult.value
    });
  }

  return { operations: nextOperations, rejectedOperations };
}

function validateOperationPath(workspacePath: string, operationPath: string): RelicResult<string> {
  const normalizedPath = operationPath.replace(/\\/g, "/").trim();
  if (!normalizedPath || path.extname(normalizedPath) !== ".md") {
    return fail("AI_WORKSPACE_OPERATION_PATH_INVALID", "AI変更案はMarkdownファイルだけを対象にできます。");
  }

  if (path.isAbsolute(normalizedPath) || normalizedPath.split("/").includes("..")) {
    return fail("AI_WORKSPACE_OPERATION_PATH_INVALID", "AI変更案のパスがワークスペース外を指しています。");
  }

  const resolved = resolveWorkspaceRelativePath(workspacePath, normalizedPath);
  if (!resolved.ok) return resolved;

  return ok(normalizedPath);
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function shouldApplyPendingOperations(message: string): boolean {
  return /(反映|適用|実行|保存|やって|進めて)/.test(message) &&
    !/(しない|やめ|不要|キャンセル|まだ)/.test(message);
}

function shouldDiscardPendingOperations(message: string): boolean {
  return /(やめ|取りやめ|不要|キャンセル|破棄|なしにして|しない)/.test(message);
}

function shouldRevertAppliedOperations(message: string): boolean {
  return /(戻し|戻して|元に戻|取り消し|巻き戻)/.test(message);
}

function selectPendingOperationIdsFromMessage(
  operations: AIWorkspaceFileOperation[],
  message: string,
  activeFilePath?: string | null
): string[] | undefined {
  const pendingOperations = operations.filter((operation) => operation.status === "pending");
  const normalizedMessage = normalizeOperationText(message);
  const normalizedActiveFilePath = activeFilePath ? normalizeOperationText(activeFilePath) : "";

  if (hasCurrentFileReference(message)) {
    if (!normalizedActiveFilePath) return ["__ai_workspace_no_matching_active_file__"];

    const activeOperationIds = pendingOperations
      .filter((operation) => normalizeOperationText(operation.path) === normalizedActiveFilePath)
      .map((operation) => operation.id);

    return activeOperationIds.length > 0 ? activeOperationIds : ["__ai_workspace_no_matching_active_file__"];
  }

  const matchedIds = pendingOperations
    .filter((operation) => operationPathCandidates(operation.path).some((candidate) => {
      const normalizedCandidate = normalizeOperationText(candidate);
      return normalizedCandidate.length >= 2 && normalizedMessage.includes(normalizedCandidate);
    }))
    .map((operation) => operation.id);

  return matchedIds.length > 0 ? matchedIds : undefined;
}

function selectAppliedOperationsForRevert(
  operations: AIWorkspaceFileOperation[],
  message: string,
  activeFilePath?: string | null
): AIWorkspaceFileOperation[] {
  const appliedOperations = [...operations].reverse().filter((operation) => operation.status === "applied");
  const normalizedActiveFilePath = activeFilePath ? normalizeOperationText(activeFilePath) : "";

  if (hasCurrentFileReference(message) && normalizedActiveFilePath) {
    return appliedOperations.filter((operation) => normalizeOperationText(operation.path) === normalizedActiveFilePath).slice(0, 1);
  }

  const matchedOperations = appliedOperations.filter((operation) => operationPathCandidates(operation.path).some((candidate) => {
    const normalizedCandidate = normalizeOperationText(candidate);
    return normalizedCandidate.length >= 2 && normalizeOperationText(message).includes(normalizedCandidate);
  }));
  if (matchedOperations.length > 0) return matchedOperations.slice(0, 1);

  return appliedOperations.slice(0, 1);
}

async function buildRevertOperation(
  workspacePath: string,
  operation: AIWorkspaceFileOperation
): Promise<AIWorkspaceFileOperation | null> {
  if (operation.kind === "update" && operation.baseContent !== undefined) {
    const file = await readMarkdownFile(workspacePath, operation.path);
    if (!file.ok) return null;

    return {
      baseContent: file.value.content,
      baseContentHash: hashContent(file.value.content),
      content: operation.baseContent,
      createdAt: new Date().toISOString(),
      id: createMessageId("revert-update"),
      kind: "update",
      path: operation.path,
      status: "pending",
      summary: "AI変更を元のMarkdown本文へ戻す"
    };
  }

  if (operation.kind === "create") {
    return {
      createdAt: new Date().toISOString(),
      id: createMessageId("revert-create"),
      kind: "delete",
      path: operation.path,
      status: "pending",
      summary: "AIが作成したMarkdownを削除して元に戻す"
    };
  }

  return null;
}

function hasCurrentFileReference(message: string): boolean {
  return /(このファイル|現在のファイル|開いているファイル|今のファイル)/.test(message);
}

function operationPathCandidates(operationPath: string): string[] {
  const normalizedPath = operationPath.replace(/\\/g, "/");
  const fileName = path.posix.basename(normalizedPath);
  const extension = path.posix.extname(fileName);
  const stem = extension ? fileName.slice(0, -extension.length) : fileName;

  return [normalizedPath, fileName, stem];
}

function normalizeOperationText(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/[「」『』（）()[\]{}"'`、。，．\s]/g, "")
    .toLowerCase();
}

function buildApplyOperationsMessage(
  operations: AIWorkspaceFileOperation[],
  staleIds: Set<string>,
  failedIds: Set<string>
): string {
  const header = staleIds.size > 0
    ? "一部のAI変更案は、作成後に対象Markdownが変更されていたため反映しませんでした。現在の内容をもとに、もう一度依頼してください。"
    : failedIds.size > 0
      ? "一部のAI変更案を反映できませんでした。対象ファイルの状態を確認してから、もう一度依頼してください。"
      : "AI変更案をMarkdownへ反映しました。";

  return [header, "", ...operationResultLines(operations, staleIds, failedIds)].join("\n").trim();
}

function buildDiscardOperationsMessage(operations: AIWorkspaceFileOperation[]): string {
  return [
    "AI変更案を取りやめました。Markdownファイルには反映していません。",
    "",
    ...operations.map((operation) => `- ${operation.path}`)
  ].join("\n").trim();
}

function buildRevertOperationsMessage(operations: AIWorkspaceFileOperation[]): string {
  return [
    "反映済みのAI変更を元に戻す変更案を作成しました。まだMarkdownファイルには反映していません。",
    "",
    ...operations.map((operation) => `- ${operation.path}`)
  ].join("\n").trim();
}

function operationResultLines(
  operations: AIWorkspaceFileOperation[],
  staleIds: Set<string>,
  failedIds: Set<string>
): string[] {
  return operations.map((operation) => {
    if (staleIds.has(operation.id)) return `- 再作業が必要: ${operation.path}`;
    if (failedIds.has(operation.id)) return `- 失敗: ${operation.path}`;
    return `- 反映済み: ${operation.path}`;
  });
}

function blockedDirtyPaths(
  operations: AIWorkspaceFileOperation[],
  dirtyFilePaths: string[]
): string[] {
  const dirtyPathSet = new Set(dirtyFilePaths);
  return [...new Set(
    operations
      .filter((operation) => operation.kind !== "create" && dirtyPathSet.has(operation.path))
      .map((operation) => operation.path)
  )];
}

function buildAssistantFallback(
  message: string,
  references: AIWorkspaceReference[],
  codexError: string | null
): string {
  if (codexError) {
    const files = references.map((reference) => `- ${reference.path}`).join("\n");

    return [
      "Codex App ServerでAI処理を完了できませんでした。",
      "そのため、今回はローカルのMarkdown検索結果だけを表示しています。Markdownの作成・編集・削除案は作っていません。",
      "",
      files ? `関連しそうなMarkdown:\n${files}` : "関連しそうなMarkdownは見つかりませんでした。",
      "",
      `受け取った依頼: ${message}`,
      "",
      `失敗理由: ${codexError}`
    ].join("\n");
  }

  if (references.length === 0) {
    return [
      "ワークスペース内のMarkdownを確認しましたが、この内容に直接一致する参照はまだ見つかりませんでした。",
      "Markdown変更案は作っていません。"
    ].join("\n");
  }

  const files = references.map((reference) => `- ${reference.path}`).join("\n");

  return [
    "関連しそうなMarkdownを確認しました。",
    "",
    files,
    "",
    `受け取った依頼: ${message}`,
    "",
    "Markdown変更案は作っていません。"
  ].join("\n");
}

function appendRejectedOperationsNotice(
  content: string,
  rejectedOperations: RejectedAIWorkspaceOperation[]
): string {
  if (rejectedOperations.length === 0) return content;

  return [
    content,
    "",
    "Relic側で安全のため採用しなかった変更案:",
    ...rejectedOperations.map((operation) => `- ${operation.path}: ${operation.reason}`)
  ].join("\n");
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
