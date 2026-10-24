import { cva, type VariantProps } from "class-variance-authority";
import { Popover as PopoverPrimitive } from "radix-ui";
import type { ComponentProps, ElementRef, Ref } from "react";
import { cn } from "@/lib/utils";

function Popover({ ...props }: ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

const PopoverTrigger = ({
  ref,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Trigger> & {
  ref?: Ref<ElementRef<typeof PopoverPrimitive.Trigger>>;
}) => (
  <PopoverPrimitive.Trigger ref={ref} data-slot="popover-trigger" {...props} />
);
PopoverTrigger.displayName = "PopoverTrigger";

const popoverContentVariants = cva(
  "z-50 origin-(--radix-popover-content-transform-origin) text-sm outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
  {
    variants: {
      variant: {
        default:
          "flex max-h-(--radix-popover-content-available-height) w-72 flex-col gap-4 overflow-y-auto rounded-md bg-popover p-4 text-popover-foreground shadow-md ring-1 ring-foreground/10",
        help: "w-85 max-w-(--radix-popover-content-available-width) rounded-lg border border-azur-200 bg-azur-50 leading-relaxed text-azur-900 shadow-help",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  variant,
  children,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content> &
  VariantProps<typeof popoverContentVariants>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(popoverContentVariants({ variant }), className)}
        {...props}
      >
        {variant === "help" ? (
          <>
            <div className="max-h-58 space-y-2 overflow-auto overscroll-contain px-3.5 py-3 [scrollbar-color:var(--color-azur-200)_transparent] scrollbar-thin">
              {children}
            </div>
            {/* Radix setzt den Pfeil genau unter das Fragezeichen. Das
                gedrehte Quadrat zeigt zwei Kanten als Rahmen; Radix dreht
                den Pfeil für die untere Lage um 180 Grad, daher unten und
                rechts */}
            <PopoverPrimitive.Arrow asChild={true} width={10} height={10}>
              <span className="block size-2.5">
                <span className="block size-2.5 -translate-y-1 rotate-45 border-r border-b border-azur-200 bg-azur-50" />
              </span>
            </PopoverPrimitive.Arrow>
          </>
        ) : (
          children
        )}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({
  ...props
}: ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 text-sm", className)}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <div
      data-slot="popover-title"
      className={cn("font-semibold", className)}
      {...props}
    />
  );
}

function PopoverDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
