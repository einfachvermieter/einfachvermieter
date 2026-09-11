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
import { BETA_NOTICE_OPEN_EVENT, isPrerelease } from "@/lib/appVersion";
import { t } from "@/lib/i18n";

const REPORT_MAIL = "betatest@einfachvermieter.de";
const ISSUES_URL =
  "https://github.com/einfachvermieter/einfachvermieter/issues";
const SESSION_KEY = "betaNoticeSeen";

const readSeen = (): boolean => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
};

const writeSeen = (): void => {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // ohne Speicher kein Merken
  }
};

/**
 * Hinweis auf die Vorabversion, einmal je Sitzung. In der Desktop-App ist
 * das jeder Programmstart, im Browser jede neue Sitzung.
 */
export const BetaNotice = () => {
  const [open, setOpen] = useState(() => isPrerelease && !readSeen());

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(BETA_NOTICE_OPEN_EVENT, show);
    return () => window.removeEventListener(BETA_NOTICE_OPEN_EVENT, show);
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      writeSeen();
    }
    setOpen(next);
  };

  if (!isPrerelease) {
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
