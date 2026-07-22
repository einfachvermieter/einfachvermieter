import { gradients } from "@/lib/domainVisuals";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  29: "size-[29px] rounded-[9px] text-xs",
  34: "size-[34px] rounded-[10px] text-[13px]",
  36: "size-9 rounded-[10px] text-[13px]",
  44: "size-11 rounded-[13px] text-[15px] shadow-[0_8px_16px_-8px_rgba(13,148,136,0.45)]",
  64: "size-16 rounded-[18px] text-[22px]",
} as const;

/**
 * Initialen aus den ersten beiden Buchstaben-Wörtern des Namens; bei nur
 * einem Wort dessen erste zwei Zeichen ("Gartenstadt 12" -> "GA").
 */
const initialsOf = (name: string): string => {
  const words = name.split(/\s+/u).filter((word) => /^\p{L}/u.test(word));
  if (words.length >= 2) {
    return words
      .slice(0, 2)
      .map((word) => (word[0] ?? "").toUpperCase())
      .join("");
  }
  const single = words[0] ?? name.trim();

  return single.slice(0, 2).toUpperCase();
};

/**
 * Initialen-Avatar für Personen und Gebäude (Tabellenzeilen, Hero,
 * Gebäude-Switcher). Hintergrund ist ein Verlauf
 */
export const InitialsAvatar = ({
  name,
  size = 36,
  background = gradients.brand,
  className,
}: {
  name: string;
  size?: keyof typeof SIZE_CLASSES;
  background?: string;
  className?: string;
}) => (
  <div
    aria-hidden={true}
    className={cn(
      "grid shrink-0 place-items-center font-bold text-white!",
      SIZE_CLASSES[size],
      className,
    )}
    style={{ background }}
  >
    {initialsOf(name)}
  </div>
);
