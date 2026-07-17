import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../test/rendererTestUtils";
import {
  __resetPreviewImageLoaderForTests,
  hydratePreviewImages,
  loadPreviewImage,
  previewImageContextKey
} from "./previewImageLoader";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("previewImageLoader", () => {
  afterEach(() => {
    __resetPreviewImageLoaderForTests();
    window.relic = undefined;
    document.body.replaceChildren();
  });

  it("同じ画像の同時要求と成功結果を共有する", async () => {
    const readImageFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { dataUrl: "data:image/png;base64,aW1hZ2U=" }
    });
    window.relic = makeRelicApi({ readImageFile });
    const contextKey = previewImageContextKey("/workspace", 1);

    const [first, second] = await Promise.all([
      loadPreviewImage("assets/image.png", contextKey),
      loadPreviewImage("assets/image.png", contextKey)
    ]);
    const third = await loadPreviewImage("assets/image.png", contextKey);

    expect(first).toBe("data:image/png;base64,aW1hZ2U=");
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(readImageFile).toHaveBeenCalledTimes(1);
  });

  it("ワークスペース更新後の旧要求を破棄する", async () => {
    const oldRequest = deferred<{ ok: true; value: { dataUrl: string } }>();
    const readImageFile = vi.fn()
      .mockImplementationOnce(() => oldRequest.promise)
      .mockResolvedValueOnce({ ok: true, value: { dataUrl: "data:image/png;base64,bmV3" } });
    window.relic = makeRelicApi({ readImageFile });

    const oldResult = loadPreviewImage("assets/image.png", previewImageContextKey("/workspace", 1));
    const newResult = loadPreviewImage("assets/image.png", previewImageContextKey("/workspace", 2));
    oldRequest.resolve({ ok: true, value: { dataUrl: "data:image/png;base64,b2xk" } });

    await expect(oldResult).resolves.toBeNull();
    await expect(newResult).resolves.toBe("data:image/png;base64,bmV3");
  });

  it("旧DOMの遅い結果を現在の画像要素へ混入させない", async () => {
    const oldRequest = deferred<{ ok: true; value: { dataUrl: string } }>();
    const readImageFile = vi.fn()
      .mockImplementationOnce(() => oldRequest.promise)
      .mockResolvedValueOnce({ ok: true, value: { dataUrl: "data:image/png;base64,bmV3" } });
    window.relic = makeRelicApi({ readImageFile });
    const contextKey = previewImageContextKey("/workspace", 1);
    const oldRoot = document.createElement("div");
    oldRoot.innerHTML = '<span data-relic-image-alt="old" data-relic-image-path="old.png">old</span>';
    document.body.append(oldRoot);
    const disposeOld = hydratePreviewImages(oldRoot, contextKey);
    disposeOld();
    oldRoot.remove();

    const newRoot = document.createElement("div");
    newRoot.innerHTML = '<span data-relic-image-alt="new" data-relic-image-path="new.png">new</span>';
    document.body.append(newRoot);
    hydratePreviewImages(newRoot, contextKey);
    oldRequest.resolve({ ok: true, value: { dataUrl: "data:image/png;base64,b2xk" } });
    await vi.waitFor(() => expect(newRoot.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,bmV3"));

    expect(newRoot.querySelector("img")?.getAttribute("alt")).toBe("new");
  });

  it("読込失敗時はaltのプレースホルダーを維持する", async () => {
    window.relic = makeRelicApi({
      readImageFile: vi.fn().mockResolvedValue({
        error: { code: "IMAGE_READ_FAILED", message: "failed" },
        ok: false
      })
    });
    const root = document.createElement("div");
    root.innerHTML = '<span data-relic-image-alt="図" data-relic-image-path="missing.png">図</span>';
    document.body.append(root);

    hydratePreviewImages(root, previewImageContextKey("/workspace", 1));
    await vi.waitFor(() => expect(window.relic!.readImageFile).toHaveBeenCalled());

    expect(root.querySelector("img")).toBeNull();
    expect(root.textContent).toBe("図");
  });
});
