import {
  type PasswordPolicy,
  passwordSchema,
  type SetupDto,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiToggleFill } from "@remixicon/react";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import { z } from "zod";
import { Description } from "@/components/common/Description";
import { ExternalLink } from "@/components/common/ExternalLink";
import { PasswordPolicyHint } from "@/components/form/PasswordPolicyHint";
import { SwitchInput } from "@/components/form/SwitchInput";
import { TextInput } from "@/components/form/TextInput";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useAuthMode, usePrivacyUrl, useRunSetup } from "@/lib/setup";
import {
  type InternetRecommendation,
  InternetRecommendationDialog,
} from "./InternetRecommendationDialog";
import { SetupStepper } from "./SetupStepper";

/**
 * Fügt eine "custom"-Validierungsmeldung für `path` hinzu, wenn `invalid`.
 */
const addIssueIf = (
  ctx: z.RefinementCtx,
  invalid: boolean,
  path: string,
  message: string,
): void => {
  if (invalid) {
    ctx.addIssue({ code: "custom", path: [path], message });
  }
};

/**
 * Schema-Factory: das Admin-Passwort wird gegen die (per ENV konfigurierbare)
 * Policy geprüft, die zur Laufzeit vom Server kommt. Ohne Admin-Schritt
 * (Desktop-App, `local`-Auth-Modus) entfallen die Admin-Prüfungen.
 */
const makeSetupFormSchema = (policy: PasswordPolicy, withAdmin: boolean) =>
  z
    .object({
      adminFirstName: z.string(),
      adminLastName: z.string(),
      adminEmail: z.string(),
      adminPassword: withAdmin ? passwordSchema(policy) : z.string(),
      adminPasswordConfirm: z.string(),
      senderSkipped: z.boolean(),
      senderName: z.string(),
      senderStreet: z.string(),
      senderPostalCode: z.string(),
      senderCity: z.string(),
      climateFactorsAutoFetch: z.boolean(),
      updateCheckEnabled: z.boolean(),
      telemetryEnabled: z.boolean(),
    })
    .superRefine((values, ctx) => {
      const required = t("ui.setup.validation.required");

      if (withAdmin) {
        addIssueIf(
          ctx,
          values.adminFirstName.trim().length === 0,
          "adminFirstName",
          required,
        );
        addIssueIf(
          ctx,
          values.adminLastName.trim().length === 0,
          "adminLastName",
          required,
        );
        addIssueIf(
          ctx,
          !z.string().email().safeParse(values.adminEmail).success,
          "adminEmail",
          t("ui.setup.validation.emailFormat"),
        );
        addIssueIf(
          ctx,
          values.adminPasswordConfirm !== values.adminPassword,
          "adminPasswordConfirm",
          t("ui.setup.validation.passwordMismatch"),
        );
      }

      if (!values.senderSkipped) {
        const senderFields: [string, string][] = [
          ["senderName", values.senderName],
          ["senderStreet", values.senderStreet],
          ["senderPostalCode", values.senderPostalCode],
          ["senderCity", values.senderCity],
        ];
        for (const [field, value] of senderFields) {
          addIssueIf(ctx, value.trim().length === 0, field, required);
        }
      }
    });

type SetupFormValues = z.infer<ReturnType<typeof makeSetupFormSchema>>;

type StepKey = "welcome" | "admin" | "sender" | "internet";

/**
 * Die drei empfohlenen Internetzugriffe und ihr Feld im Formular.
 */
const INTERNET_RECOMMENDATIONS: {
  key: InternetRecommendation;
  field: FieldPath<SetupFormValues>;
}[] = [
  { key: "climateFactors", field: "climateFactorsAutoFetch" },
  { key: "updateCheck", field: "updateCheckEnabled" },
  { key: "telemetry", field: "telemetryEnabled" },
];

