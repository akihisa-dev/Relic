import { beforeEach, describe, expect, it, vi } from "vitest";

const outputHandlerMocks = vi.hoisted(() => ({
  copyDiagramSvg: vi.fn(),
  handleLocalizedIpc: vi.fn(),
  saveDiagramSvg: vi.fn(),
  savePreviewAsPdf: vi.fn()
}));

vi.mock("./diagramOutputHandlers", () => ({
  copyDiagramSvg: outputHandlerMocks.copyDiagramSvg,
  saveDiagramSvg: outputHandlerMocks.saveDiagramSvg
}));

vi.mock("./localizedIpcHandler", () => ({
  handleLocalizedIpc: outputHandlerMocks.handleLocalizedIpc
}));

vi.mock("./previewPdfHandler", () => ({
  savePreviewAsPdf: outputHandlerMocks.savePreviewAsPdf
}));

import {
  copyDiagramSvgChannel,
  saveDiagramSvgChannel,
  savePreviewAsPdfChannel
} from "../../shared/ipc";
import { registerOutputHandlers } from "./outputHandlers";

describe("registerOutputHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("各出力channelを対応する責務別handlerへ登録する", () => {
    registerOutputHandlers();

    expect(outputHandlerMocks.handleLocalizedIpc.mock.calls).toEqual([
      [savePreviewAsPdfChannel, outputHandlerMocks.savePreviewAsPdf],
      [saveDiagramSvgChannel, outputHandlerMocks.saveDiagramSvg],
      [copyDiagramSvgChannel, outputHandlerMocks.copyDiagramSvg]
    ]);
  });
});
