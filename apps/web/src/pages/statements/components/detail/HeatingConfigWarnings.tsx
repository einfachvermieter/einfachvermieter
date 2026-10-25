import {
  type CalcWarning,
  formatWarningParams,
} from "@einfachvermieter/shared";
import { DomainLink } from "@/components/common/DomainLink";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { t } from "../../../../lib/i18n";

/**
 * Hinweise zur Heizkostenkonfiguration im Abrechnungszeitraum, etwa eine
 * nicht berücksichtigte spätere Version oder ein Wechsel, der das
 * Finalisieren sperrt, je mit Link zur Konfiguration des Gebäudes
 */
export const HeatingConfigWarnings = ({
  warnings,
  buildingId,
}: {
  warnings: CalcWarning[];
  buildingId: string;
}) => (
  <section className="space-y-2">
    {warnings.map((warning) => (
      <Alert
        key={`${warning.code}-${JSON.stringify(warning.params)}`}
        variant="warning"
      >
        <AlertDescription>
          <p>
            {t(`warnings.${warning.code}`, formatWarningParams(warning.params))}
          </p>
          <div className="mt-2">
            <DomainLink to="/heizkosten" search={{ buildingId }}>
              {t("ui.statements.detail.openHeatingConfig")}
            </DomainLink>
          </div>
        </AlertDescription>
      </Alert>
    ))}
  </section>
);
