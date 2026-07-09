import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps, type ReactNode, useMemo } from "react";
import { Label } from "@/components/ui/Label";
import { Separator } from "@/components/ui/Separator";
import { translateKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const FieldSet = ({ className, ...props }: ComponentProps<"fieldset">) => (
  <fieldset
    data-slot="field-set"
    className={cn(
      "flex flex-col gap-6 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
      className,
    )}
    {...props}
  />
);

const FieldLegend = ({
  className,
  variant = "legend",
  ...props
}: ComponentProps<"legend"> & { variant?: "legend" | "label" }) => (
  <legend
    data-slot="field-legend"
    data-variant={variant}
    className={cn(
      "mb-3 font-semibold data-[variant=label]:text-sm data-[variant=legend]:text-base",
      className,
    )}
    {...props}
  />
);

const FieldGroup = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="field-group"
    className={cn(
      "group/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4",
      className,
    )}
    {...props}
  />
);

const fieldVariants = cva(
  "group/field flex w-full gap-2 data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
        horizontal:
          "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        responsive:
          "flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  },
);

const Field = ({
  className,
  orientation = "vertical",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof fieldVariants>) => {
  return (
    // biome-ignore lint/a11y/useSemanticElements: fieldset's default styling conflicts with this layout primitive
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
};

const FieldContent = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="field-content"
    className={cn(
      "group/field-content flex flex-1 flex-col gap-1 leading-snug",
      className,
    )}
    {...props}
  />
);

const FieldLabel = ({ className, ...props }: ComponentProps<typeof Label>) => (
  <Label
    data-slot="field-label"
    className={cn(
      "text-[12.5px] text-slate-600 dark:text-slate-300",
      "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border *:data-[slot=field]:p-3 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10",
      "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
      "has-[[data-state=unchecked]:disabled]:cursor-not-allowed has-[[data-state=unchecked]:disabled]:opacity-50",
      className,
    )}
    {...props}
  />
);

const FieldTitle = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="field-label"
    className={cn(
      "flex w-fit items-center gap-2 text-sm font-semibold group-data-[disabled=true]/field:opacity-50",
      className,
    )}
    {...props}
  />
);

const FieldDescription = ({ className, ...props }: ComponentProps<"p">) => (
  <p
    data-slot="field-description"
    className={cn(
      "text-left text-sm leading-normal font-normal text-muted-foreground group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5",
      "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
      className,
    )}
    {...props}
  />
);

const FieldSeparator = ({
  children,
  className,
  ...props
}: ComponentProps<"div"> & {
  children?: ReactNode;
}) => (
  <div
    data-slot="field-separator"
    data-content={Boolean(children)}
    className={cn(
      "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
      className,
    )}
    {...props}
  >
    <Separator className="absolute inset-0 top-1/2" />
    {children && (
      <span
        className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
        data-slot="field-separator-content"
      >
        {children}
      </span>
    )}
  </div>
);

const FieldError = ({
  className,
  children,
  errors,
  ...props
}: ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
}) => {
  const content = useMemo(() => {
    if (children) {
      return children;
    }

    if (errors?.length === undefined || errors.length === 0) {
      return null;
    }

    const messages = Array.from(
      new Set(
        errors
          .map((error) => error?.message)
          .filter((message): message is string => Boolean(message))
          .map((message) => translateKey(message)),
      ),
    );

    if (messages.length === 1) {
      return messages[0];
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("text-sm font-normal text-destructive", className)}
      {...props}
    >
      {content}
    </div>
  );
};

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
};
