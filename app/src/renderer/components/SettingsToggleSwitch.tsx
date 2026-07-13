import type { ReactElement } from "react";

export function SettingsToggleSwitch({
  label,
  on,
  onChange
}: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
}): ReactElement {
  return (
    <button
      aria-checked={on}
      aria-label={label}
      className={`switch settings-toggle-switch${on ? " on" : ""}`}
      onClick={() => onChange(!on)}
      role="switch"
      type="button"
    >
      <span aria-hidden="true" className="switch-knob" />
    </button>
  );
}
