export const devServerLoadRetryDelayMs = 250;
export const devServerLoadRetryTimeoutMs = 15000;

const retryableDevServerLoadErrors = new Set([
  "ERR_CONNECTION_REFUSED",
  "ERR_CONNECTION_RESET",
  "ERR_EMPTY_RESPONSE"
]);

export interface DevServerLoadWindow {
  isDestroyed: () => boolean;
  loadURL: (url: string) => Promise<void>;
}

interface DevServerLoadRetryOptions {
  probeUrl?: (url: string) => Promise<boolean>;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

export function isRetryableDevServerLoadError(error: unknown): boolean {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
  const message = error instanceof Error ? error.message : String(error);

  return retryableDevServerLoadErrors.has(code) ||
    [...retryableDevServerLoadErrors].some((retryableCode) => message.includes(retryableCode));
}

export function devServerLoadUrls(url: string): string[] {
  try {
    const parsed = new URL(url);

    if (parsed.hostname !== "localhost") return [url];

    const ipv4Url = new URL(url);
    ipv4Url.hostname = "127.0.0.1";

    const ipv6Url = new URL(url);
    ipv6Url.hostname = "[::1]";

    return [url, ipv4Url.toString(), ipv6Url.toString()];
  } catch {
    return [url];
  }
}

export async function loadDevServerUrlWithRetry(
  window: DevServerLoadWindow,
  url: string | string[],
  options: DevServerLoadRetryOptions = {}
): Promise<boolean> {
  const retryDelayMs = options.retryDelayMs ?? devServerLoadRetryDelayMs;
  const timeoutMs = options.timeoutMs ?? devServerLoadRetryTimeoutMs;
  const sleep = options.sleep ?? delay;
  const probeUrl = options.probeUrl ?? probeDevServerUrl;
  const maxAttempts = retryDelayMs > 0 ? Math.floor(timeoutMs / retryDelayMs) + 1 : 1;
  const urls = Array.isArray(url) ? url : [url];

  for (let attempt = 0; attempt < maxAttempts && !window.isDestroyed(); attempt += 1) {
    let lastError: unknown = null;

    for (const candidateUrl of urls) {
      try {
        const isReachable = await probeUrl(candidateUrl);

        if (!isReachable) {
          lastError = new Error("ERR_CONNECTION_REFUSED");
          continue;
        }

        await window.loadURL(candidateUrl);
        return true;
      } catch (error) {
        lastError = error;
      }
    }

    const canRetry = isRetryableDevServerLoadError(lastError) && attempt < maxAttempts - 1;

    if (!canRetry || window.isDestroyed()) return false;

    await sleep(retryDelayMs);
  }

  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function probeDevServerUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      method: "HEAD"
    });

    return response.status > 0;
  } catch {
    return false;
  }
}
