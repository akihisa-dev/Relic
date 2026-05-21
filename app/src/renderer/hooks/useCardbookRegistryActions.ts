import { useCallback, useState } from "react";

import type { CardbookCardActionsContext } from "./cardbookCardActionTypes";

type CardbookRegistryInput = Pick<
  CardbookCardActionsContext,
  "closeAllTabs" | "setCardbookError" | "setCardbookState"
>;

export function useCardbookRegistryActions({
  closeAllTabs,
  setCardbookError,
  setCardbookState
}: CardbookRegistryInput) {
  const [isOpeningCardbook, setIsOpeningCardbook] = useState(false);
  const [isCreatingCardbook, setIsCreatingCardbook] = useState(false);

  const handleOpenCardbook = useCallback((): void => {
    if (!window.relic) return;

    setIsOpeningCardbook(true);
    setCardbookError(null);

    void window.relic
      .openCardbook()
      .then((result) => {
        if (result.ok) {
          setCardbookState(result.value);
        } else {
          setCardbookError(result.error.message);
        }
      })
      .finally(() => setIsOpeningCardbook(false));
  }, [setCardbookError, setCardbookState]);

  const handleCreateNewCardbook = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingCardbook(true);
    setCardbookError(null);

    void window.relic
      .createNewCardbook()
      .then((result) => {
        if (result.ok) {
          setCardbookState(result.value);
        } else {
          setCardbookError(result.error.message);
        }
      })
      .finally(() => setIsCreatingCardbook(false));
  }, [setCardbookError, setCardbookState]);

  const handleSwitchCardbook = useCallback((cardbookId: string): void => {
    if (!window.relic) return;

    void window.relic.switchCardbook({ cardbookId }).then((result) => {
      if (result.ok) {
        setCardbookState(result.value);
        closeAllTabs();
      } else {
        setCardbookError(result.error.message);
      }
    });
  }, [closeAllTabs, setCardbookError, setCardbookState]);

  const handleRemoveCardbook = useCallback((cardbookId: string): void => {
    if (!window.relic) return;

    void window.relic.removeCardbook({ cardbookId }).then((result) => {
      if (result.ok) {
        setCardbookState(result.value);
        closeAllTabs();
      } else {
        setCardbookError(result.error.message);
      }
    });
  }, [closeAllTabs, setCardbookError, setCardbookState]);

  const handleRenameCardbook = useCallback(async (cardbookId: string, name: string): Promise<boolean> => {
    if (!window.relic) return false;

    const result = await window.relic.renameCardbook({ name, cardbookId });
    if (result.ok) {
      setCardbookState(result.value);
      return true;
    }

    setCardbookError(result.error.message);
    return false;
  }, [setCardbookError, setCardbookState]);

  const handleRefreshCardbookState = useCallback((): void => {
    void window.relic?.getCardbookState().then((result) => {
      if (result.ok) setCardbookState(result.value);
    });
  }, [setCardbookState]);

  const handleTogglePin = useCallback((path: string): void => {
    if (!window.relic) return;

    void window.relic.togglePin(path).then((result) => {
      if (result.ok) setCardbookState(result.value);
      else setCardbookError(result.error.message);
    });
  }, [setCardbookError, setCardbookState]);

  return {
    handleCreateNewCardbook,
    handleOpenCardbook,
    handleRefreshCardbookState,
    handleRemoveCardbook,
    handleRenameCardbook,
    handleSwitchCardbook,
    handleTogglePin,
    isCreatingCardbook,
    isOpeningCardbook
  };
}
