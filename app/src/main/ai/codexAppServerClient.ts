import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";

import type { AIWorkspaceFileOperation, AIWorkspaceReference } from "../../shared/ipc";

const codexBinaryPath = "/Applications/Codex.app/Contents/Resources/codex";
const requestTimeoutMs = 120_000;

interface CodexAIWorkspaceResponse {
  message: string;
  operations: Array<{
    content?: string;
    kind: "create" | "update" | "delete";
    path: string;
    summary: string;
  }>;
}

interface RunCodexAIWorkspaceTurnInput {
  history: Array<{ content: string; role: "user" | "assistant" }>;
  message: string;
  pendingOperations: AIWorkspaceFileOperation[];
  references: AIWorkspaceReference[];
  referenceContents: Array<{ content: string; path: string }>;
  workspacePath: string;
}

interface RunCodexAIWorkspaceTurnResult {
  message: string;
  operations: AIWorkspaceFileOperation[];
}

export async function runCodexAIWorkspaceTurn(
  input: RunCodexAIWorkspaceTurnInput
): Promise<RunCodexAIWorkspaceTurnResult> {
  const client = new CodexAppServerClient();

  try {
    await client.start();
    await client.initialize();
    const threadId = await client.startThread(input.workspacePath);
    const response = await client.startTurn(threadId, buildPrompt(input));

    return {
      message: response.message,
      operations: response.operations.map((operation) => ({
        ...operation,
        createdAt: new Date().toISOString(),
        id: createOperationId(operation.kind),
        status: "pending"
      }))
    };
  } finally {
    client.stop();
  }
}

class CodexAppServerClient {
  private nextId = 1;
  private process: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, {
    reject: (error: Error) => void;
    resolve: (value: unknown) => void;
    timeout: NodeJS.Timeout;
  }>();
  private turnDeltas: string[] = [];
  private turnResolvers = new Map<string, {
    reject: (error: Error) => void;
    resolve: (value: string) => void;
    timeout: NodeJS.Timeout;
  }>();

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(codexBinaryPath, ["app-server", "--listen", "stdio://"], {
        stdio: ["pipe", "pipe", "pipe"]
      });
      this.process = process;

      const stdout = readline.createInterface({ input: process.stdout });
      stdout.on("line", (line) => this.handleLine(line));

      process.stderr.on("data", () => undefined);
      process.stdin.on("error", (error) => {
        this.failAll(new Error(`Codex App Serverへ送信できませんでした: ${error.message}`));
      });
      process.once("spawn", () => resolve());
      process.once("error", (error) => {
        const wrappedError = new Error(`Codex App Serverを起動できませんでした: ${error.message}`);
        this.failAll(wrappedError);
        reject(wrappedError);
      });
      process.on("exit", () => {
        this.failAll(new Error("Codex App Serverが終了しました。"));
      });
    });
  }

  stop(): void {
    this.process?.kill();
    this.process = null;
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      capabilities: {
        experimentalApi: true,
        requestAttestation: false
      },
      clientInfo: {
        name: "relic",
        title: "Relic",
        version: "0.1.0"
      }
    });
  }

  async startThread(workspacePath: string): Promise<string> {
    const result = await this.request("thread/start", {
      approvalPolicy: "never",
      baseInstructions: [
        "あなたはRelicのAI Workspaceです。",
        "Relicで開いているローカルMarkdownワークスペースだけを対象にします。",
        "Markdown以外のファイル操作は提案しません。",
        "ファイルを直接編集せず、必ず指定されたJSON形式で変更案を返します。",
        "ユーザーへの説明は日本語で簡潔にしてください。"
      ].join("\n"),
      cwd: workspacePath,
      ephemeral: true,
      sandbox: "read-only"
    }) as { thread: { id: string } };

    return result.thread.id;
  }

  async startTurn(threadId: string, prompt: string): Promise<CodexAIWorkspaceResponse> {
    const turn = await this.request("turn/start", {
      input: [{
        text: prompt,
        text_elements: [],
        type: "text"
      }],
      outputSchema: codexAIWorkspaceOutputSchema,
      threadId
    }) as { turn: { id: string } };

    const text = await this.waitForTurn(turn.turn.id);
    return parseCodexResponse(text);
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const process = this.process;
    if (!process) return Promise.reject(new Error("Codex App Serverが起動していません。"));

    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Codex App Serverの応答がタイムアウトしました。"));
      }, requestTimeoutMs);
      this.pending.set(id, { reject, resolve, timeout });
      process.stdin.write(`${payload}\n`, (error) => {
        if (!error) return;
        const pendingRequest = this.pending.get(id);
        if (!pendingRequest) return;
        clearTimeout(pendingRequest.timeout);
        this.pending.delete(id);
        pendingRequest.reject(new Error(`Codex App Serverへ送信できませんでした: ${error.message}`));
      });
    });
  }

  private waitForTurn(turnId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.turnResolvers.delete(turnId);
        reject(new Error("Codex App Serverのturnがタイムアウトしました。"));
      }, requestTimeoutMs);
      this.turnResolvers.set(turnId, { reject, resolve, timeout });
    });
  }

  private failAll(error: Error): void {
    for (const pendingRequest of this.pending.values()) {
      clearTimeout(pendingRequest.timeout);
      pendingRequest.reject(error);
    }
    this.pending.clear();

    for (const turnResolver of this.turnResolvers.values()) {
      clearTimeout(turnResolver.timeout);
      turnResolver.reject(error);
    }
    this.turnResolvers.clear();
  }

  private handleLine(line: string): void {
    if (!line.trim().startsWith("{")) return;

    let message: Record<string, unknown>;
    try {
      message = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }

    if (typeof message.id === "number") {
      const pendingRequest = this.pending.get(message.id);
      if (!pendingRequest) return;
      clearTimeout(pendingRequest.timeout);
      this.pending.delete(message.id);

      if (message.error) {
        pendingRequest.reject(new Error(JSON.stringify(message.error)));
      } else {
        pendingRequest.resolve(message.result);
      }
      return;
    }

    if (message.method === "item/agentMessage/delta") {
      const params = message.params as { delta?: unknown } | undefined;
      if (typeof params?.delta === "string") this.turnDeltas.push(params.delta);
      return;
    }

    if (message.method === "turn/completed") {
      const params = message.params as { turn?: { id?: string } } | undefined;
      const turnId = params?.turn?.id;
      if (!turnId) return;
      const turnResolver = this.turnResolvers.get(turnId);
      if (!turnResolver) return;
      this.turnResolvers.delete(turnId);
      clearTimeout(turnResolver.timeout);
      const text = this.turnDeltas.join("");
      this.turnDeltas = [];
      turnResolver.resolve(text);
    }
  }
}

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
    "Relic AI Workspaceとして回答してください。",
    "必要な場合はMarkdownファイル変更案をoperationsへ入れてください。",
    "operationsはMarkdownファイルだけを対象にしてください。",
    "削除はdelete operationで表現してください。",
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

function createOperationId(kind: string): string {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const codexAIWorkspaceOutputSchema = {
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
        required: ["kind", "path", "summary"],
        type: "object"
      },
      type: "array"
    }
  },
  required: ["message", "operations"],
  type: "object"
};
