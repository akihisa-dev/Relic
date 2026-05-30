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

import { parseCodexResponse, runCodexAIWorkspaceTurn } from "./codexAppServerClient";

function createFakeCodexProcess(): EventEmitter & {
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
    write(_chunk, _encoding, callback) {
      callback();
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
