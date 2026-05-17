export function readEditorClipboardText(): string {
  if (window.relic?.readClipboardText) {
    return window.relic.readClipboardText();
  }

  return "";
}

export async function writeEditorClipboardText(text: string): Promise<void> {
  if (window.relic?.writeClipboardText) {
    window.relic.writeClipboardText(text);
    return;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the textarea fallback.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.left = "-9999px";
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export async function readEditorClipboardForPaste(): Promise<string> {
  if (window.relic?.readClipboardText) {
    return readEditorClipboardText();
  }

  if (navigator.clipboard?.readText) {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return "";
    }
  }

  return "";
}
