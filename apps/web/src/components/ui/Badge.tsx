import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Status-Pills
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-xs leading-4 font-semibold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        ok: "bg-limette-500 text-limette-1000",
        warn: "bg-honig-500 text-honig-1000",
        bad: "bg-himbeere-500 text-white",
        info: "bg-azur-500 text-white",
        neutral: "bg-schiefer-500 text-white",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

const Badge = ({
  className,
  variant = "neutral",
  asChild = false,
  ...props
}: ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  }) => {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
};

export { Badge, badgeVariants };
