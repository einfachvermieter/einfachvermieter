import type { HeatingFormValues, HeatingMode } from "@einfachvermieter/shared";
import type { UseFormReturn } from "react-hook-form";
import { SwitchInput } from "@/components/form/SwitchInput";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { t } from "../../../../lib/i18n";

/**
 * Schalter für die § 6a-Informationsseite, nur im externen Modus sichtbar.
 * Beim Abwählen erscheint ein Warnhinweis.
 */
export const ExternalBillingInfoToggle = ({
  form,
  mode,
}: {
  form: UseFormReturn<HeatingFormValues>;
  mode: HeatingMode;
}) => {
  const includeBillingInfo = form.watch("includeBillingInfo");

  if (mode !== "external") {
    return null;
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <SwitchInput
        control={form.control}
        name="includeBillingInfo"
        label={t("ui.heating.fields.includeBillingInfo")}
        description={t("ui.heating.fields.includeBillingInfoDescription")}
      />
      {includeBillingInfo ? null : (
        <Alert variant="warning">
          <AlertDescription>
            {t("ui.heating.fields.includeBillingInfoWarning")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
