import { relicClient } from "./relicClient";

const previewImagePathAttribute = "data-relic-image-path";
const supportedImageDataUrlPattern = /^data:image\/(?:avif|bmp|gif|jpeg|png|svg\+xml|webp);base64,[a-z0-9+/]*={0,2}$/i;

let activeContextKey = "";
let activeGeneration = 0;
const successfulImages = new Map<string, string>();
const pendingImages = new Map<string, Promise<string | null>>();

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
      if (!result.ok || !supportedImageDataUrlPattern.test(result.value.dataUrl)) return null;
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
  isActive: () => boolean = () => true
): Promise<void> {
  activatePreviewImageContext(contextKey);
  const placeholders = Array.from(root.querySelectorAll<HTMLElement>(`[${previewImagePathAttribute}]`));

  await Promise.all(placeholders.map(async (placeholder) => {
    const path = placeholder.getAttribute(previewImagePathAttribute);
    if (!path) return;
    const dataUrl = await loadPreviewImage(path, contextKey);
    if (!dataUrl || !isActive() || contextKey !== activeContextKey || placeholder.getAttribute(previewImagePathAttribute) !== path) {
      return;
    }

    const image = document.createElement("img");
    image.alt = placeholder.dataset.relicImageAlt ?? placeholder.textContent ?? "";
    image.className = placeholder.dataset.relicImageClass ?? "preview-image";
    image.src = dataUrl;
    if (placeholder.title) image.title = placeholder.title;
    placeholder.replaceWith(image);
  }));
}

/** @internal Test-only reset for module cache isolation. */
export function __resetPreviewImageLoaderForTests(): void {
  activeContextKey = "";
  activeGeneration += 1;
  successfulImages.clear();
  pendingImages.clear();
}
