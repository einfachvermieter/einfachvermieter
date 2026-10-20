import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border px-px transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azur-500 aria-invalid:ring-2 aria-invalid:ring-destructive data-[size=default]:h-5.5 data-[size=default]:w-9.5 data-[size=sm]:h-4 data-[size=sm]:w-7 data-checked:border-azur-900 data-checked:bg-azur-700 data-checked:shadow-key-azur data-unchecked:border-edge data-unchecked:bg-schiefer-50 data-unchecked:shadow-key data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full border bg-white ring-0 transition-transform data-checked:border-azur-900 data-unchecked:border-edge group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-4 group-data-[size=sm]/switch:data-checked:translate-x-3 group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
