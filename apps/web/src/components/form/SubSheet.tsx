import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { t } from "../../lib/i18n";

/**
 * SubSheet eines Formular-Sheets für eine Einzelentscheidung oder eine
 * Gruppe selten gebrauchter Angaben. Legt sich als zweites Sheet über das
 * erste; das erste rückt nach links und wird etwas dunkler (index.css).
 * Die Felder gehören zum Formular des ersten Sheets. "Zurück" verwirft die
 * Änderungen des SubSheets, "Übernehmen" behält sie
 */
export const SubSheet = ({
  open,
  title,
  description,
  onBack,
  onApply,
  children,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  onBack: () => void;
  onApply: () => void;
  children: ReactNode;
}) => (
  <Sheet
    open={open}
    onOpenChange={(next) => {
      if (!next) {
        onBack();
      }
    }}
  >
    <SheetContent
      size="form"
      data-sub={true}
      showCloseButton={false}
      className="gap-0"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover px-7 py-4.5">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex min-w-0 flex-col gap-6 px-7 pt-6 pb-8">
          {description ? (
            <SheetDescription className="text-foreground">
              {description}
            </SheetDescription>
          ) : null}
          {children}
        </div>
        <SheetFooter className="sticky bottom-0 mt-auto flex-row justify-end border-t border-border bg-azur-50 px-7 py-4">
          <Button type="button" variant="secondary" onClick={onBack}>
            {t("ui.common.action.back")}
          </Button>
          <Button type="button" onClick={onApply}>
            {t("ui.common.action.apply")}
          </Button>
        </SheetFooter>
      </div>
    </SheetContent>
  </Sheet>
);
