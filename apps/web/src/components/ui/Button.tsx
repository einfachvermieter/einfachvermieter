import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps, Ref } from "react";
import { cn } from "@/lib/utils";

/**
 * Buttons mit Kante: Rahmen und 2px Unterkante in derselben Farbe. Beim
 * Drücken rutscht der Button um die Kante nach unten. Flache Varianten (ghost,
 * Links) haben keine Kante, weil sie keine eigenständigen Buttons sind.
 * Buttons mit Kante zeigen den Pfeil, auch wenn sie als Link gebaut sind;
 * Navigation und Textlinks behalten als Link die Hand des Browsers
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding font-heading text-sm font-semibold whitespace-nowrap transition-[transform,box-shadow,background-color] duration-75 outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azur-500 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Haupttaste: höchstens eine je Seite
        default:
          "cursor-default border-limette-600 bg-limette-400 text-limette-1000 shadow-key-limette hover:bg-limette-300 active:translate-y-0.5 active:shadow-none",
        outline:
          "cursor-default border-edge bg-white text-foreground shadow-key hover:bg-schiefer-50 active:translate-y-0.5 active:shadow-none aria-expanded:bg-schiefer-50",
        secondary:
          "cursor-default border-edge bg-white text-foreground shadow-key hover:bg-schiefer-50 active:translate-y-0.5 active:shadow-none aria-expanded:bg-schiefer-50",
        // Aktion an Abschnitt oder Zeile: Icon in Azur auf einem kleinen Button
        action:
          "cursor-default border-edge bg-white text-azur-700 shadow-key hover:bg-schiefer-50 active:translate-y-0.5 active:shadow-none aria-expanded:bg-schiefer-50",
        // Aktiver Eintrag der Fensterleiste: erhaben in Limette wie in der Sidebar
        current:
          "border-limette-600 bg-limette-100 text-foreground shadow-key-limette active:translate-y-0.5 active:shadow-none",
        // Aktion an einer Zeile: in Ruhe ein blasses Icon, auf der Zeile
        // (group/row) ein Button. Ohne Maus immer als Button
        row: "cursor-default border-transparent bg-transparent text-schiefer-300 group-hover/row:border-edge group-hover/row:bg-white group-hover/row:text-azur-700 group-hover/row:shadow-key group-focus-within/row:border-edge group-focus-within/row:bg-white group-focus-within/row:text-azur-700 group-focus-within/row:shadow-key pointer-coarse:border-edge pointer-coarse:bg-white pointer-coarse:text-azur-700 pointer-coarse:shadow-key hover:bg-schiefer-50 active:translate-y-0.5 active:shadow-none",
        rowDestructive:
          "cursor-default border-transparent bg-transparent text-schiefer-300 group-hover/row:border-edge group-hover/row:bg-white group-hover/row:text-azur-700 group-hover/row:shadow-key group-focus-within/row:border-edge group-focus-within/row:bg-white group-focus-within/row:text-azur-700 group-focus-within/row:shadow-key pointer-coarse:border-edge pointer-coarse:bg-white pointer-coarse:text-azur-700 pointer-coarse:shadow-key hover:bg-schiefer-50 active:translate-y-0.5 active:shadow-none hover:text-himbeere-500",
        addLink: "font-sans text-azur-700 underline-offset-3 hover:underline",
        ghost:
          "font-normal hover:bg-schiefer-900/6 hover:text-foreground aria-expanded:bg-schiefer-50 aria-expanded:text-foreground",
        ghostMuted:
          "font-sans font-normal text-muted-foreground hover:bg-schiefer-50 hover:text-foreground aria-expanded:bg-schiefer-50 aria-expanded:text-foreground",
        ghostDestructive: "font-sans text-himbeere-500 hover:bg-himbeere-50",
        helpHint:
          "font-sans text-schiefer-500 hover:rounded-full hover:bg-azur-50 hover:text-azur-700 aria-expanded:rounded-full aria-expanded:bg-azur-50 aria-expanded:text-azur-700",
        // Nur im Löschen-Dialog: der einzige rot gefüllte Button
        destructive:
          "cursor-default border-himbeere-800 bg-himbeere-500 text-white shadow-key-himbeere hover:bg-himbeere-600 active:translate-y-0.5 active:shadow-none",
        link: "font-sans text-azur-700 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8.5 gap-2 px-3.5 in-data-[slot=button-group]:rounded-md",
        xs: "h-6 gap-1 rounded-md px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 rounded-md px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
        lg: "h-10 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        // 2px breiter als hoch, damit der Button mit Kante quadratisch wirkt
        icon: "h-8.5 w-9",
        "icon-xs":
          "size-6 rounded-md in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-hint": "-my-1 size-6 in-data-[slot=button-group]:rounded-md",
        "icon-sm":
          "h-7 w-7.5 rounded-md in-data-[slot=button-group]:rounded-md",
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
