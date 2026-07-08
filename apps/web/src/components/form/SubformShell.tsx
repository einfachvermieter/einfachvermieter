import { type ReactNode, useContext } from "react";
import { Button } from "@/components/ui/Button";
import { t } from "../../lib/i18n";
import { SubformSubmitContext } from "./subformSubmit";

/**
 * Formloser Rahmen für Zeilen-Formulare im InlineSubform. Darf kein
 * <form>-Element rendern, weil er inline im Haupt-<form> der Seite steckt
 */
export const SubformShell = ({
  onSubmit,
  onCancel,
  submitLabel,
  children,
}: {
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
  children: ReactNode;
}) => {
  const injected = useContext(SubformSubmitContext);
  const label = injected?.label ?? submitLabel ?? t("ui.common.action.confirm");
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Delegierter Enter-Handler für die Eingabefelder, kein interaktives Element
    <div
      className="space-y-5"
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          event.stopPropagation();
          onSubmit();
        }
      }}
    >
      {children}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" type="button" onClick={onCancel}>
          {t("ui.common.action.cancel")}
        </Button>
        <Button size="sm" type="button" onClick={onSubmit}>
          {injected?.icon}
          {label}
        </Button>
      </div>
    </div>
  );
};
