import type { UpdateMessage } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ExternalLink } from "@/components/common/ExternalLink";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  BETA_NOTICE_SEEN_EVENT,
  isBetaNoticeSeen,
  showBetaMarker,
} from "@/lib/appVersion";
import { useCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { updateStatusQueryOptions } from "@/lib/updates";

/**
 * `once` gilt je Browser oder Desktop-Installation, `session` je Sitzung
 * (in der Desktop-App jeder Programmstart).
 */
const storageFor = (message: UpdateMessage): Storage =>
  message.display === "once" ? localStorage : sessionStorage;

const seenKey = (message: UpdateMessage): string =>
  `updateMessageSeen:${message.id}`;

const readSeen = (message: UpdateMessage): boolean => {
  try {
    return storageFor(message).getItem(seenKey(message)) === "1";
  } catch {
    return false;
  }
};

const writeSeen = (message: UpdateMessage): void => {
  try {
    storageFor(message).setItem(seenKey(message), "1");
  } catch {
    // ohne Speicher kein Merken
  }
};

/**
 * Mitteilungen des Projektservers zur installierten Version, nacheinander
 * in einem Dialog. Wartet, bis der Beta-Hinweis geschlossen ist. Der Text
 * kommt von außen und wird nur als reiner Text gesetzt.
 */
export const UpdateMessages = () => {
  const { data: user } = useCurrentUser();
  const { data } = useQuery({
    ...updateStatusQueryOptions,
    enabled: user?.role === "admin",
  });
  const [betaNoticePending, setBetaNoticePending] = useState(
    () => showBetaMarker && !isBetaNoticeSeen(),
  );
  // Hält geschlossene Mitteilungen auch dann fest, wenn der Speicher fehlt
  const [closedIds, setClosedIds] = useState<string[]>([]);

  useEffect(() => {
    const release = () => setBetaNoticePending(false);
    window.addEventListener(BETA_NOTICE_SEEN_EVENT, release);
    return () => window.removeEventListener(BETA_NOTICE_SEEN_EVENT, release);
  }, []);

  const message = betaNoticePending
    ? undefined
    : data?.messages.find(
        (candidate) =>
          !closedIds.includes(candidate.id) && !readSeen(candidate),
      );

  if (!message) {
    return null;
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      writeSeen(message);
      setClosedIds((ids) => [...ids, message.id]);
    }
  };

  return (
    <Dialog key={message.id} open={true} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{message.title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-start gap-3 text-sm">
          {message.body.split(/\n{2,}/u).map((paragraph, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fester Text, Absätze können gleich lauten
            <p key={index} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
          {message.link ? (
            <ExternalLink href={message.link.url} label={message.link.label} />
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild={true}>
            <Button>{message.closeLabel ?? t("ui.common.action.close")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
