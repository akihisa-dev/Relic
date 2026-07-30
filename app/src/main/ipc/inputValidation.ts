import { maxWorkspaceRelativePathLength } from "../../shared/ipc/files";
import {
  isWorkspaceRelativeInputPath,
  isWorkspaceRelativeInputPathOrRoot
} from "../files/paths";

const workspaceIdPattern = /^[A-Za-z0-9_-]+$/;

export function isInputRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

export function isNameInput(input: unknown): input is { name: string } {
  return (
    isInputRecord(input) &&
    "name" in input &&
    typeof input.name === "string"
  );
}

export function isPathInput(input: unknown): input is { path: string } {
  return (
    isInputRecord(input) &&
    "path" in input &&
    isLimitedWorkspaceRelativeInputPath(input.path)
  );
}

export function isPathOrRootInput(input: unknown): input is { path: string } {
  return (
    isInputRecord(input) &&
    "path" in input &&
    isLimitedWorkspaceRelativeInputPathOrRoot(input.path)
  );
}

export function isLimitedWorkspaceRelativeInputPath(input: unknown): input is string {
  return typeof input === "string" &&
    input.length <= maxWorkspaceRelativePathLength &&
    isWorkspaceRelativeInputPath(input);
}

export function isLimitedWorkspaceRelativeInputPathOrRoot(input: unknown): input is string {
  return typeof input === "string" &&
    input.length <= maxWorkspaceRelativePathLength &&
    isWorkspaceRelativeInputPathOrRoot(input);
}

export function isWithinUtf8ByteLength(value: string, maxBytes: number): boolean {
  return Buffer.byteLength(value, "utf8") <= maxBytes;
}

export function isWorkspaceIdInput(input: unknown): input is { workspaceId: string } {
  const workspaceId = (input as { workspaceId?: unknown })?.workspaceId;

  return (
    isInputRecord(input) &&
    "workspaceId" in input &&
    typeof workspaceId === "string" &&
    workspaceId.trim() === workspaceId &&
    workspaceIdPattern.test(workspaceId)
  );
}
