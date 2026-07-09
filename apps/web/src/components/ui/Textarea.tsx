import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const Textarea = ({
  className,
  ref,
  ...props
}: ComponentProps<"textarea"> & {
  ref?: React.Ref<HTMLTextAreaElement>;
}) => (
  <textarea
    ref={ref}
    data-slot="textarea"
    className={cn(
      "flex field-sizing-content min-h-16 w-full rounded-[11px] border border-input bg-card px-3.5 py-2.5 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-slate-400 focus-visible:border-ring dark:placeholder:text-slate-500 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
      className,
    )}
    {...props}
  />
);
Textarea.displayName = "Textarea";

export { Textarea };
