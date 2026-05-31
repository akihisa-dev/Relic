import type { AIProvider, AIWorkspaceFileOperation, AIWorkspaceReference } from "../../shared/ipc";
import type { AppliedAIWorkspaceOperations, RejectedAIWorkspaceOperation } from "./aiWorkspaceServiceTypes";

export function buildApplyOperationsMessage(
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

export function buildDiscardOperationsMessage(operations: AIWorkspaceFileOperation[]): string {
  return [
    "AI変更案を取りやめました。Markdownファイルには反映していません。",
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

export function buildAssistantFallback(
  provider: AIProvider,
  message: string,
  references: AIWorkspaceReference[],
  aiError: string | null
): string {
  if (aiError) {
    const files = references.map((reference) => `- ${reference.path}`).join("\n");
    const providerMessage = provider === "openai-api"
      ? "OpenAI APIでAI処理を完了できませんでした。"
      : "Codex App ServerでAI処理を完了できませんでした。";
    const nextStep = provider === "openai-api"
      ? "OpenAI APIキー、課金状態、利用上限、ネットワーク接続を確認してください。"
      : "Codexアプリが利用できる状態か確認してください。利用できない場合は、設定のAI接続方式をOpenAI APIへ切り替えることもできます。";

    return [
      providerMessage,
      "そのため、今回はローカルのMarkdown検索結果だけを表示しています。Markdownの作成・編集・削除案は作っていません。",
      nextStep,
      "",
      files ? `関連しそうなMarkdown:\n${files}` : "関連しそうなMarkdownは見つかりませんでした。",
      "",
      `受け取った依頼: ${message}`,
      "",
      `失敗理由: ${aiError}`
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

export function normalizeAIProviderError(provider: AIProvider, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (provider !== "openai-api") return message;

  const lower = message.toLowerCase();
  if (lower.includes("quota") || lower.includes("billing") || lower.includes("insufficient_quota")) {
    return "OpenAI APIの利用枠または請求設定を確認してください。APIの残高不足、利用上限、請求設定が原因の可能性があります。";
  }
  if (lower.includes("rate limit") || lower.includes("rate_limit")) {
    return "OpenAI APIの利用が一時的に集中しています。少し時間を置いてからもう一度お試しください。";
  }
  if (lower.includes("model") || lower.includes("not found") || lower.includes("invalid_request_error")) {
    return "OpenAIモデルを利用できませんでした。設定のOpenAIモデルを既定値へ戻して、もう一度お試しください。";
  }

  return message;
}

export function buildChatOnlyAssistantMessage(
  content: string,
  rejectedOperations: RejectedAIWorkspaceOperation[],
  appliedOperations: AppliedAIWorkspaceOperations
): string {
  const lines = [content.trim()];

  if (appliedOperations.applied.length > 0) {
    lines.push(
      "",
      "Markdownへ反映しました。",
      ...appliedOperations.applied.map((operation) => `- ${operation.path}`)
    );
  }

  if (appliedOperations.blockedDirtyPaths.length > 0) {
    lines.push(
      "",
      "未保存のMarkdownがあるため、次の変更は反映しませんでした。先に保存または破棄してください。",
      ...[...new Set(appliedOperations.blockedDirtyPaths)].map((path) => `- ${path}`)
    );
  }

  if (appliedOperations.stale.length > 0) {
    lines.push(
      "",
      "AIが考えている間に対象Markdownが変わったため、次の変更は反映しませんでした。",
      ...appliedOperations.stale.map((operation) => `- ${operation.path}`)
    );
  }

  if (appliedOperations.failed.length > 0) {
    lines.push(
      "",
      "次のMarkdown変更は反映できませんでした。",
      ...appliedOperations.failed.map((operation) => `- ${operation.path}`)
    );
  }

  if (rejectedOperations.length > 0) {
    lines.push(
      "",
      "安全のため採用しなかった変更があります。",
      ...rejectedOperations.map((operation) => `- ${operation.path}: ${operation.reason}`)
    );
  }

  return lines.join("\n").trim();
}
