import type { RemixiconComponentType } from "@remixicon/react";
import { cn } from "@/lib/utils";

/**
 * Größenabhängige Maße (Kachel, Radius, Icon)
 */
const SIZE_CLASSES = {
  26: "size-6.5 rounded-md [&_svg]:size-3.75",
  30: "size-7.5 rounded-md [&_svg]:size-4",
} as const;

/**
 * Neutrale Icon-Kachel für Menü-Einträge ohne eigenes Motiv
 */
export const MenuIconTile = ({
  icon: Icon,
  size = 30,
}: {
  icon: RemixiconComponentType;
  size?: keyof typeof SIZE_CLASSES;
}) => (
  <div
    aria-hidden={true}
    className={cn(
      "grid shrink-0 place-items-center bg-schiefer-100 text-schiefer-600",
      SIZE_CLASSES[size],
    )}
  >
    <Icon />
  </div>
);
