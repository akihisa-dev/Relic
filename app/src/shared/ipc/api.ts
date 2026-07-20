import type { EditorApi } from "./editor";
import { editorIpcContract } from "./editor";
import type { FilesApi } from "./files";
import { filesIpcContract } from "./files";
import type { OutputApi } from "./output";
import { outputIpcContract } from "./output";
import type { SearchApi } from "./search";
import { searchIpcContract } from "./search";
import type { SettingsApi } from "./settings";
import { settingsIpcContract } from "./settings";
import type { ToolsApi } from "./tools";
import { toolsIpcContract } from "./tools";
import type { WorkspaceApi } from "./workspace";
import { workspaceIpcContract } from "./workspace";

export const relicApiContractVersion = 3;

export interface RelicApi
  extends WorkspaceApi,
    FilesApi,
    SearchApi,
    SettingsApi,
    EditorApi,
    OutputApi,
    ToolsApi {
  apiContractVersion: typeof relicApiContractVersion;
}

export const relicIpcContract = {
  ...workspaceIpcContract,
  ...filesIpcContract,
  ...searchIpcContract,
  ...settingsIpcContract,
  ...editorIpcContract,
  ...outputIpcContract,
  ...toolsIpcContract
} as const;
