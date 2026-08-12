import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../test/rendererTestUtils";
import {
  __resetPreviewImageLoaderForTests,
  hydratePreviewImages,
  loadPreviewImage,
  previewImageContextKey,
  resolvePreviewImages
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

  it("画像の一括読込を有限並列に制限する", async () => {
    const gates = new Map<string, ReturnType<typeof deferred<{ ok: true; value: { dataUrl: string } }>>>();
    let inFlight = 0;
    let maxInFlight = 0;
    const readImageFile = vi.fn().mockImplementation(({ path }: { path: string }) => {
      const gate = deferred<{ ok: true; value: { dataUrl: string } }>();
      gates.set(path, gate);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return gate.promise.finally(() => {
        inFlight -= 1;
      });
    });
    window.relic = makeRelicApi({ readImageFile });
    const root = document.createElement("div");
    root.innerHTML = Array.from({ length: 8 }, (_, index) =>
      `<span data-relic-image-alt="${index}" data-relic-image-path="image-${index}.png">${index}</span>`
    ).join("");

    const result = resolvePreviewImages(root, previewImageContextKey("/workspace", 1));
    await vi.waitFor(() => expect(readImageFile).toHaveBeenCalledTimes(4));
    expect(maxInFlight).toBe(4);

    for (let index = 0; index < 4; index += 1) {
      gates.get(`image-${index}.png`)!.resolve({
        ok: true,
        value: { dataUrl: "data:image/png;base64,aW1hZ2U=" }
      });
    }
    await vi.waitFor(() => expect(readImageFile).toHaveBeenCalledTimes(8));
    for (let index = 4; index < 8; index += 1) {
      gates.get(`image-${index}.png`)!.resolve({
        ok: true,
        value: { dataUrl: "data:image/png;base64,aW1hZ2U=" }
      });
    }
    await result;

    expect(maxInFlight).toBe(4);
    expect(root.querySelectorAll("img")).toHaveLength(8);
  });
});
