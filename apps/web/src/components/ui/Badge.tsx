import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Status-Pills mit Punkt (im Seitenkopf ohne Punkt)
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 rounded-full border py-px pr-2.5 pl-2 text-xs leading-4.5 font-normal whitespace-nowrap before:size-2 before:shrink-0 before:rounded-full before:content-[''] [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        ok: "border-limette-600 bg-limette-50 text-limette-900 before:bg-limette-600",
        warn: "border-honig-500 bg-honig-50 text-honig-900 before:bg-honig-500",
        bad: "border-himbeere-500 bg-himbeere-50 text-himbeere-900 before:bg-himbeere-500",
        info: "border-azur-500 bg-azur-50 text-azur-900 before:bg-azur-500",
        neutral:
          "border-schiefer-300 bg-schiefer-50 text-schiefer-900 before:bg-schiefer-300",
        tag: "border-schiefer-300 bg-schiefer-50 pl-2.5 text-schiefer-900 before:hidden",
        /**
         * Kennzeichen der Vorabversion an der Wortmarke: gefüllt, weiße
         * Schrift, leicht gerundet, damit es nicht wie ein Status aussieht
         */
        beta: "rounded-sm border-0 bg-honig-700 px-1.5 font-semibold text-white before:hidden",
      },
      appearance: {
        pill: "",
        dot: "border-0 bg-transparent p-0 text-sm text-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
      appearance: "pill",
    },
  },
);

const Badge = ({
  className,
  variant = "neutral",
  appearance = "pill",
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
      className={cn(badgeVariants({ variant, appearance }), className)}
      {...props}
    />
  );
};

export { Badge, badgeVariants };
