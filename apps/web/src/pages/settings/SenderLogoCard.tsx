import {
  type SenderSettingsUpdateDto,
  senderLogoAlignments,
  senderLogoModes,
  senderLogoScalePercents,
  type senderSettingsUpdateSchema,
} from "@einfachvermieter/shared";
import {
  RiImageLine,
  RiProhibitedLine,
  RiRoadMapLine,
  RiUpload2Line,
} from "@remixicon/react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { SectionCard } from "@/components/common/SectionCard";
import { ChoiceTilesInput } from "@/components/form/ChoiceTilesInput";
import { SelectInput } from "@/components/form/SelectInput";
import { t } from "@/lib/i18n";
import type { PendingLogo, SenderSettings } from "@/lib/senderSettings";
import type { SenderLetterValues } from "./SenderLetterPreview";
import { SenderLogoSection } from "./SenderLogoSection";

const LOGO_MODE_ICONS = {
  own: RiUpload2Line,
  app: RiRoadMapLine,
  none: RiProhibitedLine,
} as const;

/**
 * Karte "Firmenlogo": Auswahl der Darstellung, Ausrichtung und Größe,
 * darunter die Briefkopf-Vorschau mit den Hochladen-Aktionen.
 */
export const SenderLogoCard = ({
  form,
  settings,
  letterValues,
  pendingLogo,
  onPendingLogoChange,
  logoVersion,
}: {
  form: UseFormReturn<
    z.input<typeof senderSettingsUpdateSchema>,
    unknown,
    SenderSettingsUpdateDto
  >;
  settings: SenderSettings;
  letterValues: SenderLetterValues;
  pendingLogo: PendingLogo;
  onPendingLogoChange: (pending: PendingLogo) => void;
  logoVersion: string;
}) => {
  const logoMode = form.watch("logoMode");

  return (
    <SectionCard
      icon={RiImageLine}
      title={t("ui.settings.sender.logo.title")}
      description={t("ui.settings.sender.logo.description")}
    >
      <div className="flex flex-col gap-4">
        <ChoiceTilesInput
          control={form.control}
          name="logoMode"
          label={t("ui.settings.sender.fields.logoMode")}
          options={senderLogoModes.map((mode) => ({
            value: mode,
            icon: LOGO_MODE_ICONS[mode],
            title: t(`ui.settings.sender.logoModes.${mode}.title`),
            description: t(`ui.settings.sender.logoModes.${mode}.description`),
          }))}
          columns={3}
        />
        {logoMode === "none" ? null : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectInput
              control={form.control}
              name="logoAlignment"
              label={t("ui.settings.sender.fields.logoAlignment")}
              options={senderLogoAlignments.map((value) => ({
                value,
                label: t(`ui.settings.sender.logoAlignments.${value}`),
              }))}
            />
            <SelectInput
              control={form.control}
              name="logoScalePercent"
              label={t("ui.settings.sender.fields.logoScalePercent")}
              options={senderLogoScalePercents.map((percent) => ({
                value: String(percent),
                label: t("ui.settings.sender.logoScaleOption", { percent }),
              }))}
            />
          </div>
        )}
        <SenderLogoSection
          settings={settings}
          letterValues={letterValues}
          logoMode={logoMode}
          logoAlignment={form.watch("logoAlignment")}
          logoScalePercent={Number(form.watch("logoScalePercent"))}
          pendingLogo={pendingLogo}
          onPendingLogoChange={onPendingLogoChange}
          logoVersion={logoVersion}
        />
      </div>
    </SectionCard>
  );
};
