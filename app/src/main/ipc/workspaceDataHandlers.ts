import { registerWorkspaceIndexDataHandlers } from "./workspaceIndexDataHandlers";
import { registerWorkspacePreferenceDataHandlers } from "./workspacePreferenceDataHandlers";
import { registerWorkspaceVisualizationDataHandlers } from "./workspaceVisualizationDataHandlers";

export function registerWorkspaceDataHandlers(): void {
  registerWorkspaceIndexDataHandlers();
  registerWorkspaceVisualizationDataHandlers();
  registerWorkspacePreferenceDataHandlers();
}
