import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { useT } from "../i18n";
import { relicClient } from "../relicClient";

interface AttachmentTabSurfaceProps {
  name: string;
  path: string;
  refreshRevision: number;
}

export function PdfTabSurface({ name, path, refreshRevision }: AttachmentTabSurfaceProps): ReactElement {
  const t = useT();
  const [pdfState, setPdfState] = useState<{ error: string | null; path: string; src: string | null } | null>(null);
  const pdfSrc = pdfState?.path === path ? pdfState.src : null;
  const loadError = pdfState?.path === path ? pdfState.error : null;

  useEffect(() => {
    let active = true;
    void relicClient.current?.readPdfFile({ path }).then((result) => {
      if (!active) return;
      setPdfState(result.ok
        ? { error: null, path, src: result.value.dataUrl }
        : { error: result.error.message, path, src: null });
    }).catch(() => {
      if (active) setPdfState({ error: t("pane.pdfLoadFailed"), path, src: null });
    });
    return () => {
      active = false;
    };
  }, [path, refreshRevision, t]);

  return (
    <div className="editor-surface pdf-tab-surface">
      <AttachmentTitle name={name} path={path} />
      <div className="pdf-tab-body">
        {pdfSrc ? (
          <iframe className="pdf-tab-frame" sandbox="allow-scripts" src={pdfSrc} title={name} />
        ) : (
          <output className="editor-conflict-banner">
            <span>{loadError ?? t("pane.pdfLoading")}</span>
          </output>
        )}
      </div>
    </div>
  );
}

export function ImageTabSurface({ name, path, refreshRevision }: AttachmentTabSurfaceProps): ReactElement {
  const t = useT();
  const [imageState, setImageState] = useState<{ error: string | null; path: string; src: string | null } | null>(null);
  const imageSrc = imageState?.path === path ? imageState.src : null;
  const loadError = imageState?.path === path ? imageState.error : null;

  useEffect(() => {
    let active = true;
    void relicClient.current?.readImageFile({ path }).then((result) => {
      if (!active) return;
      setImageState(result.ok
        ? { error: null, path, src: result.value.dataUrl }
        : { error: result.error.message, path, src: null });
    }).catch(() => {
      if (active) setImageState({ error: t("pane.imageLoadFailed"), path, src: null });
    });
    return () => {
      active = false;
    };
  }, [path, refreshRevision, t]);

  return (
    <div className="editor-surface image-tab-surface">
      <AttachmentTitle name={name} path={path} />
      <div className="image-tab-body">
        {imageSrc ? (
          <img alt={name} className="image-tab-image" src={imageSrc} />
        ) : (
          <output className="editor-conflict-banner">
            <span>{loadError ?? t("pane.imageLoading")}</span>
          </output>
        )}
      </div>
    </div>
  );
}

function AttachmentTitle({ name, path }: Pick<AttachmentTabSurfaceProps, "name" | "path">): ReactElement {
  return (
    <div className="image-tab-title-row">
      <div className="editor-file-title-slot">
        <div className="editor-file-title" title={path}>{name}</div>
      </div>
    </div>
  );
}
