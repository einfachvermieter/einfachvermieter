import {
  type RemixiconComponentType,
  RiArrowRightSLine,
} from "@remixicon/react";
import type { ComponentProps, ReactNode } from "react";
import { IconTile } from "@/components/common/IconTile";
import { cn } from "@/lib/utils";

/**
 * Aktionszeile in der Infospalte: Icon-Kachel 30px + Label + Chevron
 * Destruktive Aktionen mit `danger={true}`.
 * Navigation über `onClick` (z. B. useNavigate)
 */
export const ActionLink = ({
  icon,
  iconBackground,
  danger = false,
  subtitle,
  className,
  children,
  ...props
}: ComponentProps<"button"> & {
  icon: RemixiconComponentType;
  /** Farbe oder Verlauf aus lib/domainVisuals.ts */
  iconBackground: string;
  danger?: boolean;
  subtitle?: ReactNode;
}) => (
  <button
    type="button"
    className={cn(
      "mb-2 flex w-full cursor-pointer items-center gap-3 rounded-[11px] bg-muted px-2.75 py-2.5 text-left text-sm font-semibold transition-colors last:mb-0",
      danger
        ? "text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
        : "text-foreground hover:bg-slate-200 dark:hover:bg-slate-700",
      className,
    )}
    {...props}
  >
    <IconTile icon={icon} size={30} background={iconBackground} />
    <span className="min-w-0 flex-1">
      {children}
      {subtitle ? (
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
          {subtitle}
        </span>
      ) : null}
    </span>
    <RiArrowRightSLine
      aria-hidden={true}
      className="size-4.5 shrink-0 text-slate-400"
    />
  </button>
);
