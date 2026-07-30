import type { BrowserWindow } from "electron";

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
  webContents.on("will-attach-webview", denyWebview);
  webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  const cleanup = (): void => {
    if (!installed) return;
    installed = false;
    webContents.removeListener("will-navigate", handleNavigation);
    webContents.removeListener("will-attach-webview", denyWebview);
    window.removeListener("closed", cleanup);
  };
  window.once("closed", cleanup);
  return cleanup;
}

export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    return parsed.protocol === "https:" && (
      parsed.hostname === "github.com" ||
      parsed.hostname.endsWith(".github.com")
    );
  } catch {
    return false;
  }
}

export function isAllowedPackagedAppNavigation(url: string, rendererIndexUrl: string): boolean {
  return url === rendererIndexUrl || url.startsWith(`${rendererIndexUrl}#`);
}

export function isAllowedDevelopmentNavigation(url: string, allowedUrls: string[]): boolean {
  if (url.includes("\\")) return false;

  try {
    const target = new URL(url);
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
