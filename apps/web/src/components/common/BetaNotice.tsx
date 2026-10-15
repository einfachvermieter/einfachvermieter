import { useEffect, useState } from "react";
import { ExternalLink } from "@/components/common/ExternalLink";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  BETA_NOTICE_OPEN_EVENT,
  ISSUES_URL,
  isBetaNoticeSeen,
  markBetaNoticeSeen,
  showBetaMarker,
} from "@/lib/appVersion";
import { t } from "@/lib/i18n";

const REPORT_MAIL = "betatest@einfachvermieter.de";
/**
 * Hinweis auf die Vorabversion, einmal je Sitzung. In der Desktop-App ist
 * das jeder Programmstart, im Browser jede neue Sitzung. Mit
 * `autoOpen={false}` öffnet er sich nur per Klick auf das Beta-Kennzeichen:
 * Eine Status-, Sperr- oder Fehlerseite darf er beim Aufruf nicht verdecken.
 */
export const BetaNotice = ({ autoOpen = true }: { autoOpen?: boolean }) => {
  const [open, setOpen] = useState(
    () => autoOpen && showBetaMarker && !isBetaNoticeSeen(),
  );

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(BETA_NOTICE_OPEN_EVENT, show);
    return () => window.removeEventListener(BETA_NOTICE_OPEN_EVENT, show);
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      markBetaNoticeSeen();
    }
    setOpen(next);
  };

  if (!showBetaMarker) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("ui.beta.title")}</DialogTitle>
          <DialogDescription>{t("ui.beta.intro")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-start gap-1.5 text-sm">
          <p>{t("ui.beta.report")}</p>
          <ExternalLink href={`mailto:${REPORT_MAIL}`} label={REPORT_MAIL} />
          <ExternalLink href={ISSUES_URL} label={t("ui.beta.issues")} />
        </div>

        <DialogFooter>
          <DialogClose asChild={true}>
            <Button>{t("ui.beta.confirm")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
