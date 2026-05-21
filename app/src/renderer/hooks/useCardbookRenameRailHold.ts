import { useCallback, useEffect, useRef, useState } from "react";

export function useCardbookRenameRailHold(): {
  holdCardbookRailAfterRename: () => void;
  isCardbookRenameActive: boolean;
  isCardbookRenameHoldingRail: boolean;
  setIsCardbookRenameActive: (isActive: boolean) => void;
} {
  const [isCardbookRenameActive, setIsCardbookRenameActive] = useState(false);
  const [isCardbookRenameHoldingRail, setIsCardbookRenameHoldingRail] = useState(false);
  const cardbookRenameHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holdCardbookRailAfterRename = useCallback((): void => {
    if (cardbookRenameHoldTimerRef.current) clearTimeout(cardbookRenameHoldTimerRef.current);
    setIsCardbookRenameHoldingRail(true);
    cardbookRenameHoldTimerRef.current = setTimeout(() => {
      setIsCardbookRenameHoldingRail(false);
      cardbookRenameHoldTimerRef.current = null;
    }, 900);
  }, []);

  useEffect(() => {
    return () => {
      if (cardbookRenameHoldTimerRef.current) clearTimeout(cardbookRenameHoldTimerRef.current);
    };
  }, []);

  return {
    holdCardbookRailAfterRename,
    isCardbookRenameActive,
    isCardbookRenameHoldingRail,
    setIsCardbookRenameActive
  };
}
