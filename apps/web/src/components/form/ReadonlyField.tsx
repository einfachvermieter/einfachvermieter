import { RiLockLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/Field";
import { t } from "@/lib/i18n";

/**
 * Statische, nicht editierbare Feldzeile für unveränderliche Zuordnungen
 */
export const ReadonlyField = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => (
  <Field>
    <FieldLabel>{label}</FieldLabel>
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm">
      <RiLockLine
        aria-hidden={true}
        className="size-4 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1 truncate font-medium">{value}</span>
    </div>
    <FieldDescription>
      {t("ui.common.forms.readonlyAssignment")}
    </FieldDescription>
  </Field>
);
