import type { RemixiconComponentType } from "@remixicon/react";
import { cn } from "@/lib/utils";

/**
 * Größenabhängige Maße (Kachel, Radius, Icon)
 */
const SIZE_CLASSES = {
  26: "size-6.5 rounded-md [&_svg]:size-3.75",
  30: "size-7.5 rounded-md [&_svg]:size-4",
  36: "size-9 rounded-lg [&_svg]:size-4.5",
  38: "size-9.5 rounded-lg [&_svg]:size-4.75",
  40: "size-10 rounded-lg [&_svg]:size-5",
} as const;

/**
 * Icon-Kachel: blasse Akzentfläche mit Akzent-Icon. Eine Optik für alle
 * Domänen (Seitenkopf, Aktionszeilen, Schnellstart, Tabellenzeilen).
 */
export const IconTile = ({
  icon: Icon,
  size = 36,
  className,
}: {
  icon: RemixiconComponentType;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) => (
  <div
    aria-hidden={true}
    data-slot="icon-tile"
    className={cn(
      "grid shrink-0 place-items-center bg-limette-100 text-limette-700",
      SIZE_CLASSES[size],
      className,
    )}
  >
    <Icon />
  </div>
);
