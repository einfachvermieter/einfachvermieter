import {
  type PasswordChangeDto,
  type PasswordPolicy,
  passwordSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiLockPasswordLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormSheet } from "@/components/form/FormSheet";
import { PasswordPolicyHint } from "@/components/form/PasswordPolicyHint";
import { TextInput } from "@/components/form/TextInput";
import { changePassword, passwordPolicyQueryOptions } from "@/lib/auth";
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

/**
 * Passwort des angemeldeten Kontos ändern
 */
export const PasswordSheet = ({ onClose }: { onClose: () => void }) => {
  const { data: policy } = useQuery(passwordPolicyQueryOptions);

  if (!policy) {
    return null;
  }

  return <PasswordSheetForm policy={policy} onClose={onClose} />;
};

const PasswordSheetForm = ({
  policy,
  onClose,
}: {
  policy: PasswordPolicy;
  onClose: () => void;
}) => {
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

  // Fehler laufen über das Form-Error-Handling (inline am Feld), daher
  // hier nur der Erfolgs-Toast: das Passwort liegt in keiner Query.
  const handleSubmit = async (values: PasswordChangeFormValues) => {
    const dto: PasswordChangeDto = {
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    };
    await changePassword(dto);
    toast.success(t("ui.settings.password.saveSuccess"));
    form.reset();
    onClose();
  };

  return (
    <FormSheet
      form={form}
      icon={RiLockPasswordLine}
      title={t("ui.settings.password.title")}
      description={t("ui.settings.password.description")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
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
    </FormSheet>
  );
};
