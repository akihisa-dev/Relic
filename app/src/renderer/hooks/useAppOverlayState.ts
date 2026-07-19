import { useCallback, useState } from "react";

import type { AppLinkContextMenu } from "../appLinks";

export function useAppOverlayState() {
  const [linkContextMenu, setLinkContextMenu] = useState<AppLinkContextMenu | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const openQuickSwitcher = useCallback((): void => {
    setShowCommandPalette(false);
    setShowQuickSwitcher(true);
  }, []);

  return {
    linkContextMenu,
    openQuickSwitcher,
    setLinkContextMenu,
    setShowCommandPalette,
    setShowQuickSwitcher,
    showCommandPalette,
    showQuickSwitcher
  };
}
