import { useState } from "react";
import type { ReactElement } from "react";

import type { ChronicleCalendarSettings } from "../../shared/ipc";
import { useT } from "../i18n";

interface ChronicleSettingsPanelProps {
  calendars: ChronicleCalendarSettings[];
  onSave: (calendars: ChronicleCalendarSettings[]) => void;
}

interface ChronicleCalendarDraft {
  name: string;
  startYear: string;
}

export function ChronicleSettingsPanel({
  calendars,
  onSave
}: ChronicleSettingsPanelProps): ReactElement {
  const t = useT();
  const calendarDraftKey = draftKeyForCalendars(calendars);
  const [draftState, setDraftState] = useState(() => ({
    key: calendarDraftKey,
    drafts: draftsForCalendars(calendars)
  }));
  if (draftState.key !== calendarDraftKey) {
    setDraftState({
      key: calendarDraftKey,
      drafts: draftsForCalendars(calendars)
    });
  }
  const drafts = draftState.key === calendarDraftKey ? draftState.drafts : draftsForCalendars(calendars);
  const duplicateNames = duplicateCalendarNames(drafts);

  const commit = (nextDrafts: ChronicleCalendarDraft[]): void => {
    const parsed = parseDrafts(nextDrafts);
    if (parsed) onSave(parsed);
  };

  const updateDraft = (index: number, patch: Partial<ChronicleCalendarDraft>): void => {
    setDraftState((current) => {
      const currentDrafts = current.key === calendarDraftKey ? current.drafts : draftsForCalendars(calendars);
      const next = currentDrafts.map((draft, draftIndex) => draftIndex === index ? { ...draft, ...patch } : draft);
      commit(next);
      return { key: calendarDraftKey, drafts: next };
    });
  };

  const addSubCalendar = (): void => {
    const next = [
      ...drafts,
      { name: `${t("chronicleSettings.subDefaultName")} ${drafts.length}`, startYear: "1" }
    ];
    setDraftState({ key: calendarDraftKey, drafts: next });
    commit(next);
  };

  const removeSubCalendar = (index: number): void => {
    const next = drafts.filter((_draft, draftIndex) => draftIndex !== index);
    setDraftState({ key: calendarDraftKey, drafts: next });
    commit(next);
  };

  const mainDraft = drafts[0] ?? { name: "メイン暦", startYear: "" };
  const subDrafts = drafts.slice(1);

  return (
    <div className="settings-page chronicle-settings-page">
      <header className="settings-page-header">
        <p className="settings-page-kicker">{t("nav.chronicleSettings")}</p>
        <h2>{t("chronicleSettings.title")}</h2>
      </header>

      <section className="settings-group chronicle-settings-group">
        <div className="chronicle-calendar-section-label">{t("chronicleSettings.mainCalendar")}</div>
        <label className="chronicle-calendar-row chronicle-calendar-row--main">
          <span>{t("chronicleSettings.calendarName")}</span>
          <input
            aria-invalid={duplicateNames.has(mainDraft.name.trim()) ? "true" : undefined}
            className="setting-custom-field-input"
            onBlur={() => commit(drafts)}
            onChange={(event) => updateDraft(0, { name: event.target.value })}
            value={mainDraft.name}
          />
          <span>{t("chronicleSettings.mainStartsAtOne")}</span>
        </label>

        <div className="chronicle-calendar-section-heading">
          <span>{t("chronicleSettings.subCalendars")}</span>
          <button
            className="frontmatter-field-add-btn chronicle-calendar-add-btn"
            onClick={addSubCalendar}
            type="button"
          >
            {t("chronicleSettings.addSubCalendar")}
          </button>
        </div>
        {subDrafts.length === 0 ? (
          <div className="chronicle-calendar-empty">{t("chronicleSettings.noSubCalendars")}</div>
        ) : (
          <div className="chronicle-calendar-list">
            {subDrafts.map((draft, subIndex) => {
              const index = subIndex + 1;
              const error = chronicleCalendarError(t, draft, duplicateNames);
              return (
                <div className="chronicle-calendar-row" key={`${index}-${draft.name}`}>
                  <span>{t("chronicleSettings.calendarName")}</span>
                  <input
                    aria-label={t("chronicleSettings.calendarName")}
                    aria-invalid={error ? "true" : undefined}
                    className="setting-custom-field-input"
                    onBlur={() => commit(drafts)}
                    onChange={(event) => updateDraft(index, { name: event.target.value })}
                    value={draft.name}
                  />
                  <input
                    aria-label={t("chronicleSettings.startYear")}
                    aria-invalid={error ? "true" : undefined}
                    className="setting-custom-field-input chronicle-calendar-start-input"
                    inputMode="numeric"
                    onBlur={() => commit(drafts)}
                    onChange={(event) => updateDraft(index, { startYear: event.target.value })}
                    type="text"
                    value={draft.startYear}
                  />
                  <button
                    className="frontmatter-field-delete"
                    onClick={() => removeSubCalendar(index)}
                    type="button"
                  >
                    {t("common.delete")}
                  </button>
                  <div className="chronicle-calendar-preview">
                    {previewForSubCalendar(t, mainDraft, draft)}
                  </div>
                  {error ? <div className="chronicle-calendar-error">{error}</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function draftsForCalendars(calendars: ChronicleCalendarSettings[]): ChronicleCalendarDraft[] {
  const drafts = calendars.map((calendar) => ({
    name: calendar.name,
    startYear: calendar.startYear === undefined ? "" : String(calendar.startYear)
  }));
  return drafts.length > 0 ? drafts : [{ name: "メイン暦", startYear: "" }];
}

function draftKeyForCalendars(calendars: ChronicleCalendarSettings[]): string {
  return JSON.stringify(calendars.map((calendar) => [calendar.name, calendar.startYear ?? null]));
}

function parseDrafts(drafts: ChronicleCalendarDraft[]): ChronicleCalendarSettings[] | null {
  const names = new Set<string>();
  const parsed: ChronicleCalendarSettings[] = [];

  for (const [index, draft] of drafts.entries()) {
    const name = draft.name.trim();
    if (!name || names.has(name)) return null;
    names.add(name);

    if (index === 0) {
      parsed.push({ name });
      continue;
    }

    if (draft.startYear.trim() === "") {
      parsed.push({ name });
      continue;
    }

    const startYear = Number(draft.startYear);
    if (!Number.isInteger(startYear) || startYear < 1) return null;
    parsed.push({ name, startYear });
  }

  return parsed;
}

function duplicateCalendarNames(drafts: ChronicleCalendarDraft[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const draft of drafts) {
    const name = draft.name.trim();
    if (!name) continue;
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  }
  return duplicates;
}

function chronicleCalendarError(
  t: ReturnType<typeof useT>,
  draft: ChronicleCalendarDraft,
  duplicateNames: Set<string>
): string | null {
  if (!draft.name.trim()) return t("frontmatter.chronicleStartRequired");
  if (duplicateNames.has(draft.name.trim())) return t("frontmatter.duplicateProperty");
  if (draft.startYear.trim() === "") return null;
  const startYear = Number(draft.startYear);
  return Number.isInteger(startYear) && startYear >= 1 ? null : t("chronicleSettings.invalidStartYear");
}

function previewForSubCalendar(
  t: ReturnType<typeof useT>,
  mainDraft: ChronicleCalendarDraft,
  draft: ChronicleCalendarDraft
): string {
  const startYear = Number(draft.startYear);

  if (draft.startYear.trim() === "" || !Number.isInteger(startYear) || startYear < 1) {
    return t("chronicleSettings.conversionPreviewUnavailable");
  }

  return t("chronicleSettings.conversionPreview", {
    mainName: mainDraft.name.trim() || "メイン暦",
    startYear,
    subName: draft.name.trim() || t("chronicleSettings.subDefaultName")
  });
}
