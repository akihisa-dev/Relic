import { useEffect, useRef } from "react";

export function useAutoSave(
  content: string,
  path: string | null,
  enabled: boolean
): { isSaving: boolean } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !path || !window.relic) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      isSavingRef.current = true;

      void window.relic!.writeMarkdownFile({ content, path }).finally(() => {
        isSavingRef.current = false;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, path, enabled]);

  return { isSaving: isSavingRef.current };
}
