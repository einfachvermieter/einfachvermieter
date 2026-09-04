import {
  RiCheckboxCircleFill,
  RiErrorWarningFill,
  RiInformationFill,
} from "@remixicon/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border text-left text-sm text-foreground has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        info: "border-azur-200 bg-azur-50 text-azur-900 *:data-[slot=alert-description]:text-azur-800 *:[svg]:text-azur-500",
        success:
          "border-limette-200 bg-limette-50 text-limette-900 *:data-[slot=alert-description]:text-limette-800 *:[svg]:text-limette-500",
        warning:
          "border-honig-200 bg-honig-50 text-honig-900 *:data-[slot=alert-description]:text-honig-800 *:[svg]:text-honig-500",
        error:
          "border-himbeere-200 bg-himbeere-50 text-himbeere-900 *:data-[slot=alert-description]:text-himbeere-800 *:[svg]:text-himbeere-500",
      },
      size: {
        default: "px-4 py-3",
        sm: "px-3 py-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const variantIcon = {
  default: null,
  info: RiInformationFill,
  success: RiCheckboxCircleFill,
  warning: RiErrorWarningFill,
  error: RiErrorWarningFill,
} as const;

const Alert = ({
  className,
  variant,
  size,
  children,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) => {
  const Icon = variantIcon[variant ?? "default"];
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant, size }), className)}
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
