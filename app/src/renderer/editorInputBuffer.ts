import type { ChangeSet } from "@codemirror/state";

import {
  changeRangeFromChangeSet,
  nextEditorContentGeneration,
  type EditorContentUpdateInput
} from "./editorContentUpdate";

export interface DeferredEditorContent {
  toString: () => string;
}

export interface BufferedEditorChange {
  content: string;
  contentUpdate: EditorContentUpdateInput;
  filePath: string;
  generation: number;
  tabId: string;
}

interface PendingEditorChange extends BufferedEditorChange {
  changes: ChangeSet | null;
  deferredContent: DeferredEditorContent | null;
  commit: (change: BufferedEditorChange) => void;
  timer: ReturnType<typeof setTimeout>;
}

const INPUT_BUFFER_DELAY_MS = 80;
const pendingChanges = new Map<string, PendingEditorChange>();

export function bufferEditorChange(input: {
  changes?: ChangeSet;
  content: string | DeferredEditorContent;
  filePath: string;
  tabId: string;
  sourceKey?: string;
  commit: (change: BufferedEditorChange) => void;
}): number {
  let previous = pendingChanges.get(input.tabId);
  if (previous && previous.contentUpdate.sourceKey !== input.sourceKey) {
    flushPendingEditorChanges([input.tabId], previous.generation);
    previous = undefined;
  }
  if (previous) clearTimeout(previous.timer);

  const generation = nextEditorContentGeneration();
  const changes = previous
    ? previous.changes && input.changes
      ? previous.changes.compose(input.changes)
      : null
    : input.changes ?? null;
  const pending: PendingEditorChange = {
    changes,
    content: typeof input.content === "string" ? input.content : "",
    contentUpdate: {
      change: changes ? changeRangeFromChangeSet(changes) : null,
      generation,
      sourceKey: input.sourceKey
    },
    deferredContent: typeof input.content === "string" ? null : input.content,
    filePath: input.filePath,
    generation,
    tabId: input.tabId,
    commit: input.commit,
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
      content: pending.deferredContent?.toString() ?? pending.content,
      contentUpdate: pending.contentUpdate,
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
}
