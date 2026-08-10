import { RiDeleteBinLine } from "@remixicon/react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { TextInput } from "@/components/form/TextInput";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/Field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/InputGroup";
import { t } from "@/lib/i18n";

type ApiKeyFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  /**
   * Verdeckte Anzeigefassung des gespeicherten API-Keys. Ist sie gesetzt,
   * zeigt das Feld den hinterlegten Key statt einer Eingabe.
   */
  preview: string | null;
  /**
   * Entfernt den gespeicherten API-Key und schaltet auf Eingabe um. Das
   * Löschen wird erst mit dem Speichern wirksam.
   */
  onClear: () => void;
  /**
   * Ob auch ein leeres Eingabefeld genügt, weil bereits ein API-Key aus der
   * Umgebung bereitsteht.
   */
  optional: boolean;
};

/**
 * Eingabe für den API-Key des Anbieters. Ist bereits einer gespeichert,
 * erscheint er verdeckt und schreibgeschützt mit einem Löschen-Knopf im
 * Feld; erst danach lässt sich ein neuer eintragen.
 */
export const ApiKeyField = <T extends FieldValues>({
  control,
  name,
  preview,
  onClear,
  optional,
}: ApiKeyFieldProps<T>) => {
  if (preview === null) {
    return (
      <TextInput
        control={control}
        name={name}
        type="password"
        autoComplete="off"
        label={t("ui.settings.ai.fields.apiKey")}
        optional={optional}
      />
    );
  }

  return (
    <Field>
      <FieldLabel>{t("ui.settings.ai.fields.apiKey")}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          value={preview}
          readOnly={true}
          // Der angezeigte Wert ist bereits verdeckt und gehört nicht in
          // die Passwortverwaltung des Browsers.
          autoComplete="off"
          aria-label={t("ui.settings.ai.fields.apiKey")}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            onClick={onClear}
            aria-label={t("ui.settings.ai.fields.removeApiKey")}
            title={t("ui.settings.ai.fields.removeApiKey")}
          >
            <RiDeleteBinLine />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription>
        {t("ui.settings.ai.fields.apiKeyStoredDescription")}
      </FieldDescription>
    </Field>
  );
};
