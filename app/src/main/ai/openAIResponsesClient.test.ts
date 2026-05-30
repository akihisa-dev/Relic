import { afterEach, describe, expect, it, vi } from "vitest";

import { runOpenAIWorkspaceTurn, testOpenAIAPIKey } from "./openAIResponsesClient";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runOpenAIWorkspaceTurn", () => {
  it("calls the Responses API with structured output and returns operations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
      output_text: JSON.stringify({
        message: "READMEを更新します。",
        operations: [{
          content: "# README\nUpdated",
          kind: "update",
          path: "README.md",
          summary: "READMEを更新"
        }]
      })
    }), { status: 200 }));

    const result = await runOpenAIWorkspaceTurn({
      apiKey: "sk-test-openai-key",
      history: [],
      message: "READMEを整理して",
      model: "gpt-5.4",
      pendingOperations: [],
      referenceContents: [{ content: "# README\nOld", path: "README.md" }],
      references: [{ line: 1, path: "README.md", preview: "# README" }]
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer sk-test-openai-key",
        "Content-Type": "application/json"
      }),
      method: "POST"
    }));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<string, unknown>;
    expect(body.model).toBe("gpt-5.4");
    expect(body.text).toEqual(expect.objectContaining({
      format: expect.objectContaining({
        name: "relic_ai_workspace_response",
        strict: true,
        type: "json_schema"
      })
    }));
    expect(result.message).toBe("READMEを更新します。");
    expect(result.operations).toEqual([
      expect.objectContaining({
        content: "# README\nUpdated",
        kind: "update",
        path: "README.md",
        status: "pending",
        summary: "READMEを更新"
      })
    ]);
  });
});

describe("testOpenAIAPIKey", () => {
  it("checks the API key with the models endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));

    await expect(testOpenAIAPIKey("sk-test-openai-key")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/models", expect.objectContaining({
      headers: { Authorization: "Bearer sk-test-openai-key" },
      method: "GET"
    }));
  });
});
