import { Spinner } from "@/components/common/Spinner";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";

export const FormActions = ({
  submitting,
  onCancel,
  submitLabel,
  cancelLabel = t("ui.common.action.cancel"),
}: {
  submitting: boolean;
  onCancel: () => void;
  submitLabel: string;
  cancelLabel?: string;
}) => (
  <div className="flex gap-2 *:flex-1 sm:justify-end sm:*:flex-none">
    <Button
      variant="outline"
      type="button"
      onClick={onCancel}
      disabled={submitting}
    >
      {cancelLabel}
    </Button>
    <Button type="submit" disabled={submitting}>
      {submitting ? <Spinner data-icon="inline-start" /> : null}
      {submitLabel}
    </Button>
  </div>
);
