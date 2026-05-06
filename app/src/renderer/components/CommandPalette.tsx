import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { useT } from "../i18n";

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
}

function matchesQuery(label: string, query: string): boolean {
  if (!query) return true;

  const lower = label.toLowerCase();
  const q = query.toLowerCase();

  return lower.includes(q);
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps): ReactElement {
  const t = useT();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = commands.filter((c) => matchesQuery(c.label, query));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const execute = (command: Command): void => {
    command.action();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-palette-input"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelectedIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && filtered[selectedIndex]) {
              execute(filtered[selectedIndex]);
            }
          }}
          placeholder={t("commandPalette.placeholder")}
          type="text"
          value={query}
        />
        <ul className="command-list">
          {filtered.map((cmd, i) => (
            <li
              className={`command-item${i === selectedIndex ? " command-item--selected" : ""}`}
              key={cmd.id}
              onClick={() => execute(cmd)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="command-label">{cmd.label}</span>
              {cmd.shortcut ? <span className="command-shortcut">{cmd.shortcut}</span> : null}
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="command-empty">{t("commandPalette.empty")}</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
