import type { HeatingFactAnswer } from "@einfachvermieter/shared";
import { ChoiceTiles } from "@/components/form/ChoiceTiles";
import { t } from "../../../../lib/i18n";

/**
 * NULL, solange die Frage nicht beantwortet ist: Dann ist kein Button
 * gewählt
 */
export type Answer = HeatingFactAnswer | null;

/**
 * Antwort auf eine Tatsachenfrage: Ja, Nein oder Weiß ich nicht
 */
export const AnswerTiles = ({
  value,
  onValueChange,
}: {
  value: Answer;
  onValueChange: (value: HeatingFactAnswer) => void;
}) => (
  <ChoiceTiles
    columns={3}
    value={value ?? ""}
    onValueChange={(next) => onValueChange(next as HeatingFactAnswer)}
    options={[
      { value: "yes", title: t("common.yes") },
      { value: "no", title: t("common.no") },
      { value: "unknown", title: t("ui.common.action.unknownAnswer") },
    ]}
  />
);
