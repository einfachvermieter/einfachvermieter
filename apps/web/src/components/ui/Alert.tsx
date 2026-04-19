import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiInformationLine,
} from "@remixicon/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-4 py-3 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        info: "border-sky-200 bg-sky-50 text-sky-900 *:data-[slot=alert-description]:text-sky-900/80 *:[svg]:text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-100 dark:*:data-[slot=alert-description]:text-sky-100/80 dark:*:[svg]:text-sky-300",
        success:
          "border-teal-200 bg-teal-50 text-teal-900 *:data-[slot=alert-description]:text-teal-900/80 *:[svg]:text-teal-700 dark:border-teal-900/40 dark:bg-teal-950/40 dark:text-teal-100 dark:*:data-[slot=alert-description]:text-teal-100/80 dark:*:[svg]:text-teal-300",
        warning:
          "border-amber-200 bg-amber-50 text-amber-900 *:data-[slot=alert-description]:text-amber-900/80 *:[svg]:text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100 dark:*:data-[slot=alert-description]:text-amber-100/80 dark:*:[svg]:text-amber-300",
        error:
          "border-rose-200 bg-rose-50 text-rose-900 *:data-[slot=alert-description]:text-rose-900/80 *:[svg]:text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100 dark:*:data-[slot=alert-description]:text-rose-100/80 dark:*:[svg]:text-rose-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const variantIcon = {
  default: null,
  info: RiInformationLine,
  success: RiCheckboxCircleLine,
  warning: RiErrorWarningLine,
  error: RiErrorWarningLine,
} as const;

const Alert = ({
  className,
  variant,
  children,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) => {
  const Icon = variantIcon[variant ?? "default"];
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {Icon ? <Icon /> : null}
      {children}
    </div>
  );
};

const AlertTitle = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="alert-title"
    className={cn(
      "font-semibold group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
      className,
    )}
    {...props}
  />
);

const AlertDescription = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="alert-description"
    className={cn(
      "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
      className,
    )}
    {...props}
  />
);

const AlertAction = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="alert-action"
    className={cn("absolute top-2.5 right-3", className)}
    {...props}
  />
);

export { Alert, AlertAction, AlertDescription, AlertTitle };
