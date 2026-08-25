import type { RemixiconComponentType } from "@remixicon/react";
import { cn } from "@/lib/utils";

/**
 * Größenabhängige Maße (Kachel, Radius, Icon)
 */
const SIZE_CLASSES = {
  26: "size-[26px] rounded-[8px] [&_svg]:size-[15px]",
  30: "size-7.5 rounded-[9px] [&_svg]:size-4",
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
      "grid shrink-0 place-items-center bg-slate-200 text-slate-600! **:text-slate-600! dark:bg-slate-700 dark:text-slate-300! dark:**:text-slate-300!",
      SIZE_CLASSES[size],
    )}
  >
    <Icon />
  </div>
);
