type ShortcutKey = "mod" | "shift" | "alt" | string;

export function getPlatform(): string {
  return typeof navigator === "undefined" ? "" : navigator.platform;
}

export function isMacPlatform(platform = getPlatform()): boolean {
  return /^(Mac|iPhone|iPad|iPod)/i.test(platform);
}

export function isPrimaryShortcutEvent(event: KeyboardEvent, platform = getPlatform()): boolean {
  return isMacPlatform(platform) ? event.metaKey : event.ctrlKey;
}

export function formatShortcut(keys: ShortcutKey[], platform = getPlatform()): string {
  const isMac = isMacPlatform(platform);

  return keys
    .map((key) => {
      const normalized = key.toLowerCase();
      if (normalized === "mod") return isMac ? "⌘" : "Ctrl";
      if (normalized === "shift") return isMac ? "⇧" : "Shift";
      if (normalized === "alt") return isMac ? "⌥" : "Alt";
      return key;
    })
    .join(isMac ? "" : "+");
}
