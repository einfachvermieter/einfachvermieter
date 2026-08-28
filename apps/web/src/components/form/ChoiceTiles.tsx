import type { RemixiconComponentType } from "@remixicon/react";
import type { ReactNode } from "react";
import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/RadioGroup";

export type ChoiceTileOption = {
  value: string;
  icon?: RemixiconComponentType;
  /**
   * Freier Bildinhalt anstelle des Icons, etwa ein Anbieter-Logo.
   * Wird er nicht eingefärbt.
   */
  media?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

/**
 * Vorangestelltes Bildelement einer Kachel: freier Inhalt hat Vorrang vor
 * dem Icon, damit Logos ihre eigenen Farben behalten.
 */
const tileLeading = (option: ChoiceTileOption): ReactNode => {
  if (option.media) {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center">
        {option.media}
      </span>
    );
  }

  if (!option.icon) {
    // Ohne Icon ein Radio-Indikator (rein dekorativ),
    // sonst sicht es aus wie eine KPI-Card
    return (
      <span
        data-slot="tile-radio"
        aria-hidden={true}
        className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-background transition"
      >
        <span
          data-slot="tile-radio-dot"
          className="size-2 rounded-full bg-white opacity-0"
        />
      </span>
    );
  }

  const Icon = option.icon;
  return (
    <Icon
      data-slot="tile-icon"
      className="size-4.25 shrink-0 text-muted-foreground"
    />
  );
};

/**
 * Auswahl als getönte Radio-Kacheln (Icon, Titel, Beschreibung). Für
 * Formularfelder gibt es die Variante `ChoiceTilesInput`.
 */
export const ChoiceTiles = ({
  value,
  onValueChange,
  options,
  columns = 2,
  disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: ChoiceTileOption[];
  columns?: 1 | 2 | 3;
  disabled?: boolean;
}) => {
  const baseId = useId();

  return (
    <RadioGroup
      columns={columns}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      {options.map((option) => {
        const optionId = `${baseId}-${option.value}`;
        return (
          <label
            key={option.value}
            htmlFor={optionId}
            className="block cursor-pointer rounded-lg border-[1.5px] border-border bg-card px-4 py-3.5 transition has-data-checked:border-azur-700 has-data-checked:bg-azur-50 has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60 has-data-checked:**:data-[slot=tile-icon]:text-azur-700 has-data-checked:**:data-[slot=tile-title]:text-foreground has-data-checked:**:data-[slot=tile-radio]:border-azur-700 has-data-checked:**:data-[slot=tile-radio]:bg-azur-700 has-data-checked:**:data-[slot=tile-radio-dot]:opacity-100"
          >
            <RadioGroupItem
              id={optionId}
              value={option.value}
              disabled={option.disabled}
              className="absolute size-px opacity-0"
            />
            <span
              data-slot="tile-title"
              className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"
            >
              {tileLeading(option)}
              {option.title}
            </span>
            {option.description ? (
              <span className="mt-1 block text-sm leading-normal text-muted-foreground">
                {option.description}
              </span>
            ) : null}
          </label>
        );
      })}
    </RadioGroup>
  );
};
