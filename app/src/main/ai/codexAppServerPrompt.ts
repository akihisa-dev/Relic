import { referenceMarkdownSafetyInstructions, type RunCodexAIWorkspaceTurnInput } from "./codexAppServerTypes";
import { formatPendingOperationForPrompt } from "./aiWorkspaceProviderHelpers";

export function buildPrompt(input: RunCodexAIWorkspaceTurnInput): string {
  const history = input.history.slice(-8)
    .map((message) => `${message.role === "user" ? "ユーザー" : "AI"}: ${message.content}`)
    .join("\n\n");
  const references = input.referenceContents
    .map((reference) => `--- ${reference.path} ---\n${reference.content}`)
    .join("\n\n");
  const referenceList = input.references
    .map((reference) => `- ${reference.path}${reference.line ? `:${reference.line}` : ""}`)
    .join("\n");
  const pendingOperations = input.pendingOperations
    .map((operation) => formatPendingOperationForPrompt(operation))
    .join("\n\n");

  return [
    "Relic Coworkとして回答してください。",
    "必要な場合はMarkdownファイル変更案をoperationsへ入れてください。",
    "operationsはMarkdownファイルだけを対象にしてください。",
    "削除はdelete operationで表現してください。",
    "delete operationのcontentは空文字にしてください。",
    "ファイル更新は部分差分ではなく、更新後のMarkdown全文をcontentへ入れてください。",
    "変更不要ならoperationsは空配列にしてください。",
    referenceMarkdownSafetyInstructions,
    "",
    "参照候補:",
    referenceList || "なし",
    "",
    "参照Markdown本文:",
    references || "なし",
    "",
    "直近の会話:",
    history || "なし",
    "",
    "作業中の変更案:",
    pendingOperations || "なし",
    "",
    "今回のユーザー入力:",
    input.message
  ].join("\n");
}

export const codexAIWorkspaceOutputSchema = {
  additionalProperties: false,
  properties: {
    message: { type: "string" },
    operations: {
      items: {
        additionalProperties: false,
        properties: {
          content: { type: "string" },
          kind: { enum: ["create", "update", "delete"], type: "string" },
          path: { type: "string" },
          summary: { type: "string" }
        },
        required: ["content", "kind", "path", "summary"],
        type: "object"
      },
      type: "array"
    }
  },
  required: ["message", "operations"],
  type: "object"
};
