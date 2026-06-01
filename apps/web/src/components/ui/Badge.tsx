import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        lightBlue:
          "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
        darkBlue: "bg-sky-700 text-sky-50 dark:bg-sky-800 dark:text-sky-100",
        lightGreen:
          "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
        darkGreen:
          "bg-teal-700 text-teal-50 dark:bg-teal-800 dark:text-teal-100",
        lightYellow:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        darkYellow:
          "bg-amber-600 text-amber-50 dark:bg-amber-700 dark:text-amber-100",
        lightRed:
          "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
        darkRed: "bg-rose-700 text-rose-50 dark:bg-rose-800 dark:text-rose-100",
        ok: "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
        warn: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        blue: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
        slate:
          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        indigo:
          "bg-indigo-50 text-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-400",
        rose: "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
        morechip:
          "bg-slate-100 font-bold text-[11px] text-slate-400 dark:bg-slate-800 dark:text-slate-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Badge = ({
  className,
  variant = "default",
  asChild = false,
  dot = false,
  children,
  ...props
}: ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    dot?: boolean;
  }) => {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {dot && (
        <span aria-hidden={true} className="size-1.5 rounded-full bg-current" />
      )}
      {children}
    </Comp>
  );
};

export { Badge, badgeVariants };
