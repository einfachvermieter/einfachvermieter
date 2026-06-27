import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { type ComponentProps, type FormEvent, useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { useLogin } from "../../lib/auth";
import { t } from "../../lib/i18n";
import { cn } from "../../lib/utils";

const schema = z.object({
  email: z.string().email(t("ui.auth.emailInvalid")),
  password: z.string().min(1, t("ui.auth.passwordRequired")),
});

type LoginFormValues = z.infer<typeof schema>;

export const LoginForm = ({
  className,
  ...props
}: Omit<ComponentProps<"form">, "onSubmit">) => {
  const navigate = useNavigate();
  const login = useLogin();
  const formId = useId();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    await login.mutateAsync(values);
    await navigate({ to: "/" });
  });

  /**
   * Vorherigen API-Fehler vor jedem Versuch verwerfen
   */
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    login.reset();
    return submit(event);
  };

  return (
    <form
      id={formId}
      onSubmit={onSubmit}
      noValidate={true}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${formId}-email`}>
                {t("ui.auth.email")}
              </FieldLabel>
              <Input
                {...field}
                id={`${formId}-email`}
                type="email"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${formId}-password`}>
                {t("ui.auth.password")}
              </FieldLabel>
              <Input
                {...field}
                id={`${formId}-password`}
                type="password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : null}
            </Field>
          )}
        />
        {login.isError ? (
          <FieldError>{t("errors.loginFailed")}</FieldError>
        ) : null}
        <Field>
          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? t("ui.auth.loggingIn") : t("ui.auth.login")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
};
