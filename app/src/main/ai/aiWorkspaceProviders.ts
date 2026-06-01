import type { AIProvider, OpenAIWorkspaceModel } from "../../shared/ipc";
import { readOpenAIAPIKey } from "./openAIKeyStore";
import { runCodexAIWorkspaceTurn } from "./codexAppServerClient";
import { runOpenAIWorkspaceTurn } from "./openAIResponsesClient";
import type { AIWorkspaceTurnResult } from "./aiWorkspaceServiceTypes";

type ProviderTurnInput = Omit<Parameters<typeof runOpenAIWorkspaceTurn>[0], "apiKey" | "model">;

export class MissingOpenAIAPIKeyError extends Error {
  constructor() {
    super("OpenAI APIキーが登録されていません。");
    this.name = "MissingOpenAIAPIKeyError";
  }
}

export async function runAIWorkspaceProviderTurn({
  model,
  provider,
  signal,
  turnInput,
  userDataPath,
  workspacePath
}: {
  model: OpenAIWorkspaceModel;
  provider: AIProvider;
  signal?: AbortSignal;
  turnInput: ProviderTurnInput;
  userDataPath: string;
  workspacePath: string;
}): Promise<AIWorkspaceTurnResult> {
  if (provider === "openai-api") {
    const apiKey = await readOpenAIAPIKey(userDataPath);
    if (!apiKey) throw new MissingOpenAIAPIKeyError();

    return await runOpenAIWorkspaceTurn({
      ...turnInput,
      apiKey,
      model,
      signal
    });
  }

  return await runCodexAIWorkspaceTurn({
    ...turnInput,
    signal,
    workspacePath
  });
}
