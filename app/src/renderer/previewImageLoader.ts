import { relicClient } from "./relicClient";
import {
  maxPreviewImageAggregateBytes,
  maxPreviewImageCount,
  maxPreviewImageDataUrlBytes
} from "../shared/ipc/output";
import { runWithConcurrency } from "./concurrency";

const previewImagePathAttribute = "data-relic-image-path";
const supportedImageDataUrlPattern = /^data:image\/(?:avif|bmp|gif|jpeg|png|svg\+xml|webp);base64,[a-z0-9+/]*={0,2}$/i;

let activeContextKey = "";
let activeGeneration = 0;
const successfulImages = new Map<string, string>();
const pendingImages = new Map<string, Promise<string | null>>();
const maxConcurrentPreviewImages = 4;

export function previewImageContextKey(workspacePath: string | null | undefined, revision = 0): string {
  return `${workspacePath?.trim() ?? ""}\0${revision}`;
}

export function activatePreviewImageContext(contextKey: string): void {
  if (contextKey === activeContextKey) return;
  activeContextKey = contextKey;
  activeGeneration += 1;
  successfulImages.clear();
  pendingImages.clear();
}

export function loadPreviewImage(path: string, contextKey: string): Promise<string | null> {
  activatePreviewImageContext(contextKey);
  const cached = successfulImages.get(path);
  if (cached) return Promise.resolve(cached);

  const pending = pendingImages.get(path);
  if (pending) return pending;

  const generation = activeGeneration;
  const request = relicClient.current?.readImageFile({ path })
    .then((result) => {
      if (generation !== activeGeneration || contextKey !== activeContextKey) return null;
      if (
        !result.ok ||
        !supportedImageDataUrlPattern.test(result.value.dataUrl) ||
        new Blob([result.value.dataUrl]).size > maxPreviewImageDataUrlBytes
      ) return null;
      successfulImages.set(path, result.value.dataUrl);
      return result.value.dataUrl;
    })
    .catch(() => null)
    .finally(() => {
      if (pendingImages.get(path) === request) pendingImages.delete(path);
    }) ?? Promise.resolve(null);

  pendingImages.set(path, request);
  return request;
}

export function hydratePreviewImages(root: ParentNode, contextKey: string): () => void {
  let active = true;
  void resolvePreviewImages(root, contextKey, () => active);
  return () => {
    active = false;
  };
}

export async function resolvePreviewImages(
  root: ParentNode,
  contextKey: string,
  isActive: () => boolean = () => true,
  options: { rejectOnLimit?: boolean } = {}
): Promise<void> {
  activatePreviewImageContext(contextKey);
  const placeholders = Array.from(root.querySelectorAll<HTMLElement>(`[${previewImagePathAttribute}]`));
  const placeholdersByPath = new Map<string, HTMLElement[]>();
  for (const placeholder of placeholders) {
    const path = placeholder.getAttribute(previewImagePathAttribute);
    if (!path) continue;
    const entries = placeholdersByPath.get(path) ?? [];
    entries.push(placeholder);
    placeholdersByPath.set(path, entries);
  }
  const paths = [...placeholdersByPath.keys()];
  if (paths.length > maxPreviewImageCount) {
    if (options.rejectOnLimit) {
      throw new Error("画像が多すぎるためプレビューを生成できません。");
    }
    paths.splice(maxPreviewImageCount);
  }

  let aggregateBytes = 0;
  const loaded = await runWithConcurrency(
    paths.map((path) => async () => {
      const dataUrl = await loadPreviewImage(path, contextKey);
      if (!dataUrl) return { dataUrl: null, path };
      const bytes = new Blob([dataUrl]).size;
      if (aggregateBytes + bytes > maxPreviewImageAggregateBytes) return { dataUrl: null, path };
      aggregateBytes += bytes;
      return { dataUrl, path };
    }),
    maxConcurrentPreviewImages
  );

  for (const { dataUrl, path } of loaded) {
    if (!dataUrl || !isActive() || contextKey !== activeContextKey) continue;
    for (const placeholder of placeholdersByPath.get(path) ?? []) {
      if (placeholder.getAttribute(previewImagePathAttribute) !== path) continue;
      const image = document.createElement("img");
      image.alt = placeholder.dataset.relicImageAlt ?? placeholder.textContent ?? "";
      image.className = placeholder.dataset.relicImageClass ?? "preview-image";
      image.src = dataUrl;
      if (placeholder.title) image.title = placeholder.title;
      placeholder.replaceWith(image);
    }
  }
}

/** @internal Test-only reset for module cache isolation. */
export function __resetPreviewImageLoaderForTests(): void {
  activeContextKey = "";
  activeGeneration += 1;
  successfulImages.clear();
  pendingImages.clear();
}
