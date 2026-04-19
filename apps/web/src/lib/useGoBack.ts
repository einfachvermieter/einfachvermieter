import { useNavigate } from "@tanstack/react-router";

type GoBackOptions = {
  params?: Record<string, string | undefined>;
  search?: Record<string, unknown>;
};

/**
 * Navigiert zurück zur angegebenen Route.
 * Optionale `params`/`search` für Routen mit Parametern
 */
export const useGoBack = (to: string, options?: GoBackOptions) => {
  const navigate = useNavigate();
  return () => {
    navigate({ to, ...options }).catch(() => undefined);
  };
};
