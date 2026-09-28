import { type KeyboardEvent, useEffect, useRef } from "react";
import { openDesktopMenu } from "../../lib/desktopShell";
import { t } from "../../lib/i18n";

/**
 * Menüs in der Reihenfolge der Windows-Menüleiste. Die Ids und Texte
 * entsprechen dem Anwendungsmenü des Hauptprozesses.
 */
const menus = [
  { id: "file", labelKey: "desktop.menu.file" },
  { id: "edit", labelKey: "desktop.menu.edit" },
  { id: "view", labelKey: "desktop.menu.view" },
  { id: "window", labelKey: "desktop.menu.window" },
];

/**
 * Menüzeile der Windows-Titelleiste. Ein Klick öffnet das Menü des
 * Hauptprozesses unter dem Namen; Alt oder F10 springt wie gewohnt hinein.
 */
export const DesktopMenuBar = () => {
  const menuButtons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    // Alt allein (ohne weitere Taste dazwischen) wählt die Menüzeile an
    let altAlone = false;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "F10" && !(event.shiftKey || event.ctrlKey)) {
        event.preventDefault();
        menuButtons.current[0]?.focus();
      }
      altAlone = event.key === "Alt" && (event.repeat ? altAlone : true);
    };
    const onKeyUp = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Alt" && altAlone) {
        event.preventDefault();
        if (menuButtons.current.includes(document.activeElement as never)) {
          (document.activeElement as HTMLElement).blur();
        } else {
          menuButtons.current[0]?.focus();
        }
      }
      altAlone = false;
    };
    const onPointerDown = () => {
      altAlone = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const openMenu = (index: number) => {
    const button = menuButtons.current[index];
    const menu = menus[index];
    if (!(button && menu)) {
      return;
    }
    const rect = button.getBoundingClientRect();
    openDesktopMenu(menu.id, rect.left, rect.bottom);
  };

  const onMenuKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const step = event.key === "ArrowRight" ? 1 : -1;
      event.preventDefault();
      menuButtons.current[
        (index + step + menus.length) % menus.length
      ]?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(index);
    } else if (event.key === "Escape") {
      menuButtons.current[index]?.blur();
    }
  };

  return (
    <div role="menubar" className="flex items-center gap-0.5">
      {menus.map((menu, index) => (
        <button
          key={menu.id}
          ref={(element) => {
            menuButtons.current[index] = element;
          }}
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          onClick={() => openMenu(index)}
          onKeyDown={(event) => onMenuKeyDown(event, index)}
          className="rounded-sm px-2.5 py-1 outline-none hover:bg-schiefer-800 focus-visible:bg-schiefer-800"
        >
          {t(menu.labelKey)}
        </button>
      ))}
    </div>
  );
};
