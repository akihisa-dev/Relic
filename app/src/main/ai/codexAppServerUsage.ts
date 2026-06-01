import type { AIWorkspaceUsageState, AIWorkspaceUsageWindow } from "../../shared/ipc";
import type { CodexRateLimitWindow, CodexRateLimitsResponse } from "./codexAppServerTypes";

export function toAIWorkspaceUsageState(response: CodexRateLimitsResponse): AIWorkspaceUsageState | null {
  const snapshot = response.rateLimitsByLimitId?.codex ?? response.rateLimits;
  if (!snapshot) return null;

  return {
    planType: typeof snapshot.planType === "string" ? snapshot.planType : null,
    primary: toAIWorkspaceUsageWindow(snapshot.primary),
    readAt: new Date().toISOString(),
    secondary: toAIWorkspaceUsageWindow(snapshot.secondary)
  };
}

function toAIWorkspaceUsageWindow(window: CodexRateLimitWindow | null | undefined): AIWorkspaceUsageWindow | null {
  if (!window || typeof window.usedPercent !== "number") return null;
  const usedPercent = clampPercent(window.usedPercent);

  return {
    remainingPercent: clampPercent(100 - usedPercent),
    resetsAt: typeof window.resetsAt === "number" ? new Date(window.resetsAt * 1000).toISOString() : null,
    usedPercent,
    windowDurationMins: typeof window.windowDurationMins === "number" ? window.windowDurationMins : null
  };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
