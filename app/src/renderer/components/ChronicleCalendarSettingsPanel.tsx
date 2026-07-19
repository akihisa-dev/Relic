import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type RefObject
} from "react";

import type { ChartEntry } from "../../shared/ipc";
import type { ChronicleCalendarSettings } from "../../shared/chronicleCalendar";
import {
  createChronicleCalendarSettingsDraft,
  normalizeChronicleCalendarSettingsDraft
} from "../chronicleCalendarSettingsModel";
import { useT } from "../i18n";

interface ChronicleCalendarSettingsPanelProps {
  entries: ChartEntry[];
  onClose: () => void;
  onSave: (settings: ChronicleCalendarSettings) => void;
  panelRef: RefObject<HTMLElement | null>;
  settings: ChronicleCalendarSettings;
}

export interface ChronicleCalendarSettingsPopover {
  buttonRef: RefObject<HTMLButtonElement | null>;
  close: () => void;
  isOpen: boolean;
  panelRef: RefObject<HTMLElement | null>;
  toggle: () => void;
}

export function useChronicleCalendarSettingsPopover(): ChronicleCalendarSettingsPopover {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnPointerDown = (event: globalThis.PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    return () => document.removeEventListener("pointerdown", closeOnPointerDown);
  }, [isOpen]);

  return {
    buttonRef,
    close: () => setIsOpen(false),
    isOpen,
    panelRef,
    toggle: () => setIsOpen((open) => !open)
  };
}

export function ChronicleCalendarSettingsPanel({
  entries,
  onClose,
  onSave,
  panelRef,
  settings
}: ChronicleCalendarSettingsPanelProps): ReactElement {
  const t = useT();
  const [draft, setDraft] = useState(() => createChronicleCalendarSettingsDraft(settings));
  useEffect(() => setDraft(createChronicleCalendarSettingsDraft(settings)), [settings]);
  const names = [draft.baseCalendarName, ...draft.calendars.map((calendar) => calendar.name)];
  const usedNames = useMemo(() => new Set(entries.flatMap((entry) => (
    entry.calendarName ? [entry.calendarName] : []
  ))), [entries]);
  const save = (next: typeof draft): void => {
    const normalized = normalizeChronicleCalendarSettingsDraft(next);
    if (!normalized) return;
    setDraft(createChronicleCalendarSettingsDraft(normalized));
    onSave(normalized);
  };
  const toggleVisible = (name: string): void => {
    const visible = draft.visibleCalendarNames.includes(name)
      ? draft.visibleCalendarNames.filter((candidate) => candidate !== name)
      : [...draft.visibleCalendarNames, name];
    if (visible.length > 0) save({ ...draft, visibleCalendarNames: visible });
  };

  return (
    <section aria-label={t("chronicle.calendarSettings")} className="chronicle-calendar-settings-panel" ref={panelRef}>
      <header>
        <h2>{t("chronicle.calendarSettings")}</h2>
        <button aria-label={t("chronicle.closeCalendarSettings")} onClick={onClose} type="button">×</button>
      </header>
      <div className="chronicle-calendar-settings-content">
        <h3>{t("chronicle.visibleCalendars")}</h3>
        <div className="chronicle-calendar-visible-list">
          {names.map((name) => (
            <label key={name}>
              <input checked={draft.visibleCalendarNames.includes(name)} onChange={() => toggleVisible(name)} type="checkbox" />
              <span>{name}</span>
            </label>
          ))}
        </div>
        <h3>{t("chronicle.baseCalendar")}</h3>
        <label className="chronicle-calendar-field">
          <span>{t("chronicle.calendarName")}</span>
          <input
            onBlur={() => save(draft)}
            onChange={(event) => {
              const previous = draft.baseCalendarName;
              const name = event.target.value;
              setDraft({
                ...draft,
                baseCalendarName: name,
                visibleCalendarNames: draft.visibleCalendarNames.map((candidate) => candidate === previous ? name : candidate)
              });
            }}
            value={draft.baseCalendarName}
          />
        </label>
        <h3>{t("chronicle.otherCalendars")}</h3>
        <div className="chronicle-calendar-definition-list">
          {draft.calendars.map((calendar, index) => (
            <div className="chronicle-calendar-definition" key={index}>
              <input
                aria-label={t("chronicle.calendarName")}
                disabled={usedNames.has(calendar.name)}
                onBlur={() => save(draft)}
                onChange={(event) => {
                  const previous = calendar.name;
                  const name = event.target.value;
                  setDraft({
                    ...draft,
                    calendars: draft.calendars.map((item, itemIndex) => itemIndex === index ? { ...item, name } : item),
                    visibleCalendarNames: draft.visibleCalendarNames.map((candidate) => candidate === previous ? name : candidate)
                  });
                }}
                value={calendar.name}
              />
              <label>
                <span>{t("chronicle.yearOneEqualsBase")}</span>
                <input
                  inputMode="numeric"
                  onBlur={() => save(draft)}
                  onChange={(event) => setDraft({
                    ...draft,
                    calendars: draft.calendars.map((item, itemIndex) => (
                      itemIndex === index ? { ...item, yearOne: event.target.value } : item
                    ))
                  })}
                  pattern="-?[0-9]*"
                  type="text"
                  value={calendar.yearOne}
                />
                <span>{t("chronicle.yearSuffix")}</span>
              </label>
              <button
                aria-label={t("chronicle.removeCalendar", { name: calendar.name })}
                disabled={usedNames.has(calendar.name)}
                onClick={() => save({
                  ...draft,
                  calendars: draft.calendars.filter((_, itemIndex) => itemIndex !== index),
                  visibleCalendarNames: draft.visibleCalendarNames.filter((name) => name !== calendar.name)
                })}
                type="button"
              >×</button>
            </div>
          ))}
        </div>
        <button
          className="chronicle-calendar-add"
          onClick={() => {
            const baseName = t("chronicle.newCalendar");
            let name = baseName;
            let suffix = 2;
            while (names.includes(name)) name = `${baseName} ${suffix++}`;
            setDraft({ ...draft, calendars: [...draft.calendars, { name, yearOne: "1" }] });
          }}
          type="button"
        >＋ {t("chronicle.addCalendar")}</button>
      </div>
    </section>
  );
}
