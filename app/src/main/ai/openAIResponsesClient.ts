import type { AIWorkspaceFileOperation, AIWorkspaceReference } from "../../shared/ipc";

export const openAIWorkspaceModel = "gpt-5.4-mini";

interface OpenAIWorkspaceResponse {
  message: string;
  operations: Array<{
    content: string;
    kind: "create" | "update" | "delete";
    path: string;
    summary: string;
  }>;
}

interface RunOpenAIWorkspaceTurnInput {
  apiKey: string;
  history: Array<{ content: string; role: "user" | "assistant" }>;
  message: string;
  pendingOperations: AIWorkspaceFileOperation[];
  references: AIWorkspaceReference[];
  referenceContents: Array<{ content: string; path: string }>;
}

interface RunOpenAIWorkspaceTurnResult {
  message: string;
  operations: AIWorkspaceFileOperation[];
}

export async function runOpenAIWorkspaceTurn(
  input: RunOpenAIWorkspaceTurnInput
): Promise<RunOpenAIWorkspaceTurnResult> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: buildPrompt(input),
      model: openAIWorkspaceModel,
      text: {
        format: {
          name: "relic_ai_workspace_response",
          schema: openAIWorkspaceOutputSchema,
          strict: true,
          type: "json_schema"
        }
      }
    }),
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(await openAIErrorMessage(response));
  }

  const body: unknown = await response.json();
  const parsed = parseOpenAIWorkspaceResponse(body);

  return {
    message: parsed.message,
    operations: parsed.operations.map((operation) => ({
      ...operation,
      createdAt: new Date().toISOString(),
      id: createOperationId(operation.kind),
      status: "pending"
    }))
  };
}

export async function testOpenAIAPIKey(apiKey: string): Promise<void> {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(await openAIErrorMessage(response));
  }
}

export function buildPrompt(input: Omit<RunOpenAIWorkspaceTurnInput, "apiKey">): string {
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
    "Relic AI Workspaceとして日本語で簡潔に回答してください。",
    "必要な場合はMarkdownファイル変更案をoperationsへ入れてください。",
    "operationsはMarkdownファイルだけを対象にしてください。",
    "削除はdelete operationで表現し、contentは空文字にしてください。",
    "ファイル更新は部分差分ではなく、更新後のMarkdown全文をcontentへ入れてください。",
    "変更不要ならoperationsは空配列にしてください。",
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

function parseOpenAIWorkspaceResponse(body: unknown): OpenAIWorkspaceResponse {
  const outputText = extractOutputText(body);
  if (!outputText) {
    throw new Error("OpenAI APIからMarkdown変更案を読み取れませんでした。");
  }

  let parsed: Partial<OpenAIWorkspaceResponse>;
  try {
    parsed = JSON.parse(outputText) as Partial<OpenAIWorkspaceResponse>;
  } catch {
    throw new Error("OpenAI APIの応答を構造化データとして読み取れませんでした。");
  }

  return {
    message: typeof parsed.message === "string" ? parsed.message : "OpenAI APIから応答が返りました。",
    operations: Array.isArray(parsed.operations)
      ? parsed.operations.map(normalizeOperation).filter((operation): operation is OpenAIWorkspaceResponse["operations"][number] => Boolean(operation))
      : []
  };
}

function extractOutputText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return null;

  const chunks: string[] = [];
  for (const item of record.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") chunks.push(text);
    }
  }

  return chunks.length > 0 ? chunks.join("") : null;
}

async function openAIErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: { message?: string } };
    if (body.error?.message) return body.error.message;
  } catch {
    // Use the status below when the body is not JSON.
  }

  return `OpenAI API request failed: ${response.status} ${response.statusText}`;
}

function normalizeOperation(value: unknown): OpenAIWorkspaceResponse["operations"][number] | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const kind = typeof record.kind === "string" ? record.kind : "";
  const path = typeof record.path === "string" ? record.path : "";
  const summary = typeof record.summary === "string" ? record.summary : "";
  const content = typeof record.content === "string" ? record.content : "";

  if (kind !== "create" && kind !== "update" && kind !== "delete") return null;
  if (!path || !summary) return null;
  if (kind !== "delete" && !content) return null;

  return { content, kind, path, summary };
}

function formatPendingOperationForPrompt(operation: AIWorkspaceFileOperation): string {
  const lines = [
    `- id: ${operation.id}`,
    `- kind: ${operation.kind}`,
    `- path: ${operation.path}`,
    `- summary: ${operation.summary}`
  ];

  if (operation.kind !== "delete" && operation.content) {
    lines.push("```markdown", operation.content, "```");
  }

  return lines.join("\n");
}

function createOperationId(kind: string): string {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const openAIWorkspaceOutputSchema = {
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
