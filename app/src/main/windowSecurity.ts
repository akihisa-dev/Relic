import type { BrowserWindow } from "electron";

import { normalizeUrlForSecurity } from "../shared/urlSafety";

interface WindowSecurityPolicy {
  isNavigationAllowed: (url: string) => boolean;
  onNavigationDenied?: (url: string) => void;
  onWindowOpen?: (url: string) => void;
}

export function installWindowSecurityPolicy(
  window: BrowserWindow,
  policy: WindowSecurityPolicy
): () => void {
  const { webContents } = window;
  let installed = true;

  webContents.setWindowOpenHandler(({ url }) => {
    if (installed) {
      policy.onWindowOpen?.(url);
    }
    return { action: "deny" };
  });

  const handleNavigation = (event: Electron.Event, url: string): void => {
    if (policy.isNavigationAllowed(url)) return;

    event.preventDefault();
    policy.onNavigationDenied?.(url);
  };
  const denyWebview = (event: Electron.Event): void => {
    event.preventDefault();
  };

  webContents.on("will-navigate", handleNavigation);
  webContents.on("will-redirect", handleNavigation);
  webContents.on("will-attach-webview", denyWebview);
  webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  const cleanup = (): void => {
    if (!installed) return;
    installed = false;
    webContents.removeListener("will-navigate", handleNavigation);
    webContents.removeListener("will-redirect", handleNavigation);
    webContents.removeListener("will-attach-webview", denyWebview);
    window.removeListener("closed", cleanup);
  };
  window.once("closed", cleanup);
  return cleanup;
}

export function isAllowedExternalUrl(url: string): boolean {
  const normalizedUrl = normalizeUrlForSecurity(url);
  if (normalizedUrl === null) return false;

  try {
    const parsed = new URL(normalizedUrl);

    return parsed.protocol === "https:" && (
      parsed.hostname === "github.com" ||
      parsed.hostname.endsWith(".github.com")
    );
  } catch {
    return false;
  }
}

export function isAllowedPackagedAppNavigation(url: string, rendererIndexUrl: string): boolean {
  if (normalizeUrlForSecurity(url) === null) return false;
  return url === rendererIndexUrl || url.startsWith(`${rendererIndexUrl}#`);
}

export function isAllowedDevelopmentNavigation(url: string, allowedUrls: string[]): boolean {
  const normalizedUrl = normalizeUrlForSecurity(url);
  if (normalizedUrl === null || normalizedUrl.includes("\\")) return false;

  try {
    const target = new URL(normalizedUrl);
    if (target.username !== "" || target.password !== "") return false;

    return allowedUrls.some((allowedUrl) => {
      try {
        const allowed = new URL(allowedUrl);
        return target.protocol === allowed.protocol &&
          target.hostname === allowed.hostname &&
          target.port === allowed.port;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
