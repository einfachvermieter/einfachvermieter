import type {
  PasswordChangeDto,
  PasswordPolicy,
} from "@einfachvermieter/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "./api";

export type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "resident";
  residentId: string | null;
};

export const authMeQueryOptions = {
  queryKey: ["auth", "me"],
  queryFn: async () => {
    const data = await api.get<{ user: AuthUser }>("/auth/me");
    return data.user;
  },
  retry: false,
  staleTime: 60_000,
} as const;

export const useCurrentUser = () => useQuery(authMeQueryOptions);

// Passwort-Richtlinie vom Server (ENV-konfiguriert)
// Zum  Anzeigen der Regeln und die clientseitige Vorab-Validierung
export const passwordPolicyQueryOptions = {
  queryKey: ["auth", "password-policy"],
  queryFn: () => api.get<PasswordPolicy>("/auth/password-policy"),
  staleTime: Number.POSITIVE_INFINITY,
  retry: false,
} as const;

export const useLogin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api.post<{ user: AuthUser }>("/auth/login", credentials),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data.user);
    },
  });
};

export const changePassword = (dto: PasswordChangeDto) =>
  api.post<{ success: boolean }>("/auth/change-password", dto);

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
