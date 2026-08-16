import type { PasswordRecoveryDto } from "@einfachvermieter/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Spinner } from "@/components/common/Spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { passwordPolicyQueryOptions, recoverPassword } from "@/lib/auth";
import { setupStatusQueryOptions } from "@/lib/setup";
import logoUrl from "../../img/logo/logo.svg";
import { useDocumentTitle } from "../../lib/documentTitle";
import { t } from "../../lib/i18n";
import { PasswordRecoveryForm } from "./PasswordRecoveryForm";

/**
 * Rücksetz-Modus: einziger erreichbarer Bildschirm, solange die
 * Umgebungsvariable gesetzt ist. Nach dem Setzen bleibt die App gesperrt, die
 * Erfolgsmeldung nennt deshalb den nächsten Schritt (Variable entfernen,
 * Container neu starten).
 */
export const PasswordRecoveryPage = () => {
  useDocumentTitle(t("ui.recovery.title"));
  const { data: policy } = useQuery(passwordPolicyQueryOptions);
  const { data: status } = useQuery(setupStatusQueryOptions);
  const [submitted, setSubmitted] = useState(false);

  // Nach einem Neuladen erkennt der Server das erledigte Zurücksetzen, das
  // Formular kommt also nicht ein zweites Mal.
  const done = submitted || status?.recoveryUsed === true;
  const emails = status?.recoveryEmails ?? [];
  // Ohne Konto gibt es nichts zurückzusetzen: dann nur der Weg zurück in den
  // Regelbetrieb, wo der Einrichtungsassistent übernimmt.
  const empty = status !== undefined && emails.length === 0;

  const openDescription = empty
    ? t("ui.recovery.noAccounts")
    : t("ui.recovery.description");
  const description = done
    ? t("ui.recovery.successDescription")
    : openDescription;

  const handleSubmit = async (values: PasswordRecoveryDto) => {
    await recoverPassword(values);
    setSubmitted(true);
  };

  return (
    <div className="auth-wash flex min-h-dvh items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-8">
        <div className="flex items-center justify-center gap-3 font-medium">
          <img src={logoUrl} alt="" className="size-12" />
          <span className="font-heading font-bold text-3xl">
            <span className="text-sky-700">{t("common.appName.Einfach")}</span>
            <span className="text-teal-600">
              {t("common.appName.Vermieter")}
            </span>
          </span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              {done ? t("ui.recovery.successTitle") : t("ui.recovery.title")}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          {done || empty ? null : (
            <CardContent>
              {policy && status ? (
                <PasswordRecoveryForm
                  policy={policy}
                  emails={emails}
                  onSubmit={handleSubmit}
                />
              ) : (
                <div className="flex justify-center py-6">
                  <Spinner className="size-6 text-muted-foreground" />
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};
