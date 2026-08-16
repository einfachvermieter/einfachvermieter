import {
  type PasswordPolicy,
  type PasswordRecoveryDto,
  passwordSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form } from "@/components/form/Form";
import { PasswordPolicyHint } from "@/components/form/PasswordPolicyHint";
import { SelectInput } from "@/components/form/SelectInput";
import { TextInput } from "@/components/form/TextInput";
import { Button } from "@/components/ui/Button";
import { Field, FieldGroup } from "@/components/ui/Field";
import { t } from "@/lib/i18n";

/**
 * Wie das geteilte `makePasswordRecoverySchema`, plus Wiederholungsfeld
 * (das nicht mit über die API geht)
 */
const makeSchema = (policy: PasswordPolicy) =>
  z
    .object({
      email: z.string().email(t("ui.auth.emailInvalid")),
      code: z.string().min(1, t("validation.required")),
      newPassword: passwordSchema(policy),
      newPasswordConfirm: z.string(),
    })
    .refine((data) => data.newPassword === data.newPasswordConfirm, {
      message: t("ui.settings.password.validation.confirmMismatch"),
      path: ["newPasswordConfirm"],
    });

type PasswordRecoveryFormValues = z.infer<ReturnType<typeof makeSchema>>;

type PasswordRecoveryFormProps = {
  policy: PasswordPolicy;
  emails: string[];
  onSubmit: (values: PasswordRecoveryDto) => Promise<void>;
};

export const PasswordRecoveryForm = ({
  policy,
  emails,
  onSubmit,
}: PasswordRecoveryFormProps) => {
  const schema = useMemo(() => makeSchema(policy), [policy]);
  const form = useForm<PasswordRecoveryFormValues>({
    resolver: zodResolver(schema),
    reValidateMode: "onSubmit",
    defaultValues: {
      email: emails[0] ?? "",
      code: "",
      newPassword: "",
      newPasswordConfirm: "",
    },
  });

  const submitting = form.formState.isSubmitting;

  const handleSubmit = (values: PasswordRecoveryFormValues) =>
    onSubmit({
      email: values.email,
      code: values.code,
      newPassword: values.newPassword,
    });

  return (
    <Form form={form} onSubmit={handleSubmit} guardUnsavedChanges={false}>
      <fieldset disabled={submitting} className="contents">
        <FieldGroup className="gap-4">
          <SelectInput
            control={form.control}
            name="email"
            label={t("ui.recovery.fields.email")}
            options={emails.map((email) => ({ value: email, label: email }))}
          />
          <TextInput
            control={form.control}
            name="code"
            label={t("ui.recovery.fields.code")}
            description={t("ui.recovery.fields.codeDescription")}
            autoComplete="off"
          />
          <TextInput
            control={form.control}
            name="newPassword"
            label={t("ui.recovery.fields.new")}
            description={<PasswordPolicyHint policy={policy} />}
            type="password"
            autoComplete="new-password"
          />
          <TextInput
            control={form.control}
            name="newPasswordConfirm"
            label={t("ui.recovery.fields.confirm")}
            type="password"
            autoComplete="new-password"
          />
          <Field>
            <Button type="submit" disabled={submitting}>
              {t("ui.recovery.submit")}
            </Button>
          </Field>
        </FieldGroup>
      </fieldset>
    </Form>
  );
};
