import {
  type HeatingFormValues,
  isSeventyPercentFuel,
  seventyPercentOutcome,
} from "@einfachvermieter/shared";
import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { ChoiceTiles } from "@/components/form/ChoiceTiles";
import { SubSheet } from "@/components/form/SubSheet";
import { SubSheetRow } from "@/components/form/SubSheetRow";
import { HelpHint } from "@/components/help/HelpHint";
import { Field, FieldLabel } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import { type Answer, AnswerTiles } from "./AnswerTiles";
import { ResultNote } from "./ResultNote";

/**
 * "70 % Verbrauchsanteil zwingend" als SubSheet. Nur bei Öl oder Gas; die
 * App fragt die beiden übrigen Tatsachen ab und zieht den Schluss selbst. Ist
 * es unklar, entscheidet der Nutzer. Gespeichert werden die Antworten und,
 * maßgeblich für die Berechnung, ob 70 % gelten
 */
export const SeventyPercentSection = ({
  form,
}: {
  form: UseFormReturn<HeatingFormValues>;
}) => {
  const fuelType = form.watch("fuelType");
  const applies = isSeventyPercentFuel(fuelType);
  const mandatory = form.watch("mandatorySeventyPercent");
  const [open, setOpen] = useState(false);
  const [insulation, setInsulation] = useState<Answer>(null);
  const [pipes, setPipes] = useState<Answer>(null);
  const [pick, setPick] = useState<"seventy" | "free">("free");

  // Bei anderen Brennstoffen gibt es die Vorgabe nicht
  useEffect(() => {
    if (!applies && form.getValues("mandatorySeventyPercent")) {
      form.setValue("mandatorySeventyPercent", false, { shouldDirty: true });
    }
  }, [applies, form]);

  if (!applies) {
    return null;
  }

  const result = seventyPercentOutcome(insulation, pipes);
  const savedInsulation = form.watch("seventyInsulationAnswer");
  const savedPipes = form.watch("seventyPipesAnswer");
  const savedUnclear =
    savedInsulation !== null &&
    savedPipes !== null &&
    seventyPercentOutcome(savedInsulation, savedPipes) === "unclear";
  let rowValue = mandatory ? t("common.yes") : t("common.no");
  if (mandatory && savedUnclear) {
    rowValue = t("ui.heating.seventy.valueUnclearSeventy");
  }

  // Ohne gespeicherte Antworten bleiben die Fragen offen, statt sie aus dem
  // Switch zu erraten
  const openSheet = () => {
    setInsulation(form.getValues("seventyInsulationAnswer"));
    setPipes(form.getValues("seventyPipesAnswer"));
    setPick(form.getValues("mandatorySeventyPercent") ? "seventy" : "free");
    setOpen(true);
  };
  const apply = () => {
    const fixed =
      result === "must" || (result === "unclear" && pick === "seventy");
    form.setValue("seventyInsulationAnswer", insulation, { shouldDirty: true });
    form.setValue("seventyPipesAnswer", pipes, { shouldDirty: true });
    form.setValue("mandatorySeventyPercent", fixed, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (fixed) {
      form.setValue("consumptionSharePercent", "70", { shouldDirty: true });
      form.setValue("baseSharePercent", "30", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    setOpen(false);
  };

  return (
    <>
      <SubSheetRow
        label={t("ui.heating.seventy.title")}
        value={rowValue}
        actionLabel={t("ui.common.action.check")}
        onOpen={openSheet}
      />
      <SubSheet
        open={open}
        title={t("ui.heating.seventy.title")}
        description={t("ui.heating.seventy.intro")}
        onBack={() => setOpen(false)}
        onApply={apply}
      >
        <Field>
          <FieldLabel>
            {t("ui.heating.seventy.insulationQuestion")}
            <HelpHint>{t("ui.heating.seventy.insulationHelp")}</HelpHint>
          </FieldLabel>
          <AnswerTiles value={insulation} onValueChange={setInsulation} />
        </Field>
        <Field>
          <FieldLabel>{t("ui.heating.seventy.pipesQuestion")}</FieldLabel>
          <AnswerTiles value={pipes} onValueChange={setPipes} />
        </Field>
        <ResultNote
          title={t(`ui.heating.seventy.${result}Title`)}
          text={t(`ui.heating.seventy.${result}Text`)}
        />
        {result === "unclear" ? (
          <ChoiceTiles
            columns={1}
            value={pick}
            onValueChange={(next) => setPick(next as "seventy" | "free")}
            options={[
              {
                value: "seventy",
                title: t("ui.heating.seventy.pickSeventy"),
                description: t("ui.heating.seventy.pickSeventyText"),
              },
              {
                value: "free",
                title: t("ui.heating.seventy.pickFree"),
                description: t("ui.heating.seventy.pickFreeText"),
              },
            ]}
          />
        ) : null}
      </SubSheet>
    </>
  );
};
