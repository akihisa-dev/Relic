import type { FileTab, Tab } from "./store/editorStore";

export type EditorSaveStatus = "saved" | "dirty" | "saving" | "error" | "externalConflict";

export interface EditorSaveRequest {
  content: string;
  expectedContent: string;
  path: string;
  tabId: string;
}

export interface EditorSaveQueue {
  lastError: string | null;
  pending: EditorSaveRequest | null;
  saving: boolean;
  tabId: string | null;
  timer: ReturnType<typeof setTimeout> | null;
  waiters: Array<() => void>;
}

interface SaveQueueStatus {
  lastError: string | null;
  saving: boolean;
}

export function initialEditorSaveStatuses(tabs: Record<string, Tab>): Map<string, EditorSaveStatus> {
  const statuses = new Map<string, EditorSaveStatus>();
  for (const tab of Object.values(tabs)) {
    if (tab.kind === "file") statuses.set(tab.id, baseEditorSaveStatus(tab));
  }
  return statuses;
}

export function updateEditorSaveStatuses(
  statuses: Map<string, EditorSaveStatus>,
  dirtyTabIds: Iterable<string>,
  tabs: Record<string, Tab>,
  queueForPath: (path: string) => SaveQueueStatus | undefined
): number {
  let evaluated = 0;
  for (const tabId of dirtyTabIds) {
    evaluated += 1;
    const tab = tabs[tabId];
    if (tab?.kind !== "file") {
      statuses.delete(tabId);
      continue;
    }
    const queue = queueForPath(tab.path);
    statuses.set(tabId, queue?.saving
      ? "saving"
      : queue?.lastError
        ? "error"
        : baseEditorSaveStatus(tab));
  }
  return evaluated;
}

function baseEditorSaveStatus(tab: FileTab): EditorSaveStatus {
  if (tab.externalConflict) return "externalConflict";
  return tab.content === tab.savedContent ? "saved" : "dirty";
}
