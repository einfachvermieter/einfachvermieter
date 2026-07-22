import type { RemixiconComponentType } from "@remixicon/react";
import { cn } from "@/lib/utils";

/**
 * Größenabhängige Maße (Radien & Schatten)
 */
const SIZE_CLASSES = {
  26: "size-[26px] rounded-[8px] shadow-[0_3px_7px_-3px_rgba(0,0,0,0.3)] [&_svg]:size-[15px]",
  30: "size-[30px] rounded-[9px] [&_svg]:size-4",
  36: "size-9 rounded-[10px] [&_svg]:size-[18px]",
  40: "size-10 rounded-[12px] shadow-[0_6px_14px_-6px_rgba(0,0,0,0.3)] [&_svg]:size-5",
  44: "size-11 rounded-[13px] shadow-[0_8px_16px_-8px_rgba(13,148,136,0.45)] [&_svg]:size-[21px]",
  64: "size-16 rounded-[18px] shadow-[0_12px_26px_-10px_rgba(0,0,0,0.35)] [&_svg]:size-7",
} as const;

/**
 * Farbige Icon-Kachel für Sidebar-Navigation, Tabellenzeilen, Sektionsköpfe
 * und Hero.
 */
export const IconTile = ({
  icon: Icon,
  size = 36,
  background,
  className,
}: {
  icon: RemixiconComponentType;
  size?: keyof typeof SIZE_CLASSES;
  background: string;
  className?: string;
}) => (
  <div
    aria-hidden={true}
    className={cn(
      "grid shrink-0 place-items-center text-white",
      SIZE_CLASSES[size],
      className,
    )}
    style={{ background }}
  >
    <Icon />
  </div>
);
