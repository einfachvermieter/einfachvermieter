import type { SetupDto, SetupStatus } from "@einfachvermieter/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { AuthUser } from "./auth";

/**
 * Erststart-Status. `staleTime: Infinity`, weil `needsSetup` nach der
 * Einrichtung nie mehr `true` wird (und `authMode` pro Prozess fix ist).
 * So läuft die Prüfung in `requireAuth` nur einmal pro Session statt bei
 * jeder Navigation.
 */
export const setupStatusQueryOptions = {
  queryKey: ["setup", "status"],
  queryFn: () => api.get<SetupStatus>("/setup/status"),
  staleTime: Number.POSITIVE_INFINITY,
  retry: false,
} as const;

/**
 * Auth-Modus der Instanz. `local` (Desktop-App) hat keinen Login: Anmelden,
 * Abmelden und Passwort ändern entfallen dort. Solange der Status noch lädt,
 * wird konservativ `session` angenommen.
 */
export const useAuthMode = (): SetupStatus["authMode"] => {
  const { data } = useQuery(setupStatusQueryOptions);

  return data?.authMode ?? "session";
};

export const useRunSetup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SetupDto) => api.post<{ user: AuthUser }>("/setup", dto),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data.user);
      queryClient.setQueryData<SetupStatus>(
        ["setup", "status"],
        (previous) => ({
          needsSetup: false,
          authMode: previous?.authMode ?? "session",
          recovery: previous?.recovery ?? false,
          recoveryEmails: previous?.recoveryEmails ?? [],
          recoveryUsed: previous?.recoveryUsed ?? false,
          databaseNewerThanApp: previous?.databaseNewerThanApp ?? null,
        }),
      );
    },
  });
};
