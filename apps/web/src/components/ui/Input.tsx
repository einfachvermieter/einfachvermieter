import type { ComponentProps, Ref } from "react";
import { cn } from "@/lib/utils";

const TABULAR_INPUT_TYPES = new Set([
  "number",
  "date",
  "datetime-local",
  "month",
  "week",
  "time",
]);

const Input = ({
  className,
  type,
  ref,
  ...props
}: ComponentProps<"input"> & {
  ref?: Ref<HTMLInputElement>;
}) => (
  <input
    ref={ref}
    type={type}
    data-slot="input"
    className={cn(
      "h-8.5 w-full min-w-0 rounded-md border border-edge bg-white px-3 py-1.5 text-sm file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground placeholder:text-schiefer-500 focus:outline-2 focus:outline-offset-2 focus:outline-azur-500 disabled:cursor-not-allowed disabled:border-border disabled:bg-schiefer-50 disabled:text-schiefer-500 read-only:border-transparent read-only:bg-azur-50 read-only:text-azur-900 aria-invalid:border-himbeere-500 aria-invalid:ring-3 aria-invalid:ring-himbeere-50 aria-invalid:focus:outline-himbeere-500",
      type && TABULAR_INPUT_TYPES.has(type) && "tabular-nums",
      className,
    )}
    {...props}
  />
);
Input.displayName = "Input";

export { Input };
