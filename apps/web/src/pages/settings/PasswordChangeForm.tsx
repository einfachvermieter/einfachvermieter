import {
  type PasswordChangeDto,
  type PasswordPolicy,
  passwordSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiLockPasswordLine } from "@remixicon/react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SectionCard } from "@/components/common/SectionCard";
import { Form } from "@/components/form/Form";
import { PasswordPolicyHint } from "@/components/form/PasswordPolicyHint";
import { Savebar } from "@/components/form/Savebar";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import { domainVisuals } from "@/lib/domainVisuals";
import { t } from "@/lib/i18n";

/**
 * Lokales Form-Schema: wie das geteilte `makePasswordChangeSchema`, plus
 * Wiederholungsfeld (nicht mit über die API mitgesendet). Das neue Passwort wird
 * gegen die (per ENV konfigurierbare) Policy geprüft.
 */
const makeSchema = (policy: PasswordPolicy) =>
  z
    .object({
      currentPassword: z
        .string()
        .min(1, t("ui.settings.password.validation.currentRequired")),
      newPassword: passwordSchema(policy),
      newPasswordConfirm: z.string(),
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: t("ui.settings.password.validation.mustDiffer"),
      path: ["newPassword"],
    })
    .refine((data) => data.newPassword === data.newPasswordConfirm, {
      message: t("ui.settings.password.validation.confirmMismatch"),
      path: ["newPasswordConfirm"],
    });

type PasswordChangeFormValues = z.infer<ReturnType<typeof makeSchema>>;

type PasswordChangeFormProps = {
  policy: PasswordPolicy;
  onSubmit: (values: PasswordChangeDto) => Promise<void>;
  onCancel: () => void;
};

export const PasswordChangeForm = ({
  policy,
  onSubmit,
  onCancel,
}: PasswordChangeFormProps) => {
  const schema = useMemo(() => makeSchema(policy), [policy]);
  const form = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(schema),
    reValidateMode: "onSubmit",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      newPasswordConfirm: "",
    },
  });

  const submitting = form.formState.isSubmitting;

  const handleSubmit = async (values: PasswordChangeFormValues) => {
    await onSubmit({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    form.reset();
  };

  return (
    <Form form={form} onSubmit={handleSubmit} guardUnsavedChanges={false}>
      <fieldset disabled={submitting} className="contents">
        <SectionCard
          icon={RiLockPasswordLine}
          iconBackground={domainVisuals.configuration.accent}
          title={t("ui.settings.password.credentialsTitle")}
        >
          <FieldGroup className="gap-4">
            <TextInput
              control={form.control}
              name="currentPassword"
              label={t("ui.settings.password.fields.current")}
              type="password"
              autoComplete="current-password"
            />
            <TextInput
              control={form.control}
              name="newPassword"
              label={t("ui.settings.password.fields.new")}
              description={<PasswordPolicyHint policy={policy} />}
              type="password"
              autoComplete="new-password"
            />
            <TextInput
              control={form.control}
              name="newPasswordConfirm"
              label={t("ui.settings.password.fields.confirm")}
              type="password"
              autoComplete="new-password"
            />
          </FieldGroup>
        </SectionCard>
      </fieldset>
      <Savebar
        dirty={form.formState.isDirty}
        submitting={submitting}
        onCancel={onCancel}
      />
    </Form>
  );
};
