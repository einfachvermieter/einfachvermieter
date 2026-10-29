import { cva, type VariantProps } from "class-variance-authority";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import type {
  ComponentProps,
  ComponentPropsWithoutRef,
  ElementRef,
  Ref,
} from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const AlertDialog = ({
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Root>) => (
  <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
);

const AlertDialogTrigger = ({
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Trigger>) => (
  <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
);

const AlertDialogPortal = ({
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Portal>) => (
  <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
);

const AlertDialogOverlay = ({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay> & {
  ref?: Ref<ElementRef<typeof AlertDialogPrimitive.Overlay>>;
}) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    data-slot="alert-dialog-overlay"
    className={cn(
      "fixed inset-0 z-50 bg-schiefer-900/30 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
      className,
    )}
    {...props}
  />
);
AlertDialogOverlay.displayName = "AlertDialogOverlay";

const AlertDialogContent = ({
  className,
  size = "default",
  ref,
  ...props
}: (ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & {
  size?: "default" | "sm";
}) & {
  ref?: Ref<ElementRef<typeof AlertDialogPrimitive.Content>>;
}) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      data-slot="alert-dialog-content"
      data-size={size}
      className={cn(
        "group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full overflow-y-auto -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-dialog duration-100 outline-none max-w-[calc(100%-2rem)] data-[size=sm]:sm:max-w-xs data-[size=default]:sm:max-w-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
);
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogHeader = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="alert-dialog-header"
    className={cn(
      "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr] sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-cols-[auto_1fr]",
      className,
    )}
    {...props}
  />
);

const AlertDialogFooter = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="alert-dialog-footer"
    className={cn(
      "-mx-6 -mb-6 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-azur-50 px-6 py-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
      className,
    )}
    {...props}
  />
);

const alertDialogMediaVariants = cva(
  "mb-2 inline-flex size-10 items-center justify-center rounded-lg sm:group-data-[size=default]/alert-dialog-content:row-span-2",
  {
    variants: {
      variant: {
        default: "bg-muted *:[svg:not([class*='size-'])]:size-8",
        destructive:
          "bg-himbeere-50 text-himbeere-500 *:[svg:not([class*='size-'])]:size-5",
        // Löschen geht gerade nicht: dasselbe Icon, aber ohne Warnfarbe
        neutral:
          "bg-schiefer-100 text-schiefer-500 *:[svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const AlertDialogMedia = ({
  className,
  variant,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertDialogMediaVariants>) => (
  <div
    data-slot="alert-dialog-media"
    className={cn(alertDialogMediaVariants({ variant }), className)}
    {...props}
  />
);

const AlertDialogTitle = ({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>) => (
  <AlertDialogPrimitive.Title
    data-slot="alert-dialog-title"
    className={cn(
      "font-heading text-lg font-semibold sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
      className,
    )}
    {...props}
  />
);

const AlertDialogDescription = ({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) => (
  <AlertDialogPrimitive.Description
    data-slot="alert-dialog-description"
    className={cn(
      "text-sm text-balance text-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
      className,
    )}
    {...props}
  />
);

const AlertDialogAction = ({
  className,
  variant = "default",
  size = "default",
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Action> &
  Pick<ComponentProps<typeof Button>, "variant" | "size">) => (
  <Button variant={variant} size={size} asChild={true}>
    <AlertDialogPrimitive.Action
      data-slot="alert-dialog-action"
      className={cn(className)}
      {...props}
    />
  </Button>
);

const AlertDialogCancel = ({
  className,
  variant = "outline",
  size = "default",
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Cancel> &
  Pick<ComponentProps<typeof Button>, "variant" | "size">) => (
  <Button variant={variant} size={size} asChild={true}>
    <AlertDialogPrimitive.Cancel
      data-slot="alert-dialog-cancel"
      className={cn(className)}
      {...props}
    />
  </Button>
);

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
