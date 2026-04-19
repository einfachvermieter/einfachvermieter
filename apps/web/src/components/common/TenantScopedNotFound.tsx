import { EntityNotFound } from "@/components/common/EntityNotFound";
import { ErrorFallback } from "@/components/ErrorBoundary";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/i18n";

/**
 * Fehleranzeige für mieter-gebundene Routen, deren Loader den Mietvertrag
 * lädt: 404 -> "Mieter nicht gefunden" mit Absprung zur Liste, sonst der
 * generische Fehler-Fallback.
 */
export const TenantScopedNotFound = ({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) =>
  error instanceof ApiError && error.status === 404 ? (
    <EntityNotFound
      title={t("ui.tenants.notFound.title")}
      description={t("ui.tenants.notFound.description")}
      to="/mieter"
    />
  ) : (
    <ErrorFallback error={error} onRetry={reset} />
  );
