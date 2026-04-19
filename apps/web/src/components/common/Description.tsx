import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export const Description = ({
  children,
  className,
}: ComponentPropsWithoutRef<"p">) => (
  <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>
);
