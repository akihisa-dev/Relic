import { BrowserWindow } from "electron";

import type { Translator } from "../../shared/i18n";
import { installWindowSecurityPolicy } from "../windowSecurity";
import type { AppSettingsRecoveryState } from "./appSettingsRecovery";

const recoveryActionOrigin = "relic-settings-recovery:";

interface CreateAppSettingsRecoveryWindowInput {
  onExit: () => void;
  onShowLocation: (targetPath: string) => void;
  onStartDefaults: () => Promise<void>;
  onStartDefaultsFailed: () => void;
  recovery: AppSettingsRecoveryState;
  t: Translator;
}

export function createAppSettingsRecoveryWindow({
  onExit,
  onShowLocation,
  onStartDefaults,
  onStartDefaultsFailed,
  recovery,
  t
}: CreateAppSettingsRecoveryWindowInput): BrowserWindow {
  const window = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: "#f6f4ef",
    height: 620,
    minHeight: 520,
    minWidth: 620,
    show: false,
    title: t("settingsRecovery.title"),
    width: 760,
    webPreferences: {
      allowRunningInsecureContent: false,
      contextIsolation: true,
      javascript: false,
      nodeIntegration: false,
      partition: "relic-settings-recovery",
      sandbox: true,
      webSecurity: true
    }
  });
  let startInProgress = false;

  installWindowSecurityPolicy(window, {
    isNavigationAllowed: (url) => url.startsWith("data:text/html"),
    onNavigationDenied: (url) => {
      let action: string;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== recoveryActionOrigin) return;
        action = parsed.hostname;
      } catch {
        return;
      }

      if (action === "show-location") {
        onShowLocation(recovery.backupPath ?? recovery.settingsPath);
        return;
      }

      if (action === "exit") {
        onExit();
        return;
      }

      if (action === "start-defaults" && !startInProgress) {
        startInProgress = true;
        void onStartDefaults()
          .catch(() => {
            startInProgress = false;
            onStartDefaultsFailed();
          });
      }
    }
  });
  window.once("ready-to-show", () => {
    if (!window.isDestroyed()) window.show();
  });

  const html = createAppSettingsRecoveryHtml(recovery, t);
  const encoded = Buffer.from(html, "utf8").toString("base64");
  void window.loadURL(`data:text/html;base64,${encoded}`);
  return window;
}

export function createAppSettingsRecoveryHtml(
  recovery: AppSettingsRecoveryState,
  t: Translator
): string {
  const reason = recovery.kind === "corrupt"
    ? t("settingsRecovery.corruptReason")
    : t("settingsRecovery.unsupportedReason");
  const backup = recovery.backupPath
    ? `<dt>${escapeHtml(t("settingsRecovery.backupLocation"))}</dt><dd>${escapeHtml(recovery.backupPath)}</dd>`
    : "";
  const preservationNote = recovery.kind === "corrupt"
    ? t("settingsRecovery.corruptPreservation")
    : t("settingsRecovery.unsupportedPreservation");

  return `<!doctype html>
<html lang="${escapeHtml(t("settingsRecovery.htmlLanguage"))}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(t("settingsRecovery.title"))}</title>
  <style>
    :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    body { align-items: center; background: #f6f4ef; color: #25231f; display: flex; justify-content: center; margin: 0; min-height: 100vh; }
    main { box-sizing: border-box; max-width: 680px; padding: 48px; width: 100%; }
    .eyebrow { color: #7a5f3f; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    h1 { font-size: 28px; letter-spacing: -.02em; margin: 10px 0 16px; }
    p { line-height: 1.65; margin: 10px 0; }
    .reason { background: #fff8e8; border: 1px solid #ddc99e; border-radius: 10px; padding: 14px 16px; }
    dl { background: rgba(255,255,255,.55); border-radius: 10px; margin: 18px 0; padding: 14px 16px; }
    dt { color: #675f55; font-size: 12px; font-weight: 700; margin-top: 8px; }
    dt:first-child { margin-top: 0; }
    dd { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; line-height: 1.5; margin: 4px 0 0; overflow-wrap: anywhere; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
    a { border: 1px solid #8f867a; border-radius: 8px; color: inherit; padding: 10px 14px; text-decoration: none; }
    a.primary { background: #302a22; border-color: #302a22; color: #fff; font-weight: 700; }
    .note { color: #675f55; font-size: 13px; }
    @media (prefers-color-scheme: dark) {
      body { background: #25231f; color: #f4f0e8; }
      .reason { background: #3b3223; border-color: #685536; }
      dl { background: rgba(255,255,255,.06); }
      dt, .note { color: #c9c0b4; }
      a { border-color: #8f867a; }
      a.primary { background: #efe7da; border-color: #efe7da; color: #25231f; }
    }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">${escapeHtml(t("settingsRecovery.eyebrow"))}</div>
    <h1>${escapeHtml(t("settingsRecovery.heading"))}</h1>
    <p class="reason">${escapeHtml(reason)}</p>
    <p>${escapeHtml(t("settingsRecovery.workspaceUntouched"))}</p>
    <dl>
      <dt>${escapeHtml(t("settingsRecovery.settingsLocation"))}</dt>
      <dd>${escapeHtml(recovery.settingsPath)}</dd>
      ${backup}
    </dl>
    <p class="note">${escapeHtml(preservationNote)}</p>
    <div class="actions">
      <a class="primary" href="relic-settings-recovery://start-defaults">${escapeHtml(t("settingsRecovery.startDefaults"))}</a>
      <a href="relic-settings-recovery://show-location">${escapeHtml(t("settingsRecovery.showLocation"))}</a>
      <a href="relic-settings-recovery://exit">${escapeHtml(t("settingsRecovery.exit"))}</a>
    </div>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "\"": "&quot;",
      "&": "&amp;",
      "'": "&#39;",
      "<": "&lt;",
      ">": "&gt;"
    };
    return entities[character] ?? character;
  });
}
