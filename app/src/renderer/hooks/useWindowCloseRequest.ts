import { relicClient } from "../relicClient";
import { useEffect } from "react";

export function useWindowCloseRequest(ensureCanCloseAllTabs: () => Promise<boolean> | boolean): void {
  useEffect(() => {
    if (!relicClient.current?.onWindowCloseRequested) return undefined;

    return relicClient.current.onWindowCloseRequested((event) => {
      void Promise.resolve(ensureCanCloseAllTabs())
        .then((ok) => {
          relicClient.current?.respondToWindowCloseRequest({ ok, requestId: event.requestId });
        })
        .catch(() => {
          relicClient.current?.respondToWindowCloseRequest({ ok: false, requestId: event.requestId });
        });
    });
  }, [ensureCanCloseAllTabs]);
}
