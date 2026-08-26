import {
  type RemixiconComponentType,
  RiArrowRightSLine,
} from "@remixicon/react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Aktionszeile in der Infospalte: Icon + Label + Chevron auf heller Fläche
 * Destruktive Aktionen mit `danger={true}`.
 * Navigation über `onClick` (z. B. useNavigate)
 */
export const ActionLink = ({
  icon: Icon,
  accent = false,
  danger = false,
  subtitle,
  className,
  children,
  ...props
}: ComponentProps<"button"> & {
  icon: RemixiconComponentType;
  accent?: boolean;
  danger?: boolean;
  subtitle?: ReactNode;
}) => (
  <button
    type="button"
    className={cn(
      "mb-2 flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors last:mb-0",
      danger && "bg-himbeere-50 text-himbeere-500 hover:bg-himbeere-100",
      accent && "bg-limette-50 text-limette-800 hover:bg-limette-100",
      !danger &&
        !accent &&
        "bg-schiefer-50 text-foreground hover:bg-schiefer-100",
      className,
    )}
    {...props}
  >
    <Icon
      aria-hidden={true}
      className={cn(
        "size-5 shrink-0",
        danger && "text-himbeere-500",
        accent && "text-limette-700",
        !danger && !accent && "text-schiefer-500",
      )}
    />
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
      className="size-4 shrink-0 text-schiefer-400"
    />
  </button>
);
