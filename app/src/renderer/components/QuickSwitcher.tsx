import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

interface QuickSwitcherProps {
  filePaths: string[];
  onClose: () => void;
  onSelect: (path: string) => void;
}

function matchesQuery(filePath: string, query: string): boolean {
  if (!query) return true;

  const basename = filePath.split("/").at(-1)?.replace(/\.md$/, "") ?? filePath;

  return basename.toLowerCase().includes(query.toLowerCase()) ||
    filePath.toLowerCase().includes(query.toLowerCase());
}

function getBasename(filePath: string): string {
  return filePath.split("/").at(-1)?.replace(/\.md$/, "") ?? filePath;
}

function getDirPath(filePath: string): string {
  const parts = filePath.split("/");

  parts.pop();

  return parts.join("/");
}

export function QuickSwitcher({ filePaths, onClose, onSelect }: QuickSwitcherProps): ReactElement {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = filePaths.filter((p) => matchesQuery(p, query)).slice(0, 50);

  const basenames = filtered.map(getBasename);
  const duplicates = new Set(basenames.filter((b, i) => basenames.indexOf(b) !== i));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const select = (filePath: string): void => {
    onSelect(filePath);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="quick-switcher" onClick={(e) => e.stopPropagation()}>
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
          placeholder="ファイル名を検索..."
          type="text"
          value={query}
        />
        <ul className="command-list">
          {filtered.map((filePath, i) => {
            const basename = getBasename(filePath);
            const showPath = duplicates.has(basename);

            return (
              <li
                className={`command-item${i === selectedIndex ? " command-item--selected" : ""}`}
                key={filePath}
                onClick={() => select(filePath)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="command-label">{basename}</span>
                {showPath ? (
                  <span className="command-shortcut">{getDirPath(filePath)}</span>
                ) : null}
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="command-empty">一致するファイルがありません</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
