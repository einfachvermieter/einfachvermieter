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
const tileLeading = (
  option: ChoiceTileOption,
  showIcons: boolean,
): ReactNode => {
  if (option.media) {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center">
        {option.media}
      </span>
    );
  }

  if (showIcons && option.icon) {
    const Icon = option.icon;
    return (
      <Icon
        data-slot="tile-icon"
        className="size-4.25 shrink-0 text-muted-foreground"
      />
    );
  }

  // Sonst ein Radio-Indikator (rein dekorativ), damit die Card nicht wie
  // eine Kennzahl aussieht
  return (
    <span
      data-slot="tile-radio"
      aria-hidden={true}
      className="flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] border-schiefer-300 bg-white transition"
    >
      <span
        data-slot="tile-radio-dot"
        className="size-2 rounded-full bg-azur-700 opacity-0"
      />
    </span>
  );
};

/**
 * Auswahl als farbige Radio-Kacheln (Icon, Titel, Beschreibung). Für
 * Formularfelder gibt es die Variante `ChoiceTilesInput`.
 */
export const ChoiceTiles = ({
  value,
  onValueChange,
  options,
  columns = 2,
  disabled = false,
  showIcons = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: ChoiceTileOption[];
  columns?: 1 | 2 | 3;
  disabled?: boolean;
  /**
   * Icons der Optionen zeigen. Aus in Sheets (dort vorerst keine Icons),
   * an auf Seiten
   */
  showIcons?: boolean;
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
            data-slot="choice-tile"
            className="block rounded-lg border border-edge bg-white px-3.5 py-3 shadow-key transition-[transform,box-shadow,background-color] duration-75 hover:bg-schiefer-50 has-data-checked:translate-y-0.5 has-data-checked:border-azur-700 has-data-checked:bg-azur-50 has-data-checked:shadow-none has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60 has-data-checked:**:data-[slot=tile-icon]:text-azur-700 has-data-checked:**:data-[slot=tile-title]:text-azur-900 has-data-checked:**:data-[slot=tile-description]:text-azur-900 has-data-checked:**:data-[slot=tile-radio]:border-azur-700 has-data-checked:**:data-[slot=tile-radio-dot]:opacity-100"
          >
            <RadioGroupItem
              id={optionId}
              value={option.value}
              disabled={option.disabled}
              className="absolute size-px opacity-0"
            />
            <span
              data-slot="tile-title"
              className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground"
            >
              {tileLeading(option, showIcons)}
              {option.title}
            </span>
            {option.description ? (
              <span
                data-slot="tile-description"
                className="mt-1 block text-sm leading-normal text-muted-foreground"
              >
                {option.description}
              </span>
            ) : null}
          </label>
        );
      })}
    </RadioGroup>
  );
};
