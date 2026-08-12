import { app } from "electron";

import type {
  WorkspaceAvailability,
  WorkspaceFileIndexEntry,
  WorkspaceReadArea,
  WorkspaceReadFailureKind,
  WorkspaceReadIssue,
  WorkspaceState
} from "../../shared/ipc";
import { redactSensitiveText } from "../../shared/securityRedaction";
import { readWorkspaceFileTree } from "../files/fileTree";
import {
  defaultWorkspaceFileIndexMaxSearchFileBytes
} from "../files/workspaceFileIndex";
import { workspaceDataProvider } from "../files/workspaceDataProvider";
import { finishPerformanceMeasure, startPerformanceMeasure } from "../files/performanceLog";
import { type AppSettings } from "../settings/appSettings";
import { readWorkspaceSettings } from "../settings/workspaceSettings";
import { toWorkspaceState } from "../workspace/workspaceService";

export async function buildWorkspaceState(
  settings: AppSettings
): Promise<WorkspaceState> {
  const startedAt = startPerformanceMeasure();
  const activeWorkspace =
    settings.workspaces.find((ws) => ws.id === settings.lastWorkspaceId) ?? null;

  if (!activeWorkspace) {
    finishPerformanceMeasure("buildWorkspaceState", startedAt, { activeWorkspace: false });
    return toWorkspaceState(settings);
  }

  const userDataPath = app.getPath("userData");
  const issues: WorkspaceReadIssue[] = [];
  const [fileTreeResult, workspaceSettingsResult] = await Promise.allSettled([
    readWorkspaceFileTree(activeWorkspace.path),
    readWorkspaceSettings(userDataPath, activeWorkspace.id)
  ]);
  const fileTree = fileTreeResult.status === "fulfilled" ? fileTreeResult.value : [];
  if (fileTreeResult.status === "rejected") {
    issues.push(workspaceReadIssue("file-tree", fileTreeResult.reason));
  }
  const pinnedPaths = workspaceSettingsResult.status === "fulfilled"
    ? workspaceSettingsResult.value.pinnedPaths
    : [];
  if (workspaceSettingsResult.status === "rejected") {
    issues.push(workspaceReadIssue("settings", workspaceSettingsResult.reason));
  }
  let fileIndexEntries: WorkspaceFileIndexEntry[] = [];

  if (fileTreeResult.status === "fulfilled") {
    try {
      const data = await workspaceDataProvider.get({
        fileTree,
        maxSearchFileBytes: defaultWorkspaceFileIndexMaxSearchFileBytes,
        userDataPath,
        workspaceId: activeWorkspace.id,
        workspacePath: activeWorkspace.path
      });
      const fileIndex = data.options.fileIndex;
      if (!fileIndex) {
        throw new Error("Workspace file index is unavailable.");
      }
      fileIndexEntries = fileIndex.entries;
    } catch (error) {
      issues.push(workspaceReadIssue("file-index", error));
    }
  }

  const availability = workspaceAvailability(issues);
  const workspaceState = {
    ...toWorkspaceState(settings, fileTree, pinnedPaths, fileIndexEntries),
    availability
  };
  finishPerformanceMeasure("buildWorkspaceState", startedAt, {
    activeWorkspace: true,
    fileIndexEntries: fileIndexEntries.length,
    readIssues: issues.length,
    fileTreeNodes: fileTree.length
  });
  return workspaceState;
}

export function workspaceReadIssue(
  area: WorkspaceReadArea,
  error: unknown
): WorkspaceReadIssue {
  return {
    area,
    details: redactSensitiveText(error instanceof Error ? error.message : String(error)),
    kind: workspaceReadFailureKind(error)
  };
}

function workspaceAvailability(issues: WorkspaceReadIssue[]): WorkspaceAvailability {
  const fileTreeUnavailable = issues.some((issue) => issue.area === "file-tree");
  return {
    fileOperationsAvailable: !fileTreeUnavailable,
    issues,
    status: fileTreeUnavailable
      ? "unavailable"
      : issues.length > 0
        ? "degraded"
        : "available"
  };
}

function workspaceReadFailureKind(error: unknown): WorkspaceReadFailureKind {
  if (error instanceof Error) {
    if (error.name === "CorruptWorkspaceSettingsError") return "corrupt";
    if (error.name === "UnsupportedWorkspaceSettingsVersionError") return "unsupported";
  }

  const code = errorCode(error);
  if (code === "ENOENT" || code === "ENOTDIR") return "missing";
  if (code === "EACCES" || code === "EPERM") return "permission";
  if (
    code === "EAGAIN" ||
    code === "EBUSY" ||
    code === "EIO" ||
    code === "ENXIO" ||
    code === "ETIMEDOUT"
  ) {
    return "temporary";
  }
  return "unknown";
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}
