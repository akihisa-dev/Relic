import { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject, ReactElement } from "react";
import { createPortal } from "react-dom";

import {
  appendOrCreateFrontmatterField,
  canAppendOrCreateFrontmatterField,
  findFrontmatterBlock
} from "../editorFrontmatter";
import {
  buildFrontmatterPropertyMenuState,
  type FrontmatterPropertyMenuState
} from "../editorFrontmatterPropertyMenuModel";
import type { Translator } from "../i18nModel";

interface EditorFrontmatterPropertyMenuProps {
  host?: HTMLElement | null;
  t: Translator;
  viewRef: MutableRefObject<EditorView | null>;
}

export function EditorFrontmatterPropertyMenu({
  host = null,
  t,
  viewRef
}: EditorFrontmatterPropertyMenuProps): ReactElement {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<FrontmatterPropertyMenuState | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const toggleMenu = (): void => {
    const view = viewRef.current;
    if (!view) return;

    if (menu) {
      setMenu(null);
      return;
    }

    if (buttonRef.current) {
      setMenuStyle(frontmatterPropertyMenuPlacement(buttonRef.current));
    }
    setMenu(buildFrontmatterPropertyMenuState(
      canAppendOrCreateFrontmatterField(view),
      Object.keys(findFrontmatterBlock(view.state)?.data ?? {}),
      t
    ));
  };

  const addProperty = (key: string): void => {
    const view = viewRef.current;
    if (!view) return;

    appendOrCreateFrontmatterField(view, key);
    setMenu(null);
  };

  useEffect(() => {
    if (!menu) return;

    const updatePlacement = (): void => {
      if (buttonRef.current) {
        setMenuStyle(frontmatterPropertyMenuPlacement(buttonRef.current));
      }
    };
    const closeOnPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setMenu(null);
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [menu]);

  const button = (
    <button
      aria-expanded={menu ? "true" : "false"}
      aria-haspopup="menu"
      aria-label={t("frontmatter.addProperty")}
      className="editor-frontmatter-add-button"
      onClick={toggleMenu}
      ref={buttonRef}
      title={t("frontmatter.addProperty")}
      type="button"
    >
      +
    </button>
  );

  return (
    <>
      {host ? null : button}
      {menu ? (
        <div className="editor-frontmatter-add-menu" ref={menuRef} role="menu" style={menuStyle}>
          <div className="editor-frontmatter-add-menu-title">{t("frontmatter.addProperty")}</div>
          {menu.unavailable ? (
            <div className="editor-frontmatter-add-menu-empty">{t("frontmatter.fixYamlBeforeAdding")}</div>
          ) : menu.groups.length === 0 ? (
            <div className="editor-frontmatter-add-menu-empty">{t("frontmatter.noAvailableProperties")}</div>
          ) : (
            menu.groups.map((group) => (
              <div className="editor-frontmatter-add-menu-group" key={group.id}>
                <div className="editor-frontmatter-add-menu-group-label">{group.label}</div>
                {group.options.map((option) => (
                  <button
                    className="editor-frontmatter-add-menu-item"
                    key={option.key}
                    onClick={() => addProperty(option.key)}
                    role="menuitem"
                    type="button"
                  >
                    <span>{option.label}</span>
                    <code>{option.key}</code>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
      {host ? createPortal(button, host) : null}
    </>
  );
}

function frontmatterPropertyMenuPlacement(button: HTMLElement): CSSProperties {
  const rect = button.getBoundingClientRect();
  const margin = 16;
  const gap = 8;
  const menuMaxWidth = 300;
  const menuMaxHeight = 520;
  const menuMinHeight = 160;
  const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  const width = Math.max(0, Math.min(menuMaxWidth, viewportWidth - margin * 2));
  const left = Math.min(
    Math.max(rect.right - width, margin),
    Math.max(margin, viewportWidth - width - margin)
  );
  const availableBelow = Math.max(0, viewportHeight - rect.bottom - gap - margin);
  const availableAbove = Math.max(0, rect.top - gap - margin);
  const opensBelow = availableBelow >= menuMinHeight || availableBelow >= availableAbove;
  const availableHeight = opensBelow ? availableBelow : availableAbove;
  const maxHeight = Math.max(80, Math.min(menuMaxHeight, availableHeight));
  const top = opensBelow
    ? Math.min(rect.bottom + gap, viewportHeight - margin)
    : Math.max(margin, rect.top - gap - maxHeight);

  return {
    left,
    maxHeight,
    top,
    width
  };
}
