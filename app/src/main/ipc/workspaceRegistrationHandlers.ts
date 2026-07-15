import { registerWorkspaceRegistrationMutationHandlers } from "./workspaceRegistrationMutationHandlers";
import { registerWorkspaceSelectionHandlers } from "./workspaceSelectionHandlers";
import { registerWorkspaceStateHandlers } from "./workspaceStateHandlers";

export function registerWorkspaceRegistrationHandlers(): void {
  registerWorkspaceStateHandlers();
  registerWorkspaceSelectionHandlers();
  registerWorkspaceRegistrationMutationHandlers();
}
