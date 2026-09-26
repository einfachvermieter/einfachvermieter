import { Alert, AlertDescription } from "@/components/ui/Alert";
import { t } from "../../../../lib/i18n";
import {
  type SubstitutionPreview,
  substitutionPreviewText,
} from "../../../../lib/substitutions";

/**
 * Vorschau des Ersatzverbrauchs mit Rechenweg und Hinweisen zur Grundlage
 */
export const SubstitutionPreviewAlert = ({
  preview,
  formatAmount,
}: {
  preview: SubstitutionPreview | undefined;
  formatAmount: (value: number) => string;
}) => {
  const text = preview ? substitutionPreviewText(preview, formatAmount) : null;

  return (
    <Alert variant="info">
      <AlertDescription>
        <p className="font-semibold">{t("ui.substitutions.preview.title")}</p>
        <p>{text ?? t("ui.substitutions.preview.pending")}</p>
        {preview?.warnings.map((warning) => (
          <p key={`${warning.code}|${warning.params?.label ?? ""}`}>
            {t(`warnings.${warning.code}`, warning.params ?? {})}
          </p>
        ))}
        {preview?.limitExceeded ? (
          <p>{t("ui.substitutions.preview.limitExceeded")}</p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
};
