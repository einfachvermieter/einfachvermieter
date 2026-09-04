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
      "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-[color,box-shadow] outline-none placeholder:text-schiefer-400 focus-visible:border-azur-700 focus-visible:ring-3 focus-visible:ring-azur-200 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive",
      className,
    )}
    {...props}
  />
);
Textarea.displayName = "Textarea";

export { Textarea };
