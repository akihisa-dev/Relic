import type { AIWorkspaceUsageState } from "../../shared/ipc";
import { buildPrompt, codexAIWorkspaceOutputSchema } from "./codexAppServerPrompt";
import { parseCodexResponse } from "./codexAppServerResponse";
import { CodexAppServerTransport, codexUsageRequestTimeoutMs } from "./codexAppServerTransport";
import { toAIWorkspaceUsageState } from "./codexAppServerUsage";
import { createAIWorkspaceOperationId } from "./aiWorkspaceProviderHelpers";
import type {
  RunCodexAIWorkspaceTurnInput,
  RunCodexAIWorkspaceTurnResult
} from "./codexAppServerTypes";

export { buildPrompt, codexAIWorkspaceOutputSchema, parseCodexResponse };

export async function runCodexAIWorkspaceTurn(
  input: RunCodexAIWorkspaceTurnInput
): Promise<RunCodexAIWorkspaceTurnResult> {
  const client = new CodexAppServerTransport();
  const abortError = new Error("Cowork処理を中断しました。");

  if (input.signal?.aborted) {
    throw abortError;
  }

  const abortHandler = (): void => {
    client.abort(abortError);
  };
  input.signal?.addEventListener("abort", abortHandler, { once: true });

  try {
    await client.start();
    await client.initialize();
    const threadId = await client.startThread(input.workspacePath);
    const text = await client.startTurn(threadId, buildPrompt(input));
    const response = parseCodexResponse(text);

    return {
      message: response.message,
      operations: response.operations.map((operation) => ({
        ...operation,
        createdAt: new Date().toISOString(),
        id: createAIWorkspaceOperationId(operation.kind),
        status: "pending"
      }))
    };
  } finally {
    input.signal?.removeEventListener("abort", abortHandler);
    client.stop();
  }
}

export async function readCodexAIWorkspaceUsage(): Promise<AIWorkspaceUsageState | null> {
  const client = new CodexAppServerTransport(codexUsageRequestTimeoutMs);

  try {
    // eslint-disable-next-line react-doctor/async-parallel -- the app-server protocol requires start, initialize, then rate-limit request in order.
    await client.start();
    await client.initialize();
    const response = await client.readRateLimits();

    return toAIWorkspaceUsageState(response);
  } finally {
    client.stop();
  }
}
