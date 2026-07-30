import { contextBridge } from "electron";

import { editorApiFragment } from "./api/editor";
import { filesApiFragment } from "./api/files";
import { outputApiFragment } from "./api/output";
import { searchApiFragment } from "./api/search";
import { settingsApiFragment } from "./api/settings";
import { toolsApiFragment } from "./api/tools";
import { workspaceApiFragment } from "./api/workspace";
import { relicApiContractVersion, type RelicApi } from "../shared/ipc";

const relicApi: RelicApi = {
  apiContractVersion: relicApiContractVersion,
  ...workspaceApiFragment,
  ...filesApiFragment,
  ...searchApiFragment,
  ...settingsApiFragment,
  ...editorApiFragment,
  ...outputApiFragment,
  ...toolsApiFragment
};

contextBridge.exposeInMainWorld("relic", relicApi);
