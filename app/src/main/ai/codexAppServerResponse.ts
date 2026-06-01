import type { CodexAIWorkspaceResponse } from "./codexAppServerTypes";

export function parseCodexResponse(text: string): CodexAIWorkspaceResponse {
  const jsonObject = extractJsonObject(text);
  if (!jsonObject) return buildUnstructuredCodexResponse(text);

  let parsed: Partial<CodexAIWorkspaceResponse>;
  try {
    parsed = JSON.parse(jsonObject) as Partial<CodexAIWorkspaceResponse>;
  } catch {
    return buildUnstructuredCodexResponse(text);
  }

  const operations = Array.isArray(parsed.operations)
    ? parsed.operations.map(normalizeCodexOperation).filter((operation): operation is CodexAIWorkspaceResponse["operations"][number] => Boolean(operation))
    : [];

  return {
    message: typeof parsed.message === "string" ? parsed.message : text,
    operations
  };
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();

  for (const fencedBlock of trimmed.matchAll(/```([a-zA-Z0-9_-]+)?\s*\n?([\s\S]*?)\s*```/g)) {
    const language = fencedBlock[1]?.toLowerCase() ?? "";
    const content = fencedBlock[2].trim();
    const jsonObject = extractFirstBalancedJsonObject(content);
    if (language === "json" && jsonObject) return jsonObject;
  }

  return extractFirstBalancedJsonObject(trimmed);
}

function extractFirstBalancedJsonObject(text: string): string | null {
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0;
  let isEscaped = false;
  let isInString = false;

  for (let index = firstBrace; index < text.length; index += 1) {
    const char = text[index];

    if (isInString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === "\"") {
        isInString = false;
      }
      continue;
    }

    if (char === "\"") {
      isInString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(firstBrace, index + 1);
    }
  }

  return null;
}

function buildUnstructuredCodexResponse(text: string): CodexAIWorkspaceResponse {
  const message = text.trim() || "Codex App Serverから空の応答が返りました。";

  return {
    message: [
      message,
      "",
      "Markdown変更案は構造化形式で取得できなかったため作成しませんでした。"
    ].join("\n"),
    operations: []
  };
}

function normalizeCodexOperation(value: unknown): CodexAIWorkspaceResponse["operations"][number] | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const kind = typeof record.kind === "string" ? record.kind.toLowerCase() : "";
  const path = stringField(record, "path") ?? stringField(record, "filePath");
  const summary = stringField(record, "summary") ?? stringField(record, "description") ?? fallbackOperationSummary(kind, path);
  const content = stringField(record, "content") ??
    stringField(record, "markdown") ??
    stringField(record, "body") ??
    stringField(record, "newContent");

  if (kind !== "create" && kind !== "update" && kind !== "delete") return null;
  if (!path || !summary) return null;
  if (kind !== "delete" && content === undefined) return null;

  return {
    content,
    kind,
    path,
    summary
  };
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function fallbackOperationSummary(kind: string, path?: string): string | undefined {
  if (!path) return undefined;
  if (kind === "create") return `${path} を作成`;
  if (kind === "update") return `${path} を更新`;
  if (kind === "delete") return `${path} を削除`;
  return undefined;
}
