import { useEffect } from "react";

import type { ApplicationMenuState } from "../../shared/ipc";
import type { AppCommandActions } from "../appCommandActions";
import { relicClient } from "../relicClient";

interface UseApplicationMenuInput {
  actions: AppCommandActions;
  state: ApplicationMenuState;
}

export function useApplicationMenu({ actions, state }: UseApplicationMenuInput): void {
  useEffect(() => {
    const api = relicClient.current;
    if (!api) return;

    return api.onApplicationMenuCommand?.((command) => actions[command]());
  }, [actions]);

  useEffect(() => {
    relicClient.current?.updateApplicationMenuState?.(state);
  }, [state]);
}
