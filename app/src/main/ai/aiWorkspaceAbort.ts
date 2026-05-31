export function throwIfAIWorkspaceAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Cowork処理を中断しました。");
  }
}

export function isAIWorkspaceAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") return true;
  return error instanceof Error && error.message.includes("Cowork処理を中断しました");
}
