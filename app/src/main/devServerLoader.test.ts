import { describe, expect, it, vi } from "vitest";

import {
  devServerLoadUrls,
  isRetryableDevServerLoadError,
  loadDevServerUrlWithRetry,
  type DevServerLoadWindow
} from "./devServerLoader";

function createWindow(loadURL: DevServerLoadWindow["loadURL"], destroyed = false): DevServerLoadWindow {
  return {
    isDestroyed: () => destroyed,
    loadURL
  };
}

describe("devServerLoader", () => {
  it("一時的なdev server接続失敗を再試行する", async () => {
    const loadURL = vi.fn()
      .mockRejectedValueOnce(new Error("ERR_CONNECTION_REFUSED"))
      .mockResolvedValueOnce(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(loadDevServerUrlWithRetry(createWindow(loadURL), "http://localhost:5173/", {
      probeUrl: vi.fn().mockResolvedValue(true),
      retryDelayMs: 10,
      sleep,
      timeoutMs: 30
    })).resolves.toBe(true);

    expect(loadURL).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it("対象外の読み込み失敗は再試行しない", async () => {
    const loadURL = vi.fn().mockRejectedValue(new Error("ERR_ABORTED"));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(loadDevServerUrlWithRetry(createWindow(loadURL), "http://localhost:5173/", {
      probeUrl: vi.fn().mockResolvedValue(true),
      retryDelayMs: 10,
      sleep,
      timeoutMs: 30
    })).resolves.toBe(false);

    expect(loadURL).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("ウィンドウ破棄後は読み込みを試さない", async () => {
    const loadURL = vi.fn().mockResolvedValue(undefined);

    await expect(loadDevServerUrlWithRetry(createWindow(loadURL, true), "http://localhost:5173/"))
      .resolves.toBe(false);

    expect(loadURL).not.toHaveBeenCalled();
  });

  it("Electronのcodeプロパティでも再試行対象を判定する", () => {
    expect(isRetryableDevServerLoadError({ code: "ERR_EMPTY_RESPONSE" })).toBe(true);
    expect(isRetryableDevServerLoadError({ code: "ERR_FAILED" })).toBe(false);
  });

  it("localhostのdev server URLにはループバック候補も加える", () => {
    expect(devServerLoadUrls("http://localhost:5173/")).toEqual([
      "http://localhost:5173/",
      "http://127.0.0.1:5173/",
      "http://[::1]:5173/"
    ]);
    expect(devServerLoadUrls("http://127.0.0.1:5173/")).toEqual(["http://127.0.0.1:5173/"]);
  });

  it("localhostとIPv4に失敗した場合はIPv6ループバック候補も試す", async () => {
    const loadURL = vi.fn()
      .mockRejectedValueOnce(new Error("ERR_CONNECTION_REFUSED"))
      .mockRejectedValueOnce(new Error("ERR_CONNECTION_REFUSED"))
      .mockResolvedValueOnce(undefined);

    await expect(loadDevServerUrlWithRetry(createWindow(loadURL), devServerLoadUrls("http://localhost:5173/"), {
      probeUrl: vi.fn().mockResolvedValue(true),
      retryDelayMs: 10,
      timeoutMs: 30
    })).resolves.toBe(true);

    expect(loadURL).toHaveBeenNthCalledWith(1, "http://localhost:5173/");
    expect(loadURL).toHaveBeenNthCalledWith(2, "http://127.0.0.1:5173/");
    expect(loadURL).toHaveBeenNthCalledWith(3, "http://[::1]:5173/");
  });

  it("dev serverが応答するまではloadURLを呼ばずに待つ", async () => {
    const loadURL = vi.fn().mockResolvedValue(undefined);
    const probeUrl = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(loadDevServerUrlWithRetry(createWindow(loadURL), "http://localhost:5173/", {
      probeUrl,
      retryDelayMs: 10,
      sleep,
      timeoutMs: 30
    })).resolves.toBe(true);

    expect(probeUrl).toHaveBeenCalledTimes(2);
    expect(loadURL).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(10);
  });
});
