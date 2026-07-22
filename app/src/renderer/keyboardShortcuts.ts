type ShortcutKey = "mod" | "shift" | "alt" | string;

export function isPrimaryShortcutEvent(event: KeyboardEvent): boolean {
  return event.metaKey;
}

export function formatShortcut(keys: ShortcutKey[]): string {
  return keys
    .map((key) => {
      const normalized = key.toLowerCase();
      if (normalized === "mod") return "⌘";
      if (normalized === "shift") return "⇧";
      if (normalized === "alt") return "⌥";
      return key;
    })
    .join("");
}
