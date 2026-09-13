import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { t } from "@/lib/i18n";

export type InternetRecommendation =
  | "climateFactors"
  | "updateCheck"
  | "telemetry";

/**
 * Nachfrage am Ende des Einrichtungs-Assistenten, sobald einer der
 * empfohlenen Internetzugriffe aus ist: nennt zu jedem abgeschalteten Punkt
 * die Folge.
 */
export const InternetRecommendationDialog = ({
  open,
  onOpenChange,
  missing,
  onKeep,
  onAccept,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missing: InternetRecommendation[];
  onKeep: () => void;
  onAccept: () => void;
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent size="default">
      <AlertDialogHeader>
        <AlertDialogTitle>
          {t("ui.setup.internet.confirm.title")}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {missing.length === 1
            ? t("ui.setup.internet.confirm.introOne")
            : t("ui.setup.internet.confirm.introMany")}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <ul className="flex flex-col gap-3 text-sm">
        {missing.map((key) => (
          <li key={key} className="flex flex-col gap-0.5">
            <span className="font-semibold text-foreground">
              {t(`ui.setup.internet.confirm.${key}.title`)}
            </span>
            <span className="text-muted-foreground">
              {t(`ui.setup.internet.confirm.${key}.text`)}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-sm text-muted-foreground font-semibold">
        {t("ui.setup.internet.confirm.footnote")}
      </p>

      <AlertDialogFooter>
        <AlertDialogCancel variant="default" onClick={onKeep}>
          {t("ui.setup.internet.confirm.keep")}
        </AlertDialogCancel>
        <AlertDialogAction variant="default" onClick={onAccept}>
          {t("ui.setup.internet.confirm.accept")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
