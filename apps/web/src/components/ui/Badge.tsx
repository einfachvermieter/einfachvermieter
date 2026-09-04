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
        ok: "bg-limette-600 text-limette-50",
        warn: "bg-honig-600 text-honig-50",
        bad: "bg-himbeere-600 text-himbeere-50",
        info: "bg-azur-600 text-azur-50",
        neutral: "bg-schiefer-500 text-schiefer-50",
        "ok-light": "bg-limette-100 text-limette-800",
        "warn-light": "bg-honig-100 text-honig-800",
        "bad-light": "bg-himbeere-100 text-himbeere-600",
        "info-light": "bg-azur-100 text-azur-600",
        "neutral-light": "bg-schiefer-100 text-schiefer-600",
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
