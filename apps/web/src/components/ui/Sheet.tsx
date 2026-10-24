import { RiCloseLine } from "@remixicon/react";
import { Dialog as SheetPrimitive } from "radix-ui";
import {
  type ComponentProps,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Spätestens dann wird die Kopie eines hinausfahrenden Sheets entfernt;
 * normal geschieht das schon am Ende der Animation (`duration-240`)
 */
const SHEET_EXIT_MS = 300;

const Sheet = ({ ...props }: ComponentProps<typeof SheetPrimitive.Root>) => (
  <SheetPrimitive.Root data-slot="sheet" {...props} />
);

const SheetTrigger = ({
  ...props
}: ComponentProps<typeof SheetPrimitive.Trigger>) => (
  <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
);

const SheetClose = ({
  ...props
}: ComponentProps<typeof SheetPrimitive.Close>) => (
  <SheetPrimitive.Close data-slot="sheet-close" {...props} />
);

const SheetPortal = ({
  ...props
}: ComponentProps<typeof SheetPrimitive.Portal>) => (
  <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
);

const SheetOverlay = ({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Overlay>) => (
  <SheetPrimitive.Overlay
    data-slot="sheet-overlay"
    className={cn(
      "fixed inset-0 z-50 bg-schiefer-900/30 duration-240 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
      className,
    )}
    {...props}
  />
);

/**
 * Lässt ein Sheet beim Entfernen hinausfahren. Die Seiten entfernen Sheets
 * beim Schließen und nach dem Speichern sofort; dann fahren Kopien von
 * Sheet und Abdunklung hinaus. Schließt Radix selbst (Unterseite), steht
 * das Sheet schon auf "closed" und es gibt keine Kopie
 */
const useExitGhost = () => {
  // Radix zeichnet das Portal erst nach dem ersten Durchlauf; die Knoten
  // werden deshalb gemerkt, sobald es sie gibt
  const contentNode = useRef<HTMLDivElement | null>(null);
  const overlayNode = useRef<HTMLDivElement | null>(null);
  const contentRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      contentNode.current = node;
    }
  }, []);
  const overlayRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      overlayNode.current = node;
    }
  }, []);
  useLayoutEffect(() => {
    const contentHolder = contentNode;
    const overlayHolder = overlayNode;
    return () => {
      const content = contentHolder.current;
      if (content?.getAttribute("data-state") !== "open") {
        return;
      }
      const overlay = overlayHolder.current;
      queueMicrotask(() => {
        // Im StrictMode bleibt die Node beim Probe-Entfernen im Dokument
        if (content.isConnected) {
          return;
        }
        for (const node of [overlay, content]) {
          if (!node) {
            continue;
          }
          const ghost = node.cloneNode(true) as HTMLElement;
          ghost.inert = true;
          ghost.setAttribute("aria-hidden", "true");
          ghost.style.pointerEvents = "none";
          // Am Ende der Animation stehen bleiben, sonst springt die Kopie
          // vor dem Entfernen kurz an ihre Ausgangsstelle zurück
          ghost.style.animationFillMode = "forwards";
          for (const element of [
            ghost,
            ...ghost.querySelectorAll("[data-state]"),
          ]) {
            element.setAttribute("data-state", "closed");
          }
          document.body.append(ghost);
          ghost.addEventListener("animationend", (event) => {
            if (event.target === ghost) {
              ghost.remove();
            }
          });
          // Falls keine Animation läuft (z. B. reduzierte Bewegung)
          window.setTimeout(() => ghost.remove(), SHEET_EXIT_MS);
        }
      });
    };
  }, []);
  return { contentRef, overlayRef, contentNode };
};

const SheetContent = ({
  className,
  children,
  side = "right",
  size = "default",
  showCloseButton = true,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";

  /**
   * "form": breiteres Sheet für Formulare; wächst auf großen Bildschirmen
   */
  size?: "default" | "form";
  showCloseButton?: boolean;
}) => {
  const { contentRef, overlayRef, contentNode } = useExitGhost();
  return (
    <SheetPortal>
      <SheetOverlay ref={overlayRef} />
      <SheetPrimitive.Content
        ref={contentRef}
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-sheet transition duration-240 ease-out data-[side=right]:overflow-hidden data-[side=right]:rounded-l-xl data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right data-[side=top]:data-closed:slide-out-to-top-10",
          size === "default" &&
            "data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          size === "form" &&
            "data-[side=left]:sm:max-w-sheet-form data-[side=right]:sm:max-w-sheet-form",
          className,
        )}
        {...props}
        onOpenAutoFocus={(event) => {
          props.onOpenAutoFocus?.(event);
          if (event.defaultPrevented) {
            return;
          }
          // Fokus ins erste Eingabefeld statt auf das erste bedienbare
          // Element (oft ein Fragezeichen, dessen Tooltip sonst aufgeht);
          // ohne Feld auf das Sheet selbst
          event.preventDefault();
          const content = contentNode.current;
          const field = content?.querySelector<HTMLElement>(
            // Auswahllisten, Schalter und Kästchen von Radix sind Tasten mit
            // eigener Rolle; ihre versteckten Hilfsfelder tragen
            // aria-hidden und tabindex=-1 und fallen heraus. Eine
            // Radio-Gruppe zählt ihre Einträge erst nach dem Öffnen und
            // trägt bis dahin selbst tabindex=-1, daher ohne diese Bedingung
            ':is(input:not([type=hidden]), select, textarea, [role=combobox], [role=switch], [role=checkbox]):not(:disabled, [data-disabled], [aria-hidden=true], [tabindex="-1"]), [role=radiogroup]:not([data-disabled])',
          );
          // In einer Radio-Gruppe bekommt die gewählte Möglichkeit den
          // Fokus, sonst die erste
          const target =
            field?.getAttribute("role") === "radiogroup"
              ? (field.querySelector<HTMLElement>(
                  "[role=radio][data-state=checked]:not(:disabled)",
                ) ??
                field.querySelector<HTMLElement>("[role=radio]:not(:disabled)"))
              : field;
          (target ?? content)?.focus({ preventScroll: true });
        }}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild={true}>
            <Button
              variant="ghost"
              className="absolute top-4 right-4"
              size="icon-sm"
            >
              <RiCloseLine />
              <span className="sr-only">{t("ui.common.action.close")}</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
};

const SheetHeader = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="sheet-header"
    className={cn("flex flex-col gap-1.5 p-4", className)}
    {...props}
  />
);

const SheetFooter = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="sheet-footer"
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
);

const SheetTitle = ({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Title>) => (
  <SheetPrimitive.Title
    data-slot="sheet-title"
    className={cn(
      "flex min-h-8 items-center gap-2.5 font-heading text-lg font-semibold text-foreground",
      className,
    )}
    {...props}
  />
);

const SheetDescription = ({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>) => (
  <SheetPrimitive.Description
    data-slot="sheet-description"
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
);

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
