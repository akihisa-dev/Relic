import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import { useT } from "../i18n";

type BridgeMode = "browser" | "internal";

export function HakobiBridgePanel({ workspacePath }: { workspacePath: string | null }): ReactElement {
  const t = useT();
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<BridgeMode>("browser");
  const [confirmBeforeSend, setConfirmBeforeSend] = useState(true);
  const [blockAdmin, setBlockAdmin] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [proposalStatus, setProposalStatus] = useState(t("hakobiBridge.proposalIdle"));

  const connectionStatus = useMemo(() => {
    if (!workspacePath) return t("hakobiBridge.statusWorkspaceRequired");
    return enabled ? t("hakobiBridge.statusReady") : t("hakobiBridge.statusDisabled");
  }, [enabled, t, workspacePath]);

  const handleDraftResponse = (): void => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setResponse(t("hakobiBridge.responseEmpty"));
      return;
    }

    setResponse(t("hakobiBridge.responseDraft", { prompt: trimmed }));
  };

  const handleCreateProposal = (): void => {
    if (!response.trim()) {
      setProposalStatus(t("hakobiBridge.proposalNeedsResponse"));
      return;
    }

    setProposalStatus(t("hakobiBridge.proposalCreated"));
  };

  return (
    <div className="settings-page hakobi-bridge-page">
      <header className="settings-page-header">
        <p className="settings-page-kicker">{t("nav.hakobiBridge")}</p>
        <h2>{t("hakobiBridge.title")}</h2>
      </header>

      <section className="settings-group hakobi-bridge-status">
        <div>
          <div className="links-panel-subheading">{t("hakobiBridge.connection")}</div>
          <p>{connectionStatus}</p>
        </div>
        <span className={`hakobi-bridge-pill${enabled ? " hakobi-bridge-pill--ready" : ""}`}>
          {enabled ? t("hakobiBridge.enabled") : t("hakobiBridge.disabled")}
        </span>
      </section>

      <section className="settings-group">
        <div className="links-panel-subheading">{t("hakobiBridge.settings")}</div>
        <div className="settings-stack">
          <label className="setting-row">
            <span>{t("hakobiBridge.enable")}</span>
            <input
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              type="checkbox"
            />
          </label>
          <label className="setting-row">
            <span>{t("hakobiBridge.connectionMode")}</span>
            <select
              className="settings-control"
              onChange={(event) => setMode(event.target.value as BridgeMode)}
              value={mode}
            >
              <option value="browser">{t("hakobiBridge.modeBrowser")}</option>
              <option value="internal">{t("hakobiBridge.modeInternal")}</option>
            </select>
          </label>
          <label className="setting-row">
            <span>{t("hakobiBridge.allowedDomain")}</span>
            <input
              className="settings-control settings-text-input"
              readOnly
              type="text"
              value="app.ai-constcierge.com"
            />
          </label>
          <label className="setting-row">
            <span>{t("hakobiBridge.blockAdmin")}</span>
            <input
              checked={blockAdmin}
              onChange={(event) => setBlockAdmin(event.target.checked)}
              type="checkbox"
            />
          </label>
          <label className="setting-row">
            <span>{t("hakobiBridge.confirmBeforeSend")}</span>
            <input
              checked={confirmBeforeSend}
              onChange={(event) => setConfirmBeforeSend(event.target.checked)}
              type="checkbox"
            />
          </label>
        </div>
      </section>

      <section className="settings-group hakobi-bridge-workbench">
        <div className="links-panel-subheading">{t("hakobiBridge.workbench")}</div>
        <label className="setting-row setting-row--stacked">
          <span>{t("hakobiBridge.prompt")}</span>
          <textarea
            className="hakobi-bridge-textarea"
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={t("hakobiBridge.promptPlaceholder")}
            value={prompt}
          />
        </label>
        <div className="settings-actions-row">
          <button disabled={!enabled || !workspacePath} onClick={handleDraftResponse} type="button">
            {t("hakobiBridge.send")}
          </button>
        </div>
        <label className="setting-row setting-row--stacked">
          <span>{t("hakobiBridge.response")}</span>
          <textarea
            className="hakobi-bridge-textarea hakobi-bridge-textarea--response"
            onChange={(event) => setResponse(event.target.value)}
            placeholder={t("hakobiBridge.responsePlaceholder")}
            value={response}
          />
        </label>
      </section>

      <section className="settings-group">
        <div className="links-panel-subheading">{t("hakobiBridge.proposal")}</div>
        <p className="hakobi-bridge-note">{t("hakobiBridge.proposalDescription")}</p>
        <div className="settings-actions-row">
          <button disabled={!workspacePath} onClick={handleCreateProposal} type="button">
            {t("hakobiBridge.createProposal")}
          </button>
          <span className="settings-inline-status">{proposalStatus}</span>
        </div>
      </section>
    </div>
  );
}
