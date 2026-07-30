import type {
  RefreshWorkspaceInput,
  RenameWorkspaceInput,
  SwitchWorkspaceInput
} from "../../shared/ipc";
import { isWorkspaceIdInput } from "./inputValidation";

export function isSwitchWorkspaceInput(input: unknown): input is SwitchWorkspaceInput {
  return isWorkspaceIdInput(input);
}

export function isRefreshWorkspaceInput(input: unknown): input is RefreshWorkspaceInput {
  return isWorkspaceIdInput(input);
}

export function isRenameWorkspaceInput(input: unknown): input is RenameWorkspaceInput {
  return (
    isWorkspaceIdInput(input) &&
    "workspaceId" in input &&
    "name" in input &&
    typeof input.name === "string"
  );
}
