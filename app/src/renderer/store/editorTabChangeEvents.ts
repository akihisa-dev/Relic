type EditorTabChangeListener = (tabId: string) => void;

const listeners = new Set<EditorTabChangeListener>();

export function emitEditorTabChanged(tabId: string): void {
  for (const listener of listeners) listener(tabId);
}

export function subscribeEditorTabChanges(listener: EditorTabChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
