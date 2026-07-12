import { useCallback, useEffect, useRef, useState } from "react";

import { useLatest } from "./useLatest";

export function useAutoSave(
  content: string,
  path: string | null,
  enabled: boolean,
  onSaved?: (path: string) => void,
  onSaveError?: (message: string) => void
): { isSaving: boolean } {
  const [isSaving, setIsSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const latestContentRef = useLatest(content);
  const latestPathRef = useLatest(path);
  const enabledRef = useLatest(enabled);
  const mountedRef = useRef(true);
  const onSavedRef = useLatest(onSaved);
  const onSaveErrorRef = useLatest(onSaveError);

  const startSave = useCallback((saveContent: string, savePath: string): void => {
    if (!window.relic) return;

    isSavingRef.current = true;
    pendingSaveRef.current = false;
    if (mountedRef.current) setIsSaving(true);

    void window.relic.writeMarkdownFile({ content: saveContent, path: savePath })
      .then((result) => {
        const isLatestSavedContent =
          enabledRef.current &&
          latestPathRef.current === savePath &&
          latestContentRef.current === saveContent;

        if (result.ok) {
          if (isLatestSavedContent) onSavedRef.current?.(savePath);
          return;
        }

        if (enabledRef.current && latestPathRef.current === savePath) {
          onSaveErrorRef.current?.(result.error.message);
        }
      })
      .catch((error) => {
        if (enabledRef.current && latestPathRef.current === savePath) {
          onSaveErrorRef.current?.(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        isSavingRef.current = false;
        if (mountedRef.current) setIsSaving(false);

        if (!mountedRef.current || !pendingSaveRef.current || !enabledRef.current || !latestPathRef.current || !window.relic) return;

        startSave(latestContentRef.current, latestPathRef.current);
      });
  }, [enabledRef, latestContentRef, latestPathRef, mountedRef, onSaveErrorRef, onSavedRef]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !path || !window.relic) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;

      startSave(latestContentRef.current, path);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, path, enabled, startSave]);

  return { isSaving };
}
