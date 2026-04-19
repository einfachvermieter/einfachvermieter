import type { SetupDto, SetupStatus } from "@einfachvermieter/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { AuthUser } from "./auth";

/**
 * Erststart-Status. `staleTime: Infinity`, weil `needsSetup` nach der
 * Einrichtung nie mehr `true` wird. So läuft die Prüfung in `requireAuth`
 * nur einmal pro Session statt bei jeder Navigation.
 */
export const setupStatusQueryOptions = {
  queryKey: ["setup", "status"],
  queryFn: () => api.get<SetupStatus>("/setup/status"),
  staleTime: Number.POSITIVE_INFINITY,
  retry: false,
} as const;

export const useRunSetup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SetupDto) => api.post<{ user: AuthUser }>("/setup", dto),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data.user);
      queryClient.setQueryData<SetupStatus>(["setup", "status"], {
        needsSetup: false,
      });
    },
  });
};
