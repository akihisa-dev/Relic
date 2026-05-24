import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";

import {
  chronicleCalendarIds,
  type ChronicleCalendarId,
  type ChronicleCalendarSettings
} from "../../shared/ipc";
import { useT } from "../i18n";

interface ChronicleSettingsPanelProps {
  calendars: ChronicleCalendarSettings[];
  onSave: (calendars: ChronicleCalendarSettings[]) => void;
}

interface ChronicleCalendarDraft {
  id: ChronicleCalendarId;
  name: string;
  startYear: string;
}

export function ChronicleSettingsPanel({
  calendars,
  onSave
}: ChronicleSettingsPanelProps): ReactElement {
  const t = useT();
  const [drafts, setDrafts] = useState<ChronicleCalendarDraft[]>(() => draftsForCalendars(calendars));
  const nextSubId = useMemo(
    () => chronicleCalendarIds.slice(1).find((id) => !drafts.some((draft) => draft.id === id)) ?? null,
    [drafts]
  );

  useEffect(() => {
    setDrafts(draftsForCalendars(calendars));
  }, [calendars]);

  const commit = (nextDrafts: ChronicleCalendarDraft[]): void => {
    const parsed = parseDrafts(nextDrafts);
    if (parsed) onSave(parsed);
  };

  const updateDraft = (id: ChronicleCalendarId, patch: Partial<ChronicleCalendarDraft>): void => {
    setDrafts((current) => {
      const next = current.map((draft) => draft.id === id ? { ...draft, ...patch } : draft);
      commit(next);
      return next;
    });
  };

  const addSubCalendar = (): void => {
    if (!nextSubId) return;

    const index = Number(nextSubId.replace("chronicle", ""));
    const next = [
      ...drafts,
      { id: nextSubId, name: `${t("chronicleSettings.subDefaultName")} ${index}`, startYear: "1" }
    ];
    setDrafts(next);
    commit(next);
  };

  const removeSubCalendar = (id: ChronicleCalendarId): void => {
    const next = drafts.filter((draft) => draft.id !== id);
    setDrafts(next);
    commit(next);
  };

  const mainDraft = drafts.find((draft) => draft.id === "chronicle0") ?? { id: "chronicle0", name: "", startYear: "1" };
  const subDrafts = drafts.filter((draft) => draft.id !== "chronicle0");

  return (
    <div className="settings-page chronicle-settings-page">
      <header className="settings-page-header">
        <p className="settings-page-kicker">{t("nav.chronicleSettings")}</p>
        <h2>{t("chronicleSettings.title")}</h2>
      </header>

      <section className="settings-group chronicle-settings-group">
        <div className="frontmatter-field-group-label">{t("chronicleSettings.mainCalendar")}</div>
        <label className="chronicle-calendar-row chronicle-calendar-row--main">
          <span>{mainDraft.id}</span>
          <input
            className="setting-custom-field-input"
            onBlur={() => commit(drafts)}
            onChange={(event) => updateDraft("chronicle0", { name: event.target.value })}
            value={mainDraft.name}
          />
          <span>{t("chronicleSettings.mainStartsAtOne")}</span>
        </label>
      </section>

      <section className="settings-group chronicle-settings-group">
        <div className="frontmatter-field-group-label">{t("chronicleSettings.subCalendars")}</div>
        {subDrafts.length === 0 ? (
          <div className="frontmatter-field-empty">{t("chronicleSettings.noSubCalendars")}</div>
        ) : (
          <div className="chronicle-calendar-list">
            {subDrafts.map((draft) => (
              <div className="chronicle-calendar-row" key={draft.id}>
                <span>{draft.id}</span>
                <input
                  aria-label={t("chronicleSettings.calendarName")}
                  className="setting-custom-field-input"
                  onBlur={() => commit(drafts)}
                  onChange={(event) => updateDraft(draft.id, { name: event.target.value })}
                  value={draft.name}
                />
                <input
                  aria-label={t("chronicleSettings.startYear")}
                  className="setting-custom-field-input chronicle-calendar-start-input"
                  min={1}
                  onBlur={() => commit(drafts)}
                  onChange={(event) => updateDraft(draft.id, { startYear: event.target.value })}
                  type="number"
                  value={draft.startYear}
                />
                <button
                  className="frontmatter-field-delete"
                  onClick={() => removeSubCalendar(draft.id)}
                  type="button"
                >
                  {t("common.delete")}
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          className="frontmatter-field-add-btn"
          disabled={!nextSubId}
          onClick={addSubCalendar}
          type="button"
        >
          {t("chronicleSettings.addSubCalendar")}
        </button>
      </section>
    </div>
  );
}

function draftsForCalendars(calendars: ChronicleCalendarSettings[]): ChronicleCalendarDraft[] {
  return calendars.map((calendar) => ({
    id: calendar.id,
    name: calendar.name,
    startYear: calendar.id === "chronicle0" ? "1" : String(calendar.startYear ?? 1)
  }));
}

function parseDrafts(drafts: ChronicleCalendarDraft[]): ChronicleCalendarSettings[] | null {
  const parsed: ChronicleCalendarSettings[] = [];

  for (const draft of drafts) {
    const name = draft.name.trim();
    if (!name) return null;

    if (draft.id === "chronicle0") {
      parsed.push({ id: draft.id, name });
      continue;
    }

    const startYear = Number(draft.startYear);
    if (!Number.isInteger(startYear) || startYear < 1) return null;
    parsed.push({ id: draft.id, name, startYear });
  }

  return parsed.sort((a, b) => chronicleCalendarIds.indexOf(a.id) - chronicleCalendarIds.indexOf(b.id));
}
