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
      "flex field-sizing-content min-h-21 w-full rounded-md border border-edge bg-white px-3 py-2 text-sm outline-none placeholder:text-schiefer-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azur-500 disabled:cursor-not-allowed disabled:border-border disabled:bg-schiefer-50 disabled:text-schiefer-500 read-only:border-transparent read-only:bg-azur-50 read-only:text-azur-900 aria-invalid:border-himbeere-500 aria-invalid:ring-3 aria-invalid:ring-himbeere-50 aria-invalid:focus-visible:outline-himbeere-500",
      className,
    )}
    {...props}
  />
);
Textarea.displayName = "Textarea";

export { Textarea };
