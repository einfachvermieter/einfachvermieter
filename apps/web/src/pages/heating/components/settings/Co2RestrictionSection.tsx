import {
  CO2_RESTRICTION_EVIDENCE_NOTE_MAX_LENGTH,
  co2RestrictionScope,
  type HeatingFormValues,
} from "@einfachvermieter/shared";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { SubSheet } from "@/components/form/SubSheet";
import { SubSheetRow } from "@/components/form/SubSheetRow";
import { TextareaInput } from "@/components/form/TextareaInput";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/Field";
import { t } from "../../../../lib/i18n";
import { type Answer, AnswerTiles } from "./AnswerTiles";
import { ResultNote } from "./ResultNote";

/**
 * Beschränkung nach § 9 CO2KostAufG als SubSheet: Statt der Rechtsfolge
 * fragt sie nach dem Anlass (Gebäude, Versorgung). "Weiß ich nicht" rechnet
 * ohne Beschränkung, weil man sich nur auf eine nachgewiesene berufen kann.
 * Gespeichert werden die Antworten und, maßgeblich für die Berechnung, die
 * beiden Schalter
 */
export const Co2RestrictionSection = ({
  form,
}: {
  form: UseFormReturn<HeatingFormValues>;
}) => {
  const [open, setOpen] = useState(false);
  const [building, setBuilding] = useState<Answer>(null);
  const [supply, setSupply] = useState<Answer>(null);
  const [snapshotNote, setSnapshotNote] = useState("");

  const scope = co2RestrictionScope(
    form.watch("co2BuildingRestricted"),
    form.watch("co2SupplyRestricted"),
  );

  // Ohne gespeicherte Antwort zählt nur ein gesetzter Schalter als "Ja“;
  // ein nicht gesetzter wird nicht zum "Nein“, die Frage bleibt offen
  const initialAnswer = (saved: Answer, restricted: boolean): Answer => {
    if (saved !== null) {
      return saved;
    }
    return restricted ? "yes" : null;
  };
  const openSheet = () => {
    setBuilding(
      initialAnswer(
        form.getValues("co2BuildingRestrictionAnswer"),
        form.getValues("co2BuildingRestricted"),
      ),
    );
    setSupply(
      initialAnswer(
        form.getValues("co2SupplyRestrictionAnswer"),
        form.getValues("co2SupplyRestricted"),
      ),
    );
    setSnapshotNote(form.getValues("co2RestrictionEvidenceNote"));
    setOpen(true);
  };
  const back = () => {
    form.setValue("co2RestrictionEvidenceNote", snapshotNote);
    setOpen(false);
  };
  const apply = () => {
    form.setValue("co2BuildingRestrictionAnswer", building, {
      shouldDirty: true,
    });
    form.setValue("co2SupplyRestrictionAnswer", supply, { shouldDirty: true });
    form.setValue("co2BuildingRestricted", building === "yes", {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("co2SupplyRestricted", supply === "yes", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setOpen(false);
  };

  const yesCount = [building, supply].filter(
    (answer) => answer === "yes",
  ).length;
  let result: "none" | "open" | "one" | "both" = "none";
  if (yesCount === 2) {
    result = "both";
  } else if (yesCount === 1) {
    result = "one";
  } else if (building !== "no" || supply !== "no") {
    // Unbeantwortet zählt wie "Weiß ich nicht“
    result = "open";
  }

  return (
    <>
      <SubSheetRow
        label={t("ui.heating.restriction.title")}
        value={t(`ui.heating.fields.co2Restriction${scope}`)}
        actionLabel={t("ui.common.action.check")}
        onOpen={openSheet}
      />
      <SubSheet
        open={open}
        title={t("ui.heating.restriction.title")}
        description={t("ui.heating.restriction.intro")}
        onBack={back}
        onApply={apply}
      >
        <Field>
          <FieldLabel>
            {t("ui.heating.restriction.buildingQuestion")}
          </FieldLabel>
          <AnswerTiles value={building} onValueChange={setBuilding} />
          <FieldDescription>
            {t("ui.heating.restriction.buildingExample")}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel>{t("ui.heating.restriction.supplyQuestion")}</FieldLabel>
          <AnswerTiles value={supply} onValueChange={setSupply} />
          <FieldDescription>
            {t("ui.heating.restriction.supplyExample")}
          </FieldDescription>
        </Field>
        <ResultNote
          title={t(`ui.heating.restriction.${result}Title`)}
          text={t(`ui.heating.restriction.${result}Text`)}
        />
        {yesCount > 0 ? (
          <TextareaInput
            control={form.control}
            name="co2RestrictionEvidenceNote"
            label={t("ui.heating.fields.co2RestrictionEvidenceNote")}
            description={t(
              "ui.heating.fields.co2RestrictionEvidenceNoteDescription",
            )}
            labelHelp={t("ui.heating.fields.co2RestrictionEvidenceNoteHelp")}
            maxLength={CO2_RESTRICTION_EVIDENCE_NOTE_MAX_LENGTH}
            rows={4}
          />
        ) : null}
      </SubSheet>
    </>
  );
};
