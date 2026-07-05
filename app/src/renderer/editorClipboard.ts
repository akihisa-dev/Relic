export async function writeEditorClipboardText(text: string): Promise<void> {
  if (window.relic?.copyEditorTextToClipboard) {
    let receivedIpcResult = false;
    try {
      const result = await window.relic.copyEditorTextToClipboard({ text });
      receivedIpcResult = true;
      if (result.ok) return;
      throw new Error(result.error.message);
    } catch (error) {
      if (receivedIpcResult) throw error;
      // Fall through to browser and DOM fallbacks.
    }
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
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Clipboard copy failed");
  }
}

export async function readEditorClipboardTextForPaste(): Promise<string> {
  if (window.relic?.readEditorTextFromClipboard) {
    let receivedIpcResult = false;
    try {
      const result = await window.relic.readEditorTextFromClipboard();
      receivedIpcResult = true;
      if (result.ok) return result.value;
      throw new Error(result.error.message);
    } catch (error) {
      if (receivedIpcResult) throw error;
      // Fall through to the browser Clipboard API.
    }
  }

  if (navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }

  throw new Error("Clipboard paste failed");
}
