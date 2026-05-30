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
  private turnResolvers = new Map<string, (value: string) => void>();

  async start(): Promise<void> {
    this.process = spawn(codexBinaryPath, ["app-server", "--listen", "stdio://"], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    const stdout = readline.createInterface({ input: this.process.stdout });
    stdout.on("line", (line) => this.handleLine(line));

    this.process.stderr.on("data", () => undefined);
    this.process.on("exit", () => {
      for (const pendingRequest of this.pending.values()) {
        clearTimeout(pendingRequest.timeout);
        pendingRequest.reject(new Error("Codex App Serverが終了しました。"));
      }
      this.pending.clear();
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
      process.stdin.write(`${payload}\n`);
    });
  }

  private waitForTurn(turnId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.turnResolvers.delete(turnId);
        reject(new Error("Codex App Serverのturnがタイムアウトしました。"));
      }, requestTimeoutMs);
      this.turnResolvers.set(turnId, (value) => {
        clearTimeout(timeout);
        resolve(value);
      });
    });
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
      const resolve = this.turnResolvers.get(turnId);
      if (!resolve) return;
      this.turnResolvers.delete(turnId);
      const text = this.turnDeltas.join("");
      this.turnDeltas = [];
      resolve(text);
    }
  }
}

function buildPrompt(input: RunCodexAIWorkspaceTurnInput): string {
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
    lines.push("```markdown", operation.content.slice(0, 12_000), "```");
  }

  return lines.join("\n");
}

function parseCodexResponse(text: string): CodexAIWorkspaceResponse {
  const parsed = JSON.parse(extractJsonObject(text)) as Partial<CodexAIWorkspaceResponse>;
  const operations = Array.isArray(parsed.operations)
    ? parsed.operations.filter(isCodexOperation)
    : [];

  return {
    message: typeof parsed.message === "string" ? parsed.message : text,
    operations
  };
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const fencedJson = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fencedJson) return fencedJson[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);

  throw new Error("Codex App Serverの応答をJSONとして読めませんでした。");
}

function isCodexOperation(value: unknown): value is CodexAIWorkspaceResponse["operations"][number] {
  if (!value || typeof value !== "object") return false;
  const record = value as CodexAIWorkspaceResponse["operations"][number];

  return (record.kind === "create" || record.kind === "update" || record.kind === "delete") &&
    typeof record.path === "string" &&
    typeof record.summary === "string" &&
    (record.kind === "delete" || typeof record.content === "string");
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
