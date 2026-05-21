import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { useT } from "../i18n";
import type { AliasIndex } from "../../shared/links";

interface QuickSwitcherProps {
  aliasesByPath?: AliasIndex;
  cardPaths: string[];
  onClose: () => void;
  onSelect: (path: string) => void;
}

function matchingAlias(cardPath: string, query: string, aliasesByPath: AliasIndex): string | null {
  if (!query) return null;

  return aliasesByPath[cardPath]?.find((alias) => alias.toLowerCase().includes(query.toLowerCase())) ?? null;
}

function matchesQuery(cardPath: string, query: string, aliasesByPath: AliasIndex): boolean {
  if (!query) return true;

  const basename = cardPath.split("/").at(-1)?.replace(/\.md$/, "") ?? cardPath;

  return basename.toLowerCase().includes(query.toLowerCase()) ||
    cardPath.toLowerCase().includes(query.toLowerCase()) ||
    matchingAlias(cardPath, query, aliasesByPath) !== null;
}

function getBasename(cardPath: string): string {
  return cardPath.split("/").at(-1)?.replace(/\.md$/, "") ?? cardPath;
}

function getDirPath(cardPath: string): string {
  const parts = cardPath.split("/");

  parts.pop();

  return parts.join("/");
}

export function QuickSwitcher({ aliasesByPath = {}, cardPaths, onClose, onSelect }: QuickSwitcherProps): ReactElement {
  const t = useT();
  const [isClosing, setIsClosing] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const closeTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = cardPaths.filter((p) => matchesQuery(p, query, aliasesByPath)).slice(0, 50);

  const basenames = filtered.map(getBasename);
  const duplicates = new Set(basenames.filter((b, i) => basenames.indexOf(b) !== i));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const requestClose = (): void => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
      closeTimerRef.current = null;
    }, 170);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") requestClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [requestClose]);

  const select = (cardPath: string): void => {
    onSelect(cardPath);
    requestClose();
  };

  return (
    <div className={`modal-overlay${isClosing ? " modal-overlay--closing" : ""}`} onClick={requestClose}>
      <div className={`quick-switcher${isClosing ? " quick-switcher--closing" : ""}`} onClick={(e) => e.stopPropagation()}>
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
              select(filtered[selectedIndex]);
            }
          }}
          placeholder={t("quickSwitcher.placeholder")}
          type="text"
          value={query}
        />
        <ul className="command-list">
          {filtered.map((cardPath, i) => {
            const basename = getBasename(cardPath);
            const showPath = duplicates.has(basename);
            const alias = matchingAlias(cardPath, query, aliasesByPath);

            return (
              <li
                className={`command-item${i === selectedIndex ? " command-item--selected" : ""}`}
                key={cardPath}
                onClick={() => select(cardPath)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="command-label">{basename}</span>
                {alias || showPath ? (
                  <span className="command-shortcut">{alias ? `alias: ${alias}` : getDirPath(cardPath)}</span>
                ) : null}
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="command-empty">{t("quickSwitcher.empty")}</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