const STEP_FIELDS: Record<StepKey, FieldPath<SetupFormValues>[]> = {
  welcome: [],
  admin: [
    "adminFirstName",
    "adminLastName",
    "adminEmail",
    "adminPassword",
    "adminPasswordConfirm",
  ],
  sender: ["senderName", "senderStreet", "senderPostalCode", "senderCity"],
  internet: INTERNET_RECOMMENDATIONS.map(({ field }) => field),
};

const toDto = (values: SetupFormValues, withAdmin: boolean): SetupDto => ({
  admin: withAdmin
    ? {
        firstName: values.adminFirstName.trim(),
        lastName: values.adminLastName.trim(),
        email: values.adminEmail.trim(),
        password: values.adminPassword,
      }
    : undefined,
  sender: values.senderSkipped
    ? undefined
    : {
        senderName: values.senderName.trim(),
        senderAddressStreet: values.senderStreet.trim(),
        senderAddressPostalCode: values.senderPostalCode.trim(),
        senderAddressCity: values.senderCity.trim(),
      },
  internet: {
    climateFactorsAutoFetch: values.climateFactorsAutoFetch,
    updateCheckEnabled: values.updateCheckEnabled,
    telemetryEnabled: values.telemetryEnabled,
  },
});

/**
 * Label des Primär-Buttons je nach Schritt, Datenlage und Ladezustand.
 */
