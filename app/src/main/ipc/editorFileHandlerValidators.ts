import type {
  ReadFileRecoverySnapshotInput,
  WriteMarkdownFileInput
} from "../../shared/ipc";
import { maxMarkdownWriteBytes } from "../../shared/ipc/editor";
import {
  isInputRecord,
  isLimitedWorkspaceRelativeInputPath,
  isPathInput,
  isWithinUtf8ByteLength
} from "./inputValidation";

export function isReadFileRecoverySnapshotInput(
  input: unknown
): input is ReadFileRecoverySnapshotInput {
  const candidate = input as { snapshotId?: unknown };
  return (
    isPathInput(input) &&
    typeof candidate.snapshotId === "string" &&
    /^[0-9T-Za-z-]+-[a-f0-9]{12}\.json$/.test(candidate.snapshotId)
  );
}

export function isWriteMarkdownFileInput(
  input: unknown
): input is WriteMarkdownFileInput {
  return (
    isInputRecord(input) &&
    "path" in input &&
    "content" in input &&
    isLimitedWorkspaceRelativeInputPath(input.path) &&
    typeof input.content === "string" &&
    isWithinUtf8ByteLength(input.content, maxMarkdownWriteBytes) &&
    (
      !("expectedContent" in input) ||
      (
        typeof input.expectedContent === "string" &&
        isWithinUtf8ByteLength(input.expectedContent, maxMarkdownWriteBytes)
      )
    )
  );
}
