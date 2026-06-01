import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";

import { referenceMarkdownSafetyInstructions, type CodexRateLimitsResponse } from "./codexAppServerTypes";
import { codexAIWorkspaceOutputSchema } from "./codexAppServerPrompt";

const codexBinaryPath = "/Applications/Codex.app/Contents/Resources/codex";
export const codexRequestTimeoutMs = 120_000;
export const codexUsageRequestTimeoutMs = 10_000;

export class CodexAppServerTransport {
  private nextId = 1;
  private process: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, {
    reject: (error: Error) => void;
    resolve: (value: unknown) => void;
    timeout: NodeJS.Timeout;
  }>();
  private turnTexts = new Map<string, string[]>();
  private turnResolvers = new Map<string, {
    reject: (error: Error) => void;
    resolve: (value: string) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(private readonly timeoutMs = codexRequestTimeoutMs) {}

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

  abort(error: Error): void {
    this.failAll(error);
    this.stop();
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
        "あなたはRelicのCoworkです。",
        "Relicで開いているローカルMarkdownワークスペースだけを対象にします。",
        "Markdown以外のファイル操作は提案しません。",
        "ファイルを直接編集せず、必ず指定されたJSON形式で変更案を返します。",
        referenceMarkdownSafetyInstructions,
        "ユーザーへの説明は日本語で簡潔にしてください。"
      ].join("\n"),
      cwd: workspacePath,
      ephemeral: true,
      sandbox: "read-only"
    }) as { thread: { id: string } };

    return result.thread.id;
  }

  async startTurn(threadId: string, prompt: string): Promise<string> {
    const turn = await this.request("turn/start", {
      input: [{
        text: prompt,
        text_elements: [],
        type: "text"
      }],
      outputSchema: codexAIWorkspaceOutputSchema,
      threadId
    }) as { turn: { id: string } };

    return await this.waitForTurn(turn.turn.id);
  }

  async readRateLimits(): Promise<CodexRateLimitsResponse> {
    return await this.request("account/rateLimits/read", undefined) as CodexRateLimitsResponse;
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
      }, this.timeoutMs);
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
        this.turnTexts.delete(turnId);
        reject(new Error("Codex App Serverのturnがタイムアウトしました。"));
      }, this.timeoutMs);
      this.turnTexts.set(turnId, []);
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
    this.turnTexts.clear();
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
      this.handleResponseMessage(message);
      return;
    }

    if (message.method === "item/agentMessage/delta") {
      this.handleAgentMessageDelta(message);
      return;
    }

    if (message.method === "item/completed") {
      this.handleAgentMessageCompleted(message);
      return;
    }

    if (message.method === "turn/completed") {
      this.handleTurnCompleted(message);
    }
  }

  private handleResponseMessage(message: Record<string, unknown>): void {
    const pendingRequest = this.pending.get(message.id as number);
    if (!pendingRequest) return;
    clearTimeout(pendingRequest.timeout);
    this.pending.delete(message.id as number);

    if (message.error) {
      pendingRequest.reject(new Error(JSON.stringify(message.error)));
    } else {
      pendingRequest.resolve(message.result);
    }
  }

  private handleAgentMessageDelta(message: Record<string, unknown>): void {
    const params = message.params as { delta?: unknown; turnId?: unknown } | undefined;
    if (typeof params?.turnId !== "string" || typeof params.delta !== "string") return;

    const deltas = this.turnTexts.get(params.turnId) ?? [];
    deltas.push(params.delta);
    this.turnTexts.set(params.turnId, deltas);
  }

  private handleAgentMessageCompleted(message: Record<string, unknown>): void {
    const params = message.params as { item?: { text?: unknown; type?: unknown }; turnId?: unknown } | undefined;
    if (typeof params?.turnId !== "string" || params.item?.type !== "agentMessage" || typeof params.item.text !== "string") {
      return;
    }

    const currentText = (this.turnTexts.get(params.turnId) ?? []).join("");
    if (params.item.text.length > currentText.length) {
      this.turnTexts.set(params.turnId, [params.item.text]);
    }
  }

  private handleTurnCompleted(message: Record<string, unknown>): void {
    const params = message.params as { turn?: { error?: { message?: string } | null; id?: string; status?: string } } | undefined;
    const turnId = params?.turn?.id;
    if (!turnId) return;
    const turnResolver = this.turnResolvers.get(turnId);
    if (!turnResolver) return;
    this.turnResolvers.delete(turnId);
    clearTimeout(turnResolver.timeout);
    const text = (this.turnTexts.get(turnId) ?? []).join("");
    this.turnTexts.delete(turnId);
    if (params.turn?.status === "failed") {
      turnResolver.reject(new Error(params.turn.error?.message ?? "Codex App Serverのturnが失敗しました。"));
      return;
    }
    turnResolver.resolve(text);
  }
}
