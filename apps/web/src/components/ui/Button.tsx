import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps, Ref } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary font-semibold text-primary-foreground hover:bg-limette-400",
        // Sekundärbutton: weiß mit Rahmen
        outline:
          "border-border bg-background hover:bg-muted aria-expanded:bg-muted",
        secondary:
          "border-border bg-background hover:bg-muted aria-expanded:bg-muted",
        addLink: "text-limette-700 underline-offset-3 hover:underline",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        ghostMuted:
          "text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        ghostDestructive: "text-himbeere-500 hover:bg-himbeere-50",
        helpHint:
          "text-limette-700 hover:rounded-full hover:bg-limette-800 hover:text-white aria-expanded:rounded-full",
        destructive:
          "bg-destructive font-semibold text-white hover:bg-himbeere-600 focus-visible:ring-destructive",
        link: "text-limette-700 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-2 px-4 in-data-[slot=button-group]:rounded-md",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
        lg: "h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-9",
        "icon-xs":
          "size-6 rounded-sm in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-hint": "size-6 in-data-[slot=button-group]:rounded-md",
        "icon-sm": "size-8 in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-10",
        // Für addLink: Textlink ohne Fläche
        text: "h-auto gap-1.5 p-0 text-sm [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = ({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ref,
  ...props
}: ButtonProps & { ref?: Ref<HTMLButtonElement> }) => {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref as Ref<HTMLButtonElement>}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
};
Button.displayName = "Button";

export { Button, buttonVariants };
