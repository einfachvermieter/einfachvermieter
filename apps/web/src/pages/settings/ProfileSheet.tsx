import {
  type ProfileUpdateDto,
  profileUpdateSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiUserLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormSheet } from "@/components/form/FormSheet";
import { TextInput } from "@/components/form/TextInput";
import { useCurrentUser, useUpdateProfile } from "@/lib/auth";
import { t } from "@/lib/i18n";

/**
 * Profil des angemeldeten Kontos im FormSheet
 */
export const ProfileSheet = ({ onClose }: { onClose: () => void }) => {
  const { data: user } = useCurrentUser();
  const updateProfile = useUpdateProfile();

  const form = useForm<ProfileUpdateDto>({
    resolver: zodResolver(profileUpdateSchema),
    reValidateMode: "onSubmit",
    values: {
      email: user?.email ?? "",
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
    },
  });

  return (
    <FormSheet
      form={form}
      icon={RiUserLine}
      title={t("ui.settings.profile.title")}
      description={t("ui.settings.profile.description")}
      submitLabel={t("ui.common.action.save")}
      onSubmit={async (values) => {
        await updateProfile.mutateAsync(values);
        toast.success(t("ui.settings.profile.saveSuccess"));
        onClose();
      }}
      onClose={onClose}
    >
      <TextInput
        control={form.control}
        name="email"
        type="email"
        label={t("ui.settings.profile.fields.email")}
        autoComplete="email"
      />
      <TextInput
        control={form.control}
        name="firstName"
        label={t("ui.settings.profile.fields.firstName")}
        autoComplete="given-name"
      />
      <TextInput
        control={form.control}
        name="lastName"
        label={t("ui.settings.profile.fields.lastName")}
        autoComplete="family-name"
      />
    </FormSheet>
  );
};
