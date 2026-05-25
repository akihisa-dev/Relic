import { useEffect, useRef, useState } from "react";

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
  const latestContentRef = useRef(content);
  const latestPathRef = useRef(path);
  const enabledRef = useRef(enabled);
  const mountedRef = useRef(true);
  const onSavedRef = useRef(onSaved);
  const onSaveErrorRef = useRef(onSaveError);
  const startSaveRef = useRef<(saveContent: string, savePath: string) => void>(() => undefined);

  onSavedRef.current = onSaved;
  onSaveErrorRef.current = onSaveError;
  latestContentRef.current = content;
  latestPathRef.current = path;
  enabledRef.current = enabled;

  startSaveRef.current = (saveContent: string, savePath: string): void => {
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

        startSaveRef.current(latestContentRef.current, latestPathRef.current);
      });
  };

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

      startSaveRef.current(latestContentRef.current, path);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, path, enabled]);

  return { isSaving };
}
