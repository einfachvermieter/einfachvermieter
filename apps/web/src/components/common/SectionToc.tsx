import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

type TocEntry = { title: string; element: HTMLElement };

/**
 * Höhe des stehenden Seitenkopfs: bis hierher gilt Inhalt als verdeckt
 */
const HEADER_OFFSET = 120;

/**
 * Inhaltsverzeichnis rechts neben einer Detailseite, ab drei Abschnitten.
 * Ein Balken zeigt, welcher Teil der Seite gerade sichtbar ist im Scrollbereich.
 */
export const SectionToc = () => {
  const navRef = useRef<HTMLElement>(null);
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [bar, setBar] = useState({ top: 0, height: 0 });
  const [visible, setVisible] = useState<boolean[]>([]);

  // Abschnitte der Seite sammeln. Der Beobachter bemerkt Seitenwechsel,
  // nachladende Inhalte und Tab-Wechsel
  useEffect(() => {
    const main = navRef.current?.closest("main");
    if (!main) {
      return;
    }
    const collect = () => {
      // Nur Detailseiten bekommen ein Verzeichnis, nicht die Übersicht
      if (!main.querySelector("header[data-detail]")) {
        setEntries((previous) => (previous.length === 0 ? previous : []));
        return;
      }
      const sections = [
        ...main.querySelectorAll<HTMLElement>("section[data-toc-title]"),
      ].filter((section) => section.offsetParent !== null);
      setEntries((previous) => {
        const next = sections.map((element) => ({
          title: element.dataset.tocTitle ?? "",
          element,
        }));
        const same =
          previous.length === next.length &&
          previous.every(
            (entry, index) => entry.element === next[index]?.element,
          );
        return same ? previous : next;
      });
    };
    collect();
    const observer = new MutationObserver(collect);
    observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const measure = useCallback(() => {
    const nav = navRef.current;
    const scroller = nav?.closest<HTMLElement>("[data-slot=sidebar-inset]");
    if (!(nav && scroller) || entries.length < 3) {
      return;
    }
    const links = [...nav.querySelectorAll<HTMLElement>("a")];
    const box = scroller.getBoundingClientRect();
    const { top: navTop } = nav.getBoundingClientRect();
    const segments = entries.map((entry, index) => {
      const { top } = entry.element.getBoundingClientRect();
      const next = entries[index + 1];
      const bottom = next
        ? next.element.getBoundingClientRect().top
        : entry.element.getBoundingClientRect().bottom;
      const link = links[index]?.getBoundingClientRect();
      return {
        top,
        bottom,
        linkTop: link?.top ?? 0,
        linkHeight: link?.height ?? 0,
      };
    });
    const toNav = (pageY: number) => {
      const [first] = segments;
      const last = segments.at(-1);
      if (!(first && last)) {
        return 0;
      }
      if (pageY <= first.top) {
        return first.linkTop - navTop;
      }
      for (const segment of segments) {
        if (pageY <= segment.bottom) {
          const share =
            (pageY - segment.top) / Math.max(1, segment.bottom - segment.top);
          return segment.linkTop - navTop + share * segment.linkHeight;
        }
      }
      return last.linkTop + last.linkHeight - navTop;
    };
    const viewTop = box.top + HEADER_OFFSET;
    const from = toNav(viewTop);
    const to = toNav(box.bottom);
    setBar({ top: from, height: Math.max(4, to - from) });
    setVisible(
      segments.map(
        (segment) => segment.bottom > viewTop && segment.top < box.bottom,
      ),
    );
  }, [entries]);

  useEffect(() => {
    const scroller = navRef.current?.closest<HTMLElement>(
      "[data-slot=sidebar-inset]",
    );
    measure();
    scroller?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      scroller?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const shown = entries.length >= 3;

  return (
    <nav
      ref={navRef}
      className={cn(
        "sticky top-32 hidden w-50 shrink-0 self-start",
        shown && "min-[90rem]:grid",
      )}
    >
      {shown
        ? entries.map((entry, index) => (
            <a
              key={entry.title}
              href={`#${entry.element.id}`}
              onClick={(event) => {
                event.preventDefault();
                entry.element.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                });
              }}
              className={cn(
                "border-l-2 border-border py-1.25 pl-3.5 font-heading text-sm text-muted-foreground hover:text-foreground",
                visible[index] && "text-foreground",
              )}
            >
              {entry.title}
            </a>
          ))
        : null}
      {shown ? (
        <i
          aria-hidden={true}
          className="absolute left-0 w-0.5 rounded-full bg-limette-600 transition-[top,height] duration-75"
          style={{ top: bar.top, height: bar.height }}
        />
      ) : null}
    </nav>
  );
};
