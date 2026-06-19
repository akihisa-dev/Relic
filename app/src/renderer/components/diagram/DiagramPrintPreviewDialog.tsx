import {
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  defaultRelicDiagramPrintSettings,
  relicDiagramPaperSizes,
  relicDiagramPrintMarginPresets,
  relicDiagramPrintOrientations,
  relicDiagramPrintScaleModes,
  updateRelicDiagramPrintSettings,
  type RelicDiagramPrintSettings
} from "../../../shared/diagramMarkdown";
import type { OutputPrintOptions } from "../../../shared/ipcOutput";
import { buildPreviewOutputHtml } from "../../outputHtml";
import { useT } from "../../i18n";
import { DiagramActionIcon } from "./DiagramActionIcon";

interface DiagramPrintPreviewPayload {
  defaultFileName: string;
  html: string;
  printOptions?: OutputPrintOptions;
  title: string;
}

export interface DiagramPrintPreviewDialogProps {
  content: string;
  fileName: string;
  initialSettings: RelicDiagramPrintSettings | undefined;
  onApplySettings: (settings: RelicDiagramPrintSettings) => boolean;
  onClose: () => void;
  onEditPrintArea: () => void;
}

export function DiagramPrintPreviewDialog({
  content,
  fileName,
  initialSettings,
  onApplySettings,
  onClose,
  onEditPrintArea
}: DiagramPrintPreviewDialogProps): ReactElement {
  const t = useT();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [draftSettings, setDraftSettings] = useState<RelicDiagramPrintSettings>(initialSettings ?? defaultRelicDiagramPrintSettings);
  const [isRendering, setRendering] = useState(true);
  const [payload, setPayload] = useState<DiagramPrintPreviewPayload | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const draftContent = useMemo(() => {
    const updated = updateRelicDiagramPrintSettings(content, draftSettings);
    if (!updated.ok) throw new Error(updated.error.message);
    return updated.value.content;
  }, [content, draftSettings]);

  useEffect(() => {
    let isCurrent = true;
    setRendering(true);
    setPreviewError(null);

    buildPreviewOutputHtml({
      content: draftContent,
      fileName,
      t,
      title: fileName
    }).then((nextPayload) => {
      if (!isCurrent) return;
      setPayload(nextPayload);
      setRendering(false);
    }).catch((error) => {
      if (!isCurrent) return;
      setPayload(null);
      setPreviewError(error instanceof Error ? error.message : String(error));
      setRendering(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [draftContent, fileName, t]);

  const applyDraftSettings = (): boolean => {
    const applied = onApplySettings(draftSettings);
    if (applied) setStatus(t("diagram.printPreviewApplied"));
    return applied;
  };
  const savePdf = async (): Promise<void> => {
    if (!payload || !window.relic) return;
    if (!applyDraftSettings()) return;

    const result = await window.relic.savePreviewAsPdf(payload);
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setStatus(result.value.status === "saved" ? t("output.pdfSaved") : t("output.printDialogCanceled"));
  };
  const printPreviewFrame = (): void => {
    if (!payload || !frameRef.current?.contentWindow) return;
    if (!applyDraftSettings()) return;

    frameRef.current.contentWindow.focus();
    frameRef.current.contentWindow.print();
    setStatus(t("output.printed"));
  };

  return (
    <div className="diagram-print-preview-dialog-backdrop" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }}>
      <div aria-label={t("diagram.printPreviewDialog")} aria-modal="true" className="diagram-print-preview-dialog" role="dialog">
        <header className="diagram-print-preview-dialog-header">
          <h2>{t("diagram.printPreviewDialog")}</h2>
          <div className="diagram-print-preview-dialog-actions">
            <button aria-label={t("diagram.zoomOut")} onClick={() => setZoom((current) => Math.max(0.35, current - 0.1))} type="button">
              <DiagramActionIcon name="zoomOut" />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button aria-label={t("diagram.zoomIn")} onClick={() => setZoom((current) => Math.min(2, current + 0.1))} type="button">
              <DiagramActionIcon name="zoomIn" />
            </button>
            <button aria-label={t("output.printDialogClose")} onClick={onClose} type="button">
              <DiagramActionIcon name="close" />
            </button>
          </div>
        </header>
        <div className="diagram-print-preview-dialog-body">
          <aside className="diagram-print-preview-dialog-settings" aria-label={t("diagram.printPreviewSettings")}>
            <label>
              <span>{t("diagram.paperSize")}</span>
              <select value={draftSettings.paperSize} onChange={(event) => setDraftSettings({ ...draftSettings, paperSize: event.currentTarget.value as RelicDiagramPrintSettings["paperSize"] })}>
                {relicDiagramPaperSizes.map((paperSize) => <option key={paperSize} value={paperSize}>{paperSize}</option>)}
              </select>
            </label>
            <label>
              <span>{t("diagram.paperOrientation")}</span>
              <select value={draftSettings.orientation} onChange={(event) => setDraftSettings({ ...draftSettings, orientation: event.currentTarget.value as RelicDiagramPrintSettings["orientation"] })}>
                {relicDiagramPrintOrientations.map((orientation) => <option key={orientation} value={orientation}>{t(`diagram.printOrientation.${orientation}`)}</option>)}
              </select>
            </label>
            <label>
              <span>{t("diagram.paperMargin")}</span>
              <select value={draftSettings.marginPreset} onChange={(event) => setDraftSettings({ ...draftSettings, marginPreset: event.currentTarget.value as RelicDiagramPrintSettings["marginPreset"] })}>
                {relicDiagramPrintMarginPresets.map((margin) => <option key={margin} value={margin}>{t(`diagram.printMargin.${margin}`)}</option>)}
              </select>
            </label>
            <label>
              <span>{t("diagram.printScaleMode")}</span>
              <select value={draftSettings.scaleMode} onChange={(event) => setDraftSettings({ ...draftSettings, scaleMode: event.currentTarget.value as RelicDiagramPrintSettings["scaleMode"] })}>
                {relicDiagramPrintScaleModes.map((scaleMode) => <option key={scaleMode} value={scaleMode}>{t(`diagram.printScaleMode.${scaleMode}`)}</option>)}
              </select>
            </label>
            <label>
              <span>{t("diagram.printScale")}</span>
              <input
                max={200}
                min={10}
                onChange={(event) => setDraftSettings({ ...draftSettings, scale: Number(event.currentTarget.value) / 100 })}
                step={5}
                type="number"
                value={Math.round(draftSettings.scale * 100)}
              />
            </label>
            <div className="diagram-print-preview-dialog-controls">
              <button onClick={onEditPrintArea} type="button">
                <DiagramActionIcon name="printArea" />
                {t("diagram.printArea")}
              </button>
              <button onClick={applyDraftSettings} type="button">
                <DiagramActionIcon name="check" />
                {t("common.apply")}
              </button>
              <button disabled={!payload || isRendering} onClick={() => void savePdf()} type="button">
                <DiagramActionIcon name="download" />
                {t("output.savePdf")}
              </button>
              <button disabled={!payload || isRendering} onClick={printPreviewFrame} type="button">
                <DiagramActionIcon name="print" />
                {t("output.print")}
              </button>
            </div>
          </aside>
          <section className="diagram-print-preview-dialog-preview" aria-label={t("diagram.printPreviewPaper")}>
            {isRendering ? <div className="diagram-print-preview-dialog-state">{t("diagram.printPreviewRendering")}</div> : null}
            {previewError ? (
              <div className="diagram-print-preview-dialog-state">
                <p>{previewError}</p>
                <button onClick={() => setDraftSettings({ ...draftSettings })} type="button">
                  <DiagramActionIcon name="reset" />
                  {t("common.retry")}
                </button>
              </div>
            ) : null}
            {payload ? (
              <div className="diagram-print-preview-dialog-paper" style={{ transform: `scale(${zoom})` }}>
                <iframe
                  className="diagram-print-preview-dialog-frame"
                  ref={frameRef}
                  srcDoc={payload.html}
                  title={payload.title}
                />
              </div>
            ) : null}
          </section>
        </div>
        {status ? <output className="diagram-print-preview-dialog-status" role="status">{status}</output> : null}
      </div>
    </div>
  );
}
