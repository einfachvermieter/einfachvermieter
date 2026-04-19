import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Heading1 = ({
  icon,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"h1"> & { icon?: ReactNode }) => (
  <h1
    className={cn(
      "scroll-m-20 text-2xl font-bold tracking-tight text-balance flex items-center gap-2 text-sky-900",
      className,
    )}
    {...props}
  >
    {icon ? <span className="text-sky-800 [&>svg]:size-6">{icon}</span> : null}
    {children}
  </h1>
);
