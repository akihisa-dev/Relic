import { registerWorkspaceDataHandlers } from "./workspaceDataHandlers";
import { registerWorkspacePreferenceHandlers } from "./workspacePreferenceHandlers";
import { registerWorkspaceRegistrationHandlers } from "./workspaceRegistrationHandlers";

export { buildWorkspaceState } from "./workspaceState";

export function registerWorkspaceHandlers(): void {
  registerWorkspaceRegistrationHandlers();
  registerWorkspaceDataHandlers();
  registerWorkspacePreferenceHandlers();
}
