import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

const childProcessMock = vi.hoisted(() => ({
  spawn: vi.fn()
}));

vi.mock("node:child_process", () => ({
  default: childProcessMock,
  spawn: childProcessMock.spawn
}));

import { buildPrompt, codexAIWorkspaceOutputSchema, parseCodexResponse, runCodexAIWorkspaceTurn } from "./codexAppServerClient";

function createFakeCodexProcess(options: {
  onWrite?: (chunk: string, process: EventEmitter & {
    stderr: PassThrough;
    stdout: PassThrough;
  }) => void;
  stdinWriteError?: Error;
} = {}): EventEmitter & {
  kill: () => void;
  stderr: PassThrough;
  stdin: Writable;
  stdout: PassThrough;
} {
  const process = new EventEmitter() as EventEmitter & {
    kill: () => void;
    stderr: PassThrough;
    stdin: Writable;
    stdout: PassThrough;
  };
  process.stdout = new PassThrough();
  process.stderr = new PassThrough();
  process.stdin = new Writable({
    write(chunk, _encoding, callback) {
      options.onWrite?.(chunk.toString(), process);
      callback(options.stdinWriteError);
    }
  });
  process.kill = vi.fn();

  return process;
}

describe("runCodexAIWorkspaceTurn", () => {
  it("rejects cleanly when Codex App Server cannot be started", async () => {
    const fakeProcess = createFakeCodexProcess();
    childProcessMock.spawn.mockReturnValueOnce(fakeProcess);

    queueMicrotask(() => {
      fakeProcess.emit("error", new Error("ENOENT"));
    });

    await expect(runCodexAIWorkspaceTurn({
      history: [],
      message: "要件を整理して",
      pendingOperations: [],
      referenceContents: [],
      references: [],
      workspacePath: "/tmp/workspace"
    })).rejects.toThrow("Codex App Serverを起動できませんでした: ENOENT");
  });

  it("rejects cleanly when a request cannot be written to Codex App Server", async () => {
    const fakeProcess = createFakeCodexProcess({
      stdinWriteError: new Error("EPIPE")
    });
    childProcessMock.spawn.mockReturnValueOnce(fakeProcess);

    queueMicrotask(() => {
      fakeProcess.emit("spawn");
    });

    await expect(runCodexAIWorkspaceTurn({
      history: [],
      message: "要件を整理して",
      pendingOperations: [],
      referenceContents: [],
      references: [],
      workspacePath: "/tmp/workspace"
    })).rejects.toThrow("Codex App Serverへ送信できませんでした: EPIPE");
  });

  it("rejects cleanly when Codex App Server completes a turn as failed", async () => {
    const fakeProcess = createFakeCodexProcess({
      onWrite(chunk, process) {
        const request = JSON.parse(chunk) as { id: number; method: string };
        if (request.method === "initialize") {
          process.stdout.write(`${JSON.stringify({ id: request.id, result: {} })}\n`);
        }
        if (request.method === "thread/start") {
          process.stdout.write(`${JSON.stringify({
            id: request.id,
            result: { thread: { id: "thread-1" } }
          })}\n`);
        }
        if (request.method === "turn/start") {
          process.stdout.write(`${JSON.stringify({
            id: request.id,
            result: { turn: { id: "turn-1" } }
          })}\n`);
          setImmediate(() => {
            process.stdout.write(`${JSON.stringify({
              method: "turn/completed",
              params: {
                turn: {
                  error: { message: "invalid_json_schema" },
                  id: "turn-1",
                  status: "failed"
                }
              }
            })}\n`);
          });
        }
      }
    });
    childProcessMock.spawn.mockReturnValueOnce(fakeProcess);

    queueMicrotask(() => {
      fakeProcess.emit("spawn");
    });

    await expect(runCodexAIWorkspaceTurn({
      history: [],
      message: "要件を整理して",
      pendingOperations: [],
      referenceContents: [],
      references: [],
      workspacePath: "/tmp/workspace"
    })).rejects.toThrow("invalid_json_schema");
  });
});

