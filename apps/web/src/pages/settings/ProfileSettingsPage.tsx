import {
  type ProfileUpdateDto,
  profileUpdateSchema,
} from "@einfachvermieter/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiUserLine } from "@remixicon/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { SectionCard } from "@/components/common/SectionCard";
import { Form } from "@/components/form/Form";
import { Savebar } from "@/components/form/Savebar";
import { TextInput } from "@/components/form/TextInput";
import { FieldGroup } from "@/components/ui/Field";
import { useCurrentUser, useUpdateProfile } from "@/lib/auth";
import { domainVisuals } from "@/lib/domainVisuals";
import { t } from "@/lib/i18n";
import { useGoBack } from "@/lib/useGoBack";
import { SettingsLayout } from "./SettingsLayout";

export const ProfileSettingsPage = () => {
  const { data: user } = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const goHome = useGoBack("/");

  const form = useForm<ProfileUpdateDto>({
    resolver: zodResolver(profileUpdateSchema),
    values: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
    },
  });

  const submitting = form.formState.isSubmitting;

  const handleSubmit = async (values: ProfileUpdateDto) => {
    await updateProfile.mutateAsync(values);
    toast.success(t("ui.settings.profile.saveSuccess"));
  };

  return (
    <SettingsLayout
      active="profile"
      title={t("ui.settings.profile.title")}
      description={t("ui.settings.profile.description")}
    >
      <Form form={form} onSubmit={handleSubmit} guardUnsavedChanges={false}>
        <fieldset disabled={submitting} className="contents">
          <SectionCard
            icon={RiUserLine}
            iconBackground={domainVisuals.configuration.accent}
            title={t("ui.settings.profile.sectionTitle")}
          >
            <FieldGroup className="gap-4">
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
            </FieldGroup>
          </SectionCard>
        </fieldset>
        <Savebar
          dirty={form.formState.isDirty}
          submitting={submitting}
          onCancel={goHome}
        />
      </Form>
    </SettingsLayout>
  );
};
