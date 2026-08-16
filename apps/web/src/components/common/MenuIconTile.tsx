import type { RemixiconComponentType } from "@remixicon/react";

/**
 * Neutrale Icon-Kachel für Menü-Einträge ohne eigenes Motiv
 */
export const MenuIconTile = ({
  icon: Icon,
}: {
  icon: RemixiconComponentType;
}) => (
  <div
    aria-hidden={true}
    className="grid size-7.5 shrink-0 place-items-center rounded-[9px] bg-slate-200 text-slate-600! **:text-slate-600! dark:bg-slate-700 dark:text-slate-300! dark:**:text-slate-300! [&_svg]:size-4"
  >
    <Icon />
  </div>
);
