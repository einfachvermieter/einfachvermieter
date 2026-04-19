import { type ReactNode, useEffect, useState } from "react";
import { Spinner } from "@/components/common/Spinner";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";

const POLL_INTERVAL_MS = 500;
const TOTAL_BUDGET_MS = 10_000;
const REQUEST_TIMEOUT_MS = 1500;

type Status = "checking" | "ready" | "unavailable";

const checkHealth = async (signal: AbortSignal): Promise<boolean> => {
  const requestController = new AbortController();
  const onAbort = () => requestController.abort();
  signal.addEventListener("abort", onAbort);
  const timeout = setTimeout(
    () => requestController.abort(),
    REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch("/api/health", {
      signal: requestController.signal,
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", onAbort);
  }
};

const BackendReadyChecker = ({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry: () => void;
}) => {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = Date.now();

    const poll = async (): Promise<void> => {
      while (!controller.signal.aborted) {
        if (await checkHealth(controller.signal)) {
          if (!controller.signal.aborted) {
            setStatus("ready");
          }
          return;
        }
        if (controller.signal.aborted) {
          return;
        }
        if (Date.now() - startedAt >= TOTAL_BUDGET_MS) {
          setStatus("unavailable");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    };

    poll().catch(() => {
      // ignore, just for linting
    });
    return () => controller.abort();
  }, []);

  if (status === "ready") {
    return <>{children}</>;
  }

  if (status === "unavailable") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            {t("startup.stillUnavailableTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("startup.stillUnavailable")}
          </p>
          <Button onClick={onRetry}>{t("startup.retry")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <Spinner className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t("startup.connecting")}
        </p>
      </div>
    </div>
  );
};

export const BackendReadyGate = ({ children }: { children: ReactNode }) => {
  const [attempt, setAttempt] = useState(0);

  return (
    <BackendReadyChecker key={attempt} onRetry={() => setAttempt((a) => a + 1)}>
      {children}
    </BackendReadyChecker>
  );
};
