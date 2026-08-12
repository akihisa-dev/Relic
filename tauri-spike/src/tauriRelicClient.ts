import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { RelicApi, WorkspaceState, MarkdownFileContent, WorkspaceWatcherStatusEvent, WorkspaceChangedEvent } from "@relic-app/shared/ipc";
import type { RelicResult } from "@relic-app/shared/result";

type RawWatcherStatus = { workspaceId: string; status: string; changedAt: string };
type RawWorkspaceChanged = { workspaceId: string; changedAt: string };

const unsupported = async <T>(operation: string): Promise<RelicResult<T>> => ({
  ok: false,
  error: {
    code: "TAURI_SPIKE_UNSUPPORTED",
    message: `${operation} is not implemented in the Tauri 2 spike.`
  }
});

async function command<T>(name: string, args?: Parameters<typeof invoke>[1]): Promise<RelicResult<T>> {
  try {
    return await invoke<RelicResult<T>>(name, args);
  } catch (error) {
    return {
      ok: false,
      error: { code: "TAURI_SPIKE_COMMAND_FAILED", message: String(error) }
    };
  }
}

function subscription<T>(name: string, callback: (value: T) => void): () => void {
  let unlisten: UnlistenFn | undefined;
  let cancelled = false;
  void listen<T>(name, (event) => callback(event.payload)).then((stop) => {
    if (cancelled) {
      void stop();
    } else {
      unlisten = stop;
    }
  });
  return () => {
    cancelled = true;
    void unlisten?.();
    unlisten = undefined;
  };
}

function watcherStatusSubscription(callback: (value: WorkspaceWatcherStatusEvent) => void): () => void {
  return subscription<RawWatcherStatus>("workspace_watch_status", (event) => {
    if (event.status !== "error") return;
    callback({ workspaceId: event.workspaceId, changedAt: event.changedAt, status: "unavailable" });
  });
}

const implementations: Partial<RelicApi> = {
  apiContractVersion: 7,
  getWorkspaceState: () => command<WorkspaceState>("workspace_get_state"),
  openWorkspace: () => unsupported("openWorkspace (use workspace_set_path in the spike harness)"),
  refreshWorkspace: (input) => command("workspace_refresh", input as unknown as Record<string, unknown>),
  switchWorkspace: () => unsupported("switchWorkspace (logical workspace registry is not implemented)"),
  readMarkdownFile: (input) => command<MarkdownFileContent>("file_read_markdown", input as unknown as Record<string, unknown>),
  writeMarkdownFile: (input) => command("file_write_markdown", {
    path: input.path,
    content: input.content,
    expectedContent: input.expectedContent
  }),
  savePreviewAsPdf: () => unsupported("savePreviewAsPdf"),
  onWorkspaceChanged: (callback: (event: WorkspaceChangedEvent) => void) => subscription<RawWorkspaceChanged>("workspace_changed", (event) => {
    callback({ workspaceId: event.workspaceId, changedAt: event.changedAt });
  }),
  onWorkspaceWatcherStatus: (callback) => watcherStatusSubscription(callback)
};

export const tauriRelicClient = new Proxy(implementations as RelicApi, {
  get(target, property: string | symbol): unknown {
    if (property in target) return target[property as keyof RelicApi];
    if (property === "getDroppedFilePath") return (file: File) => (file as File & { path?: string }).path ?? "";
    if (property === "startWorkspaceFileDrag" || property === "updateApplicationMenuState" || property === "respondToWindowCloseRequest") {
      return () => unsupported(property.toString());
    }
    if (typeof property === "string" && property.startsWith("on")) return () => () => unsupported(property);
    return (..._args: unknown[]) => unsupported(property.toString());
  }
});
