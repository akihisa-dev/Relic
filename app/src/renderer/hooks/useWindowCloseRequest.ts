import { useEffect } from "react";

export function useWindowCloseRequest(ensureCanCloseAllTabs: () => Promise<boolean> | boolean): void {
  useEffect(() => {
    if (!window.relic?.onWindowCloseRequested) return undefined;

    return window.relic.onWindowCloseRequested((event) => {
      void Promise.resolve(ensureCanCloseAllTabs())
        .then((ok) => {
          window.relic?.respondToWindowCloseRequest({ ok, requestId: event.requestId });
        })
        .catch(() => {
          window.relic?.respondToWindowCloseRequest({ ok: false, requestId: event.requestId });
        });
    });
  }, [ensureCanCloseAllTabs]);
}
