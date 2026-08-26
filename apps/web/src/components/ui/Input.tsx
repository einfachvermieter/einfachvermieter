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
      "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground placeholder:text-schiefer-400 focus-visible:border-limette-700 focus-visible:ring-3 focus-visible:ring-limette-200 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive",
      type && TABULAR_INPUT_TYPES.has(type) && "tabular-nums",
      className,
    )}
    {...props}
  />
);
Input.displayName = "Input";

export { Input };
