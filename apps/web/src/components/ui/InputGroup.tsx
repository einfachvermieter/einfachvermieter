import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, Ref } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";

const inputGroupVariants = cva(
  "group/input-group relative flex h-8.5 min-w-0 items-center rounded-md border border-edge bg-white in-data-[slot=combobox-content]:focus-within:border-inherit has-[[data-slot=input-group-control]:focus]:outline-2 has-[[data-slot=input-group-control]:focus]:outline-offset-2 has-[[data-slot=input-group-control]:focus]:outline-azur-500 has-[[data-slot][aria-invalid=true]]:border-himbeere-500 has-[[data-slot][aria-invalid=true]]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-himbeere-50 has-[[data-slot][aria-invalid=true]:focus]:outline-himbeere-500 has-[[data-slot=input-group-control]:disabled]:border-border has-[[data-slot=input-group-control]:disabled]:bg-schiefer-50 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5",
  {
    variants: {
      width: {
        full: "w-full",
        /**
         * Zahlenfeld mit Einheit: feste Breite, damit die Kanten
         * untereinander fluchten, Zahl rechtsbündig
         */
        unit: "w-36 max-w-full [&>input]:text-right [&>input]:tabular-nums",
        /**
         * Wie `unit`, für lange Einheiten wie "kg CO2/kWh"
         */
        unitLong: "w-55 max-w-full [&>input]:text-right [&>input]:tabular-nums",
      },
    },
    defaultVariants: {
      width: "full",
    },
  },
);

function InputGroup({
  className,
  width,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof inputGroupVariants>) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: fieldset's default styling conflicts with this layout primitive
    <div
      data-slot="input-group"
      data-unit={width === "unit" || width === "unitLong" ? "" : undefined}
      role="group"
      className={cn(inputGroupVariants({ width }), className)}
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-sm [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-2 has-[>button]:-ml-1 has-[>kbd]:ml-[-0.15rem]",
        "inline-end":
          "order-last pr-2 has-[>button]:-mr-1 has-[>kbd]:mr-[-0.15rem]",
        "block-start":
          "order-first w-full justify-start px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2",
        "block-end":
          "order-last w-full justify-start px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  },
);

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: fieldset's default styling conflicts with this layout primitive
    // biome-ignore lint/a11y/useKeyWithClickEvents: click focuses the wrapped input for mouse users; keyboard users tab directly to the input
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva(
  "flex items-center gap-2 text-sm shadow-none",
  {
    variants: {
      size: {
        xs: "h-6 gap-1 rounded-sm px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
        sm: "",
        "icon-xs": "size-6 rounded-sm p-0 has-[>svg]:p-0",
        "icon-sm": "size-8 p-0 has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  },
);

const InputGroupButton = ({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ref,
  ...props
}: (Omit<ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) & {
  ref?: Ref<HTMLButtonElement>;
}) => (
  <Button
    ref={ref}
    type={type}
    data-size={size}
    variant={variant}
    className={cn(inputGroupButtonVariants({ size }), className)}
    {...props}
  />
);
InputGroupButton.displayName = "InputGroupButton";

function InputGroupText({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

const InputGroupInput = ({
  className,
  ref,
  ...props
}: ComponentProps<"input"> & {
  ref?: Ref<HTMLInputElement>;
}) => (
  <Input
    ref={ref}
    data-slot="input-group-control"
    className={cn(
      "min-w-0 flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus:outline-none aria-invalid:ring-0 disabled:bg-transparent",
      className,
    )}
    {...props}
  />
);
InputGroupInput.displayName = "InputGroupInput";

const InputGroupTextarea = ({
  className,
  ref,
  ...props
}: ComponentProps<"textarea"> & {
  ref?: Ref<HTMLTextAreaElement>;
}) => (
  <Textarea
    ref={ref}
    data-slot="input-group-control"
    className={cn(
      "flex-1 resize-none rounded-none border-0 bg-transparent py-2 shadow-none ring-0 focus:outline-none aria-invalid:ring-0",
      className,
    )}
    {...props}
  />
);
InputGroupTextarea.displayName = "InputGroupTextarea";

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
};
