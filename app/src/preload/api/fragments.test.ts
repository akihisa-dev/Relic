import { describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  getPathForFile: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  send: vi.fn()
}));

vi.mock("electron", () => ({
  ipcRenderer: {
    invoke: electronMock.invoke,
    on: electronMock.on,
    removeListener: electronMock.removeListener,
    send: electronMock.send
  },
  webUtils: {
    getPathForFile: electronMock.getPathForFile
  }
}));

import { editorIpcContract } from "../../shared/ipc/editor";
import { filesIpcContract } from "../../shared/ipc/files";
import { outputIpcContract } from "../../shared/ipc/output";
import { searchIpcContract } from "../../shared/ipc/search";
import { settingsIpcContract } from "../../shared/ipc/settings";
import { toolsIpcContract } from "../../shared/ipc/tools";
import { workspaceIpcContract } from "../../shared/ipc/workspace";
import { editorApiFragment } from "./editor";
import { filesApiFragment } from "./files";
import { outputApiFragment } from "./output";
import { searchApiFragment } from "./search";
import { settingsApiFragment } from "./settings";
import { toolsApiFragment } from "./tools";
import { workspaceApiFragment } from "./workspace";

describe("preload API fragments", () => {
  it.each([
    ["workspace", workspaceApiFragment, workspaceIpcContract],
    ["files", filesApiFragment, filesIpcContract],
    ["search", searchApiFragment, searchIpcContract],
    ["settings", settingsApiFragment, settingsIpcContract],
    ["editor", editorApiFragment, editorIpcContract],
    ["output", outputApiFragment, outputIpcContract],
    ["tools", toolsApiFragment, toolsIpcContract]
  ])("%s fragmentは対応する共有契約のメソッドだけを所有する", (_name, fragment, contract) => {
    expect(Object.keys(fragment).sort()).toEqual(Object.keys(contract).sort());
  });
});