describe("parseCodexResponse", () => {
  it("parses structured AI Workspace responses", () => {
    const result = parseCodexResponse(JSON.stringify({
      message: "READMEを更新します。",
      operations: [{
        content: "# Updated",
        kind: "update",
        path: "README.md",
        summary: "READMEを更新"
      }]
    }));

    expect(result).toEqual({
      message: "READMEを更新します。",
      operations: [{
        content: "# Updated",
        kind: "update",
        path: "README.md",
        summary: "READMEを更新"
      }]
    });
  });

  it("parses structured responses even when Codex adds surrounding text", () => {
    const result = parseCodexResponse([
      "承知しました。",
      JSON.stringify({
        message: "READMEを更新します。",
        operations: [{
          content: "# Updated {with braces}",
          kind: "update",
          path: "README.md",
          summary: "READMEを更新"
        }]
      }),
      "補足です。"
    ].join("\n"));

    expect(result).toEqual({
      message: "READMEを更新します。",
      operations: [{
        content: "# Updated {with braces}",
        kind: "update",
        path: "README.md",
        summary: "READMEを更新"
      }]
    });
  });

  it("ignores non-JSON fenced blocks before a structured response", () => {
    const result = parseCodexResponse([
      "変更案です。",
      "```markdown",
      "# Preview",
      "```",
      "```json",
      JSON.stringify({
        message: "docs/auth.mdを更新します。",
        operations: [{
          content: "# Auth\nupdated",
          kind: "update",
          path: "docs/auth.md",
          summary: "認証資料を更新"
        }]
      }),
      "```"
    ].join("\n"));

    expect(result).toEqual({
      message: "docs/auth.mdを更新します。",
      operations: [{
        content: "# Auth\nupdated",
        kind: "update",
        path: "docs/auth.md",
        summary: "認証資料を更新"
      }]
    });
  });

  it("normalizes common operation field name variations", () => {
    const result = parseCodexResponse(JSON.stringify({
      message: "変更案を作成します。",
      operations: [{
        description: "認証仕様を更新",
        filePath: "docs/auth.md",
        kind: "UPDATE",
        markdown: "# Auth\nupdated"
      }]
    }));

    expect(result.operations).toEqual([{
      content: "# Auth\nupdated",
      kind: "update",
      path: "docs/auth.md",
      summary: "認証仕様を更新"
    }]);
  });

  it("uses a safe fallback summary for valid operations without a summary", () => {
    const result = parseCodexResponse(JSON.stringify({
      message: "変更案を作成します。",
      operations: [{
        content: "# Auth",
        kind: "create",
        path: "docs/auth.md"
      }]
    }));

    expect(result.operations).toEqual([{
      content: "# Auth",
      kind: "create",
      path: "docs/auth.md",
      summary: "docs/auth.md を作成"
    }]);
  });

  it("keeps plain text responses visible without creating file operations", () => {
    const result = parseCodexResponse("現在の要件は認証と同期に分けて整理できます。");

    expect(result.message).toContain("現在の要件は認証と同期に分けて整理できます。");
    expect(result.message).toContain("Markdown変更案は構造化形式で取得できなかったため作成しませんでした。");
    expect(result.operations).toEqual([]);
  });

  it("keeps malformed structured responses visible without creating file operations", () => {
    const result = parseCodexResponse("```json\n{\"message\":\"途中で切れました\"\n```");

    expect(result.message).toContain("途中で切れました");
    expect(result.message).toContain("Markdown変更案は構造化形式で取得できなかったため作成しませんでした。");
    expect(result.operations).toEqual([]);
  });
});

describe("AI Workspace prompt", () => {
  it("uses a Codex-compatible strict output schema", () => {
    expect(codexAIWorkspaceOutputSchema.properties.operations.items.required).toEqual([
      "content",
      "kind",
      "path",
      "summary"
    ]);
  });

  it("instructs delete operations to include empty content", () => {
    const prompt = buildPrompt({
      history: [],
      message: "old.mdを削除して",
      pendingOperations: [],
      referenceContents: [],
      references: [],
      workspacePath: "/tmp/workspace"
    });

    expect(prompt).toContain("delete operationのcontentは空文字にしてください。");
  });

  it("includes full pending operation content", () => {
    const longContent = `# Draft\n${"x".repeat(13_000)}\n末尾`;
    const prompt = buildPrompt({
      history: [],
      message: "さっきの案を直して",
      pendingOperations: [{
        content: longContent,
        createdAt: "2026-05-30T00:00:00.000Z",
        id: "operation-1",
        kind: "update",
        path: "draft.md",
        status: "pending",
        summary: "draft.mdを更新"
      }],
      referenceContents: [],
      references: [],
      workspacePath: "/tmp/workspace"
    });

    expect(prompt).toContain(longContent);
  });
});