const primaryButtonLabel = (params: {
  stepKey: StepKey;
  isLastStep: boolean;
  isPending: boolean;
  currentStepEmpty: boolean;
}): string => {
  const { stepKey, isLastStep, isPending, currentStepEmpty } = params;

  if (stepKey === "welcome") {
    return t("ui.setup.action.start");
  }
  if (stepKey === "admin") {
    return t("ui.setup.action.next");
  }

  if (isLastStep) {
    if (isPending) {
      return t("ui.setup.action.finishing");
    }

    return currentStepEmpty
      ? t("ui.setup.action.skipAndFinish")
      : t("ui.setup.action.finish");
  }

  return currentStepEmpty
    ? t("ui.setup.action.skip")
    : t("ui.setup.action.next");
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Länge durch Markup
export const SetupWizard = ({ policy }: { policy: PasswordPolicy }) => {
  const navigate = useNavigate();
  const runSetup = useRunSetup();
  // Desktop-App (`local`): kein Login, also auch kein Admin-Konto-Schritt
  const withAdmin = useAuthMode() !== "local";
  const privacyUrl = usePrivacyUrl();
  const stepKeys: StepKey[] = withAdmin
    ? ["welcome", "admin", "sender", "internet"]
    : ["welcome", "sender", "internet"];
  const [step, setStep] = useState(0);
  const [missingRecommendations, setMissingRecommendations] = useState<
    InternetRecommendation[]
  >([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAnswered, setConfirmAnswered] = useState(false);
  const stepKey: StepKey = stepKeys[step] ?? "internet";
  const schema = useMemo(
    () => makeSetupFormSchema(policy, withAdmin),
    [policy, withAdmin],
  );
  const form = useForm<SetupFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      adminFirstName: "",
      adminLastName: "",
      adminEmail: "",
      adminPassword: "",
      adminPasswordConfirm: "",
      senderSkipped: false,
      senderName: "",
      senderStreet: "",
      senderPostalCode: "",
      senderCity: "",
      // Internetzugriffe sind Opt-in: standardmäßig aus
      climateFactorsAutoFetch: false,
      updateCheckEnabled: false,
      telemetryEnabled: false,
    },
  });

  const submit = form.handleSubmit(async (values) => {
    await runSetup.mutateAsync(toDto(values, withAdmin));
    await navigate({ to: "/" });
  });

  const isStepEmpty = (fields: FieldPath<SetupFormValues>[] = []): boolean =>
    fields.every((field) => String(form.getValues(field)).trim().length === 0);

  // Der Absender gilt als übersprungen, wenn alle Felder leer sind. Sobald
  // eines ausgefüllt ist, müssen alle ausgefüllt sein.
  const syncOptionalSkip = () => {
    if (stepKey === "sender") {
      form.setValue("senderSkipped", isStepEmpty(STEP_FIELDS.sender));
    }
  };

  const isLastStep = step === stepKeys.length - 1;

  const enableRecommended = () => {
    for (const field of STEP_FIELDS.internet) {
      form.setValue(field, true, { shouldDirty: true });
    }
  };

  const handlePrimary = async (event: FormEvent) => {
    event.preventDefault();
    syncOptionalSkip();

    if (!isLastStep) {
      if (await form.trigger(STEP_FIELDS[stepKey])) {
        setStep((current) => current + 1);
      }

      return;
    }

    // Vor dem Abschluss einmal nachfragen, welche Empfehlungen aus sind.
    if (!confirmAnswered) {
      const missing = INTERNET_RECOMMENDATIONS.filter(
        ({ field }) => form.getValues(field) !== true,
      ).map(({ key }) => key);

      if (missing.length > 0) {
        setMissingRecommendations(missing);
        setConfirmOpen(true);

        return;
      }
    }

    await submit();
  };

  const finishAfterConfirm = async (acceptRecommendations: boolean) => {
    setConfirmAnswered(true);
    setConfirmOpen(false);

    if (acceptRecommendations) {
      enableRecommended();
    }

    await submit();
  };

  const alreadyDone =
    runSetup.error instanceof ApiError && runSetup.error.status === 409;
  // Reaktiv (watch), damit das Button-Label sofort umschlägt, sobald in einem
  // optionalen Schritt etwas eingegeben wird.
  const watchedValues = form.watch(STEP_FIELDS[stepKey]);
  const currentStepEmpty = watchedValues.every(
    (value) => String(value ?? "").trim().length === 0,
  );

  const recommendedBadge = (
    <Badge variant="ok">{t("ui.internetAccess.recommended")}</Badge>
  );

  // Badge nur bei Schritten mit Feldern: Admin Pflicht, Absender optional.
  // Der Internet-Schritt hat Schalter, dort wird immer entschieden.
  const stepHints: Partial<Record<StepKey, string>> = {
    welcome: withAdmin
      ? t("ui.setup.welcome.hint")
      : t("ui.setup.welcome.hintLocal"),
    sender: t("ui.setup.optionalHint"),
    internet: t("ui.setup.internet.hint"),
  };
  const stepBadges: Partial<Record<StepKey, ReactNode>> = {
    admin: <Badge variant="neutral">{t("ui.setup.requiredBadge")}</Badge>,
    sender: <Badge variant="neutral">{t("ui.setup.optionalBadge")}</Badge>,
  };
  const stepHint = stepHints[stepKey];
  const stepBadge = stepBadges[stepKey] ?? null;

  const primaryLabel = primaryButtonLabel({
    stepKey,
    isLastStep,
    isPending: runSetup.isPending,
    currentStepEmpty,
  });

  const stepperProps = {
    labels: stepKeys.map((key) => t(`ui.setup.${key}.heading`)),
    current: step,
    srLabel: t("ui.setup.stepIndicator", {
      current: step + 1,
      total: stepKeys.length,
    }),
  };

  return (
    <div className="grid sm:min-h-130 sm:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="border-b border-border bg-muted px-6 py-5 sm:border-r sm:border-b-0 sm:py-7">
        <p className="mb-4 text-2xs font-medium uppercase tracking-wider text-muted-foreground max-sm:hidden">
          {t("ui.setup.title")}
        </p>
        <SetupStepper
          {...stepperProps}
          orientation="vertical"
          className="max-sm:hidden"
        />
        <SetupStepper {...stepperProps} className="sm:hidden" />
      </aside>

      <form
        onSubmit={handlePrimary}
        noValidate={true}
        className="flex flex-col"
      >
        <div className="flex flex-1 flex-col gap-6 p-6 sm:p-7">
          <div className="flex flex-col gap-1">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              {t(`ui.setup.${stepKey}.heading`)}
              {stepBadge}
            </h3>
            {stepHint ? <Description>{stepHint}</Description> : null}
          </div>

          {stepKey === "admin" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput
                control={form.control}
                name="adminFirstName"
                label={t("ui.setup.admin.firstName")}
                required={true}
                autoComplete="given-name"
              />
              <TextInput
                control={form.control}
                name="adminLastName"
                label={t("ui.setup.admin.lastName")}
                required={true}
                autoComplete="family-name"
              />
              <div className="sm:col-span-2">
                <TextInput
                  control={form.control}
                  name="adminEmail"
                  label={t("ui.setup.admin.email")}
                  required={true}
                  type="email"
                  autoComplete="username"
                />
              </div>
              <TextInput
                control={form.control}
                name="adminPassword"
                label={t("ui.setup.admin.password")}
                required={true}
                description={<PasswordPolicyHint policy={policy} />}
                type="password"
                autoComplete="new-password"
              />
              <TextInput
                control={form.control}
                name="adminPasswordConfirm"
                label={t("ui.setup.admin.passwordConfirm")}
                required={true}
                type="password"
                autoComplete="new-password"
              />
            </div>
          ) : null}

          {stepKey === "sender" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextInput
                control={form.control}
                name="senderName"
                label={t("ui.setup.sender.name")}
                required={true}
              />
              <TextInput
                control={form.control}
                name="senderStreet"
                label={t("ui.setup.sender.street")}
                required={true}
              />
              <TextInput
                control={form.control}
                name="senderPostalCode"
                label={t("ui.setup.sender.postalCode")}
                required={true}
              />
              <TextInput
                control={form.control}
                name="senderCity"
                label={t("ui.setup.sender.city")}
                required={true}
              />
            </div>
          ) : null}

          {stepKey === "internet" ? (
            <div className="flex flex-col gap-4">
              <SwitchInput
                control={form.control}
                name="climateFactorsAutoFetch"
                label={t("ui.internetAccess.climateFactors.label")}
                labelBadge={recommendedBadge}
                labelHelp={t("ui.internetAccess.climateFactors.details")}
                description={t("ui.internetAccess.climateFactors.description")}
              />
              <SwitchInput
                control={form.control}
                name="updateCheckEnabled"
                label={t("ui.internetAccess.updateCheck.label")}
                labelBadge={recommendedBadge}
                labelHelp={t("ui.internetAccess.updateCheck.details")}
                description={t("ui.internetAccess.updateCheck.description")}
              />
              <SwitchInput
                control={form.control}
                name="telemetryEnabled"
                label={t("ui.internetAccess.telemetry.label")}
                labelBadge={recommendedBadge}
                labelHelp={t("ui.internetAccess.telemetry.details")}
                description={t("ui.internetAccess.telemetry.description")}
              />
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="default"
                  onClick={enableRecommended}
                >
                  <RiToggleFill />
                  {t("ui.setup.internet.enableRecommended")}
                </Button>
              </div>
              {privacyUrl ? (
                <div className="flex justify-center text-sm text-muted-foreground">
                  <ExternalLink
                    href={privacyUrl}
                    label={t("ui.internetAccess.privacy")}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {runSetup.isError ? (
            <p className="text-sm text-destructive">
              {alreadyDone
                ? t("ui.setup.error.alreadyDone")
                : t("ui.setup.error.generic")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-between sm:px-7">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              disabled={runSetup.isPending}
              onClick={() => setStep((current) => current - 1)}
            >
              {t("ui.setup.action.back")}
            </Button>
          ) : null}
          <div className="flex flex-col sm:ml-auto">
            <Button type="submit" disabled={runSetup.isPending}>
              {primaryLabel}
            </Button>
          </div>
        </div>
      </form>

      <InternetRecommendationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        missing={missingRecommendations}
        onKeep={() => finishAfterConfirm(false)}
        onAccept={() => finishAfterConfirm(true)}
      />
    </div>
  );
};
