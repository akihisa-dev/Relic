import { useCallback, useEffect, useRef, useState } from "react";

export function useSplitCloseMotion(
  isSplit: boolean,
  toggleSplit: () => void
): {
  isSplitClosing: boolean;
  toggleSplitWithMotion: () => void;
} {
  const splitCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSplitClosing, setIsSplitClosing] = useState(false);

  const toggleSplitWithMotion = useCallback((): void => {
    if (!isSplit) {
      if (splitCloseTimerRef.current) clearTimeout(splitCloseTimerRef.current);
      setIsSplitClosing(false);
      toggleSplit();
      return;
    }

    if (isSplitClosing) return;

    setIsSplitClosing(true);
    splitCloseTimerRef.current = setTimeout(() => {
      toggleSplit();
      setIsSplitClosing(false);
      splitCloseTimerRef.current = null;
    }, 210);
  }, [isSplit, isSplitClosing, toggleSplit]);

  useEffect(() => {
    return () => {
      if (splitCloseTimerRef.current) clearTimeout(splitCloseTimerRef.current);
    };
  }, []);

  return { isSplitClosing, toggleSplitWithMotion };
}
