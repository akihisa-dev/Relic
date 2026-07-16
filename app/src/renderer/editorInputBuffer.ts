export interface BufferedEditorChange {
  content: string;
  filePath: string;
  generation: number;
  tabId: string;
}

interface PendingEditorChange extends BufferedEditorChange {
  commit: (change: BufferedEditorChange) => void;
  timer: ReturnType<typeof setTimeout>;
}

const INPUT_BUFFER_DELAY_MS = 80;
const pendingChanges = new Map<string, PendingEditorChange>();
let nextGeneration = 0;

export function bufferEditorChange(input: {
  content: string;
  filePath: string;
  tabId: string;
  commit: (change: BufferedEditorChange) => void;
}): number {
  const previous = pendingChanges.get(input.tabId);
  if (previous) clearTimeout(previous.timer);

  const generation = ++nextGeneration;
  const pending: PendingEditorChange = {
    ...input,
    generation,
    timer: setTimeout(() => {
      flushPendingEditorChanges([input.tabId], generation);
    }, INPUT_BUFFER_DELAY_MS)
  };
  pendingChanges.set(input.tabId, pending);
  return generation;
}

export function discardPendingEditorChanges(tabIds?: Iterable<string>): void {
  for (const tabId of targetTabIds(tabIds)) {
    const pending = pendingChanges.get(tabId);
    if (!pending) continue;
    clearTimeout(pending.timer);
    pendingChanges.delete(tabId);
  }
}

export function flushPendingEditorChanges(tabIds?: Iterable<string>, expectedGeneration?: number): void {
  for (const tabId of targetTabIds(tabIds)) {
    const pending = pendingChanges.get(tabId);
    if (!pending || (expectedGeneration !== undefined && pending.generation !== expectedGeneration)) continue;

    clearTimeout(pending.timer);
    pendingChanges.delete(tabId);
    pending.commit({
      content: pending.content,
      filePath: pending.filePath,
      generation: pending.generation,
      tabId: pending.tabId
    });
  }
}

function targetTabIds(tabIds?: Iterable<string>): string[] {
  return tabIds ? Array.from(new Set(tabIds)) : Array.from(pendingChanges.keys());
}

/** @internal Test-only reset for module-owned timers. */
export function __resetEditorInputBufferForTests(): void {
  discardPendingEditorChanges();
  nextGeneration = 0;
}
