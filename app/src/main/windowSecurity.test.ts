import { describe, expect, it, vi } from "vitest";

import {
  installWindowSecurityPolicy,
  isAllowedDevelopmentNavigation,
  isAllowedExternalUrl,
  isAllowedPackagedAppNavigation
} from "./windowSecurity";

function createWindowSecurityFixture() {
  const browserWindowListeners = new Map<string, (...args: unknown[]) => void>();
  const webContentsListeners = new Map<string, (...args: unknown[]) => void>();
  const permissionRequestHandler = vi.fn();
  const setWindowOpenHandler = vi.fn();
  const webContentsRemoveListener = vi.fn((
    event: string,
    listener: (...args: unknown[]) => void
  ) => {
    if (webContentsListeners.get(event) === listener) {
      webContentsListeners.delete(event);
    }
  });
  const windowRemoveListener = vi.fn((
    event: string,
    listener: (...args: unknown[]) => void
  ) => {
    if (browserWindowListeners.get(event) === listener) {
      browserWindowListeners.delete(event);
    }
  });
  const window = {
    once: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      browserWindowListeners.set(event, listener);
    }),
    removeListener: windowRemoveListener,
    webContents: {
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        webContentsListeners.set(event, listener);
      }),
      removeListener: webContentsRemoveListener,
      session: {
        setPermissionRequestHandler: permissionRequestHandler
      },
      setWindowOpenHandler
    }
  } as unknown as Electron.BrowserWindow;

  return {
    browserWindowListeners,
    permissionRequestHandler,
    setWindowOpenHandler,
    webContentsListeners,
    webContentsRemoveListener,
    window,
    windowRemoveListener
  };
}

describe("installWindowSecurityPolicy", () => {
  it("新規ウィンドウ、許可外遷移、webview、権限要求を共通方針で拒否する", () => {
    const fixture = createWindowSecurityFixture();
    const onNavigationDenied = vi.fn();
    const onWindowOpen = vi.fn();

    installWindowSecurityPolicy(fixture.window, {
      isNavigationAllowed: (url) => url.startsWith("data:text/html"),
      onNavigationDenied,
      onWindowOpen
    });

    const openHandler = fixture.setWindowOpenHandler.mock.calls.at(-1)?.[0];
    expect(openHandler?.({ url: "https://example.com" })).toEqual({ action: "deny" });
    expect(onWindowOpen).toHaveBeenCalledWith("https://example.com");

    const navigateHandler = fixture.webContentsListeners.get("will-navigate");
    const allowedNavigation = { preventDefault: vi.fn() };
    navigateHandler?.(allowedNavigation, "data:text/html;base64,PGh0bWw+PC9odG1sPg==");
    expect(allowedNavigation.preventDefault).not.toHaveBeenCalled();

    const blockedNavigation = { preventDefault: vi.fn() };
    navigateHandler?.(blockedNavigation, "https://example.com");
    expect(blockedNavigation.preventDefault).toHaveBeenCalledOnce();
    expect(onNavigationDenied).toHaveBeenCalledWith("https://example.com");

    const redirectHandler = fixture.webContentsListeners.get("will-redirect");
    const blockedRedirect = { preventDefault: vi.fn() };
    redirectHandler?.(blockedRedirect, "https://example.com");
    expect(blockedRedirect.preventDefault).toHaveBeenCalledOnce();

    const attachWebviewHandler = fixture.webContentsListeners.get("will-attach-webview");
    const attachWebviewEvent = { preventDefault: vi.fn() };
    attachWebviewHandler?.(attachWebviewEvent);
    expect(attachWebviewEvent.preventDefault).toHaveBeenCalledOnce();

    const permissionHandler = fixture.permissionRequestHandler.mock.calls.at(-1)?.[0];
    const permissionCallback = vi.fn();
    permissionHandler?.({}, "notifications", permissionCallback);
    expect(permissionCallback).toHaveBeenCalledWith(false);
  });

  it("cleanup時に登録listenerと通知callbackを解除し、deny-new-windowは維持する", () => {
    const fixture = createWindowSecurityFixture();
    const onWindowOpen = vi.fn();
    const cleanup = installWindowSecurityPolicy(fixture.window, {
      isNavigationAllowed: () => false,
      onWindowOpen
    });
    const openHandler = fixture.setWindowOpenHandler.mock.calls.at(-1)?.[0];

    cleanup();
    cleanup();
    openHandler?.({ url: "https://example.com" });

    expect(fixture.webContentsRemoveListener).toHaveBeenCalledTimes(3);
    expect(fixture.webContentsListeners.has("will-navigate")).toBe(false);
    expect(fixture.webContentsListeners.has("will-redirect")).toBe(false);
    expect(fixture.webContentsListeners.has("will-attach-webview")).toBe(false);
    expect(fixture.windowRemoveListener).toHaveBeenCalledOnce();
    expect(fixture.browserWindowListeners.has("closed")).toBe(false);
    expect(onWindowOpen).not.toHaveBeenCalled();
    expect(openHandler?.({ url: "https://example.com" })).toEqual({ action: "deny" });
  });

  it("ウィンドウ終了時に自動でlistenerを解除する", () => {
    const fixture = createWindowSecurityFixture();
    installWindowSecurityPolicy(fixture.window, {
      isNavigationAllowed: () => true
    });

    fixture.browserWindowListeners.get("closed")?.();

    expect(fixture.webContentsRemoveListener).toHaveBeenCalledTimes(3);
    expect(fixture.webContentsListeners.size).toBe(0);
  });
});

