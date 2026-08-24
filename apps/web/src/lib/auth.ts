import type {
  PasswordChangeDto,
  PasswordPolicy,
  PasswordRecoveryDto,
  ProfileUpdateDto,
} from "@einfachvermieter/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "./api";

export type AuthUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: "admin" | "resident";
  residentId: string | null;
};

/**
 * Angemeldete Identität. Wird minütlich und beim Zurückkehren ins Fenster
 * nachgeladen, damit eine abgelaufene Session spätestens nach 60s auffällt.
 */
export const authMeQueryOptions = {
  queryKey: ["auth", "me"],
  queryFn: async () => {
    const data = await api.get<{ user: AuthUser }>("/auth/me");
    return data.user;
  },
  retry: false,
  staleTime: 60_000,
  refetchInterval: 60_000,
  refetchOnWindowFocus: true,
} as const;

export const useCurrentUser = () => useQuery(authMeQueryOptions);

/**
 * Passwort-Richtlinie vom Server (ENV-konfiguriert), zum Anzeigen der
 * Regeln und für die clientseitige Vorab-Validierung.
 */
export const passwordPolicyQueryOptions = {
  queryKey: ["auth", "password-policy"],
  queryFn: () => api.get<PasswordPolicy>("/auth/password-policy"),
  staleTime: Number.POSITIVE_INFINITY,
  retry: false,
} as const;

export const useLogin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: {
      email: string;
      password: string;
      rememberMe: boolean;
    }) => api.post<{ user: AuthUser }>("/auth/login", credentials),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data.user);
    },
  });
};

export const changePassword = (dto: PasswordChangeDto) =>
  api.post<{ success: boolean }>("/auth/change-password", dto);

/**
 * Neues Passwort ohne Anmeldung setzen. Nur im Rücksetz-Modus vorhanden,
 * sonst antwortet die API mit 404.
 */
export const recoverPassword = (dto: PasswordRecoveryDto) =>
  api.post<{ success: boolean }>("/auth/recover", dto);

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: ProfileUpdateDto) =>
      api.post<{ user: AuthUser }>("/auth/profile", dto),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data.user);
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => api.post<{ success: boolean }>("/auth/logout"),
    onSuccess: async () => {
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.clear();
      await navigate({ to: "/anmelden" });
    },
  });
};
