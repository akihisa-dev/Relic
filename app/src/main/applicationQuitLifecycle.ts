interface QuitEvent {
  preventDefault(): void;
}

interface QuitLifecycleApp {
  on(event: "will-quit", listener: (event: QuitEvent) => void): void;
  quit(): void;
}

interface ApplicationQuitLifecycleOptions {
  app: QuitLifecycleApp;
  isImmediateQuitBypassed: () => boolean;
  stopAcceptingRequestsAndWait: () => Promise<void>;
  stopWorkspaceWatcher: () => void;
}

/**
 * Defers process termination until every window has approved closing and all
 * invoke-style Main work that was already accepted has settled.
 */
export function configureApplicationQuitLifecycle({
  app,
  isImmediateQuitBypassed,
  stopAcceptingRequestsAndWait,
  stopWorkspaceWatcher
}: ApplicationQuitLifecycleOptions): void {
  let finalQuitInProgress = false;
  let drainInProgress: Promise<void> | null = null;

  app.on("will-quit", (event) => {
    if (finalQuitInProgress) return;

    if (isImmediateQuitBypassed()) {
      stopWorkspaceWatcher();
      return;
    }

    event.preventDefault();
    if (drainInProgress) return;

    drainInProgress = (async () => {
      await stopAcceptingRequestsAndWait();
      stopWorkspaceWatcher();
      finalQuitInProgress = true;
      app.quit();
    })();

    void drainInProgress.catch((error: unknown) => {
      drainInProgress = null;
      console.error("Application shutdown drain failed.", error);
    });
  });
}
