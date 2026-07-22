const localContentEchoes = new Map<string, string>();

export function markLocalEditorContentEcho(key: string, content: string): void {
  localContentEchoes.set(key, content);
}

export function consumeLocalEditorContentEcho(key: string, content: string): boolean {
  if (localContentEchoes.get(key) !== content) return false;
  localContentEchoes.delete(key);
  return true;
}

export function clearLocalEditorContentEcho(key: string): void {
  localContentEchoes.delete(key);
}

/** @internal Test-only reset for module state. */
export function __resetLocalEditorContentEchoesForTests(): void {
  localContentEchoes.clear();
}
