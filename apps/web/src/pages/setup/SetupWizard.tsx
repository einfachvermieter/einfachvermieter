import {
  type PasswordPolicy,
  passwordSchema,
  type SetupDto,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import { z } from "zod";
import { Description } from "@/components/common/Description";
import { PasswordPolicyHint } from "@/components/form/PasswordPolicyHint";
import { TextInput } from "@/components/form/TextInput";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useAuthMode, useRunSetup } from "@/lib/setup";

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
      adminEmail: z.string(),
      adminPassword: withAdmin ? passwordSchema(policy) : z.string(),
      adminPasswordConfirm: z.string(),
      senderSkipped: z.boolean(),
      senderName: z.string(),
      senderStreet: z.string(),
      senderPostalCode: z.string(),
      senderCity: z.string(),
      buildingSkipped: z.boolean(),
      buildingName: z.string(),
      buildingStreet: z.string(),
      buildingPostalCode: z.string(),
      buildingCity: z.string(),
    })
    .superRefine((values, ctx) => {
      const required = t("ui.setup.validation.required");

      if (withAdmin) {
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
      if (!values.buildingSkipped) {
        addIssueIf(
          ctx,
          values.buildingName.trim().length === 0,
          "buildingName",
          required,
        );
        addIssueIf(
          ctx,
          values.buildingStreet.trim().length === 0,
          "buildingStreet",
          required,
        );
        addIssueIf(
          ctx,
          !/^\d{5}$/u.test(values.buildingPostalCode),
          "buildingPostalCode",
          t("ui.setup.validation.postalCodeFormat"),
        );
        addIssueIf(
          ctx,
          values.buildingCity.trim().length === 0,
          "buildingCity",
          required,
        );
      }
    });

type SetupFormValues = z.infer<ReturnType<typeof makeSetupFormSchema>>;

type StepKey = "admin" | "sender" | "building";

const STEP_FIELDS: Record<StepKey, FieldPath<SetupFormValues>[]> = {
  admin: ["adminEmail", "adminPassword", "adminPasswordConfirm"],
  sender: ["senderName", "senderStreet", "senderPostalCode", "senderCity"],
  building: [
    "buildingName",
    "buildingStreet",
    "buildingPostalCode",
    "buildingCity",
  ],
};

const toDto = (values: SetupFormValues, withAdmin: boolean): SetupDto => ({
  admin: withAdmin
    ? { email: values.adminEmail.trim(), password: values.adminPassword }
    : undefined,
  sender: values.senderSkipped
    ? undefined
    : {
        senderName: values.senderName.trim(),
        senderAddressStreet: values.senderStreet.trim(),
        senderAddressPostalCode: values.senderPostalCode.trim(),
        senderAddressCity: values.senderCity.trim(),
      },
  building: values.buildingSkipped
    ? undefined
    : {
        name: values.buildingName.trim(),
        addressStreet: values.buildingStreet.trim(),
        addressPostalCode: values.buildingPostalCode.trim(),
        addressCity: values.buildingCity.trim(),
      },
});

/**
 * Label des Primär-Buttons je nach Schritt, Datenlage und Ladezustand.
 */
const primaryButtonLabel = (params: {
  isOptionalStep: boolean;
  isLastStep: boolean;
  isPending: boolean;
  currentStepEmpty: boolean;
}): string => {
  const { isOptionalStep, isLastStep, isPending, currentStepEmpty } = params;

  if (!isOptionalStep) {
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
  const stepKeys: StepKey[] = withAdmin
    ? ["admin", "sender", "building"]
    : ["sender", "building"];
  const [step, setStep] = useState(0);
  const stepKey: StepKey = stepKeys[step] ?? "building";
  const schema = useMemo(
    () => makeSetupFormSchema(policy, withAdmin),
    [policy, withAdmin],
  );
  const form = useForm<SetupFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      adminEmail: "",
      adminPassword: "",
      adminPasswordConfirm: "",
      senderSkipped: false,
      senderName: "",
      senderStreet: "",
      senderPostalCode: "",
      senderCity: "",
      buildingSkipped: false,
      buildingName: "",
      buildingStreet: "",
      buildingPostalCode: "",
      buildingCity: "",
    },
  });

  const submit = form.handleSubmit(async (values) => {
    await runSetup.mutateAsync(toDto(values, withAdmin));
    await navigate({ to: "/" });
  });

  const isStepEmpty = (fields: FieldPath<SetupFormValues>[] = []): boolean =>
    fields.every((field) => String(form.getValues(field)).trim().length === 0);

  // Optionale Schritte (Absender/Gebäude) gelten als übersprungen, wenn alle
  // Felder leer sind. Sobald eines ausgefüllt ist, müssen alle ausgefüllt sein.
  const syncOptionalSkip = () => {
    if (stepKey === "sender") {
      form.setValue("senderSkipped", isStepEmpty(STEP_FIELDS.sender));
    } else if (stepKey === "building") {
      form.setValue("buildingSkipped", isStepEmpty(STEP_FIELDS.building));
    }
  };

  const isLastStep = step === stepKeys.length - 1;

  const handlePrimary = async (event: FormEvent) => {
    event.preventDefault();
    syncOptionalSkip();

    if (!isLastStep) {
      if (await form.trigger(STEP_FIELDS[stepKey])) {
        setStep((current) => current + 1);
      }

      return;
    }

    await submit();
  };

  const alreadyDone =
    runSetup.error instanceof ApiError && runSetup.error.status === 409;
  const isOptionalStep = stepKey !== "admin";

  // Reaktiv (watch), damit das Button-Label sofort umschlägt, sobald in einem
  // optionalen Schritt etwas eingegeben wird.
  const watchedValues = form.watch(STEP_FIELDS[stepKey]);
  const currentStepEmpty = watchedValues.every(
    (value) => String(value ?? "").trim().length === 0,
  );

  const primaryLabel = primaryButtonLabel({
    isOptionalStep,
    isLastStep,
    isPending: runSetup.isPending,
    currentStepEmpty,
  });

  return (
    <form
      onSubmit={handlePrimary}
      noValidate={true}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {t("ui.setup.stepIndicator", {
            current: step + 1,
            total: stepKeys.length,
          })}
        </p>
        <h3 className="text-base font-heading font-semibold text-foreground flex items-center gap-2">
          {t(`ui.setup.${stepKey}.heading`)}
          {isOptionalStep ? (
            <Badge variant="secondary">{t("ui.setup.optionalBadge")}</Badge>
          ) : (
            <Badge variant="outline">{t("ui.setup.requiredBadge")}</Badge>
          )}
        </h3>
        <Description>
          {isOptionalStep
            ? t("ui.setup.optionalHint")
            : t("ui.setup.requiredHint")}
        </Description>
      </div>

      {stepKey === "admin" ? (
        <div className="flex flex-col gap-4">
          <TextInput
            control={form.control}
            name="adminEmail"
            label={t("ui.setup.admin.email")}
            required={true}
            type="email"
            autoComplete="username"
          />
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
        <div className="flex flex-col gap-4">
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

      {stepKey === "building" ? (
        <div className="flex flex-col gap-4">
          <TextInput
            control={form.control}
            name="buildingName"
            label={t("ui.setup.building.name")}
            required={true}
          />
          <TextInput
            control={form.control}
            name="buildingStreet"
            label={t("ui.setup.building.street")}
            required={true}
          />
          <TextInput
            control={form.control}
            name="buildingPostalCode"
            label={t("ui.setup.building.postalCode")}
            required={true}
          />
          <TextInput
            control={form.control}
            name="buildingCity"
            label={t("ui.setup.building.city")}
            required={true}
          />
        </div>
      ) : null}

      {runSetup.isError ? (
        <p className="text-sm text-destructive">
          {alreadyDone
            ? t("ui.setup.error.alreadyDone")
            : t("ui.setup.error.generic")}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
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
        <Button type="submit" disabled={runSetup.isPending}>
          {primaryLabel}
        </Button>
      </div>
    </form>
  );
};