describe("isAllowedExternalUrl", () => {
  it("allows only explicit https external link destinations", () => {
    expect(isAllowedExternalUrl("https://github.com")).toBe(true);
    expect(isAllowedExternalUrl("https://docs.github.com/actions")).toBe(true);

    expect(isAllowedExternalUrl("http://github.com")).toBe(false);
    expect(isAllowedExternalUrl("https://platform.openai.com")).toBe(false);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedExternalUrl("https://github.com/\u0000evil")).toBe(false);
    expect(isAllowedExternalUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isAllowedExternalUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedExternalUrl("https://github.com.evil.com")).toBe(false);
    expect(isAllowedExternalUrl("https://github.com.evil.example")).toBe(false);
    expect(isAllowedExternalUrl("https://evilgithub.com")).toBe(false);
    expect(isAllowedExternalUrl("not a url")).toBe(false);
  });
});

describe("isAllowedPackagedAppNavigation", () => {
  it("allows only the packaged renderer entry file and its hash navigation", () => {
    const indexUrl = "file:///Applications/Relic.app/Contents/Resources/app.asar/.vite/renderer/main_window/index.html";

    expect(isAllowedPackagedAppNavigation(indexUrl, indexUrl)).toBe(true);
    expect(isAllowedPackagedAppNavigation(`${indexUrl}#settings`, indexUrl)).toBe(true);

    expect(isAllowedPackagedAppNavigation("file:///etc/passwd", indexUrl)).toBe(false);
    expect(isAllowedPackagedAppNavigation(`${indexUrl}#settings\u0000`, indexUrl)).toBe(false);
    expect(isAllowedPackagedAppNavigation("javascript:alert(1)", indexUrl)).toBe(false);
    expect(isAllowedPackagedAppNavigation("data:text/html,<script>alert(1)</script>", indexUrl)).toBe(false);
    expect(isAllowedPackagedAppNavigation("https://github.com/akihisa-dev/Relic", indexUrl)).toBe(false);
    expect(isAllowedPackagedAppNavigation(`${indexUrl}.evil`, indexUrl)).toBe(false);
    expect(isAllowedPackagedAppNavigation(`${indexUrl}?next=file:///etc/passwd`, indexUrl)).toBe(false);
  });
});

describe("isAllowedDevelopmentNavigation", () => {
  const allowedUrls = [
    "http://localhost:5173/",
    "http://127.0.0.1:5173/",
    "http://[::1]:5173/"
  ];

  it.each(allowedUrls)("許可したループバックoriginを許可する: %s", (url) => {
    expect(isAllowedDevelopmentNavigation(`${url}notes?view=preview#top`, allowedUrls)).toBe(true);
  });

  it.each([
    "http://localhost:5173@evil.example/",
    "http://localhost.evil.example:5173/",
    "https://localhost:5173/",
    "http://localhost:4173/",
    "http:\\\\localhost:5173\\evil",
    "http://user@localhost:5173/",
    "http://user%40name@localhost:5173/",
    "javascript:alert(1)",
    "http://localhost:5173/\u0000evil",
    "data:text/html,hello",
    "file:///tmp/index.html",
    "not a url"
  ])("許可originに見せかけた遷移を拒否する: %s", (url) => {
    expect(isAllowedDevelopmentNavigation(url, allowedUrls)).toBe(false);
  });
});
