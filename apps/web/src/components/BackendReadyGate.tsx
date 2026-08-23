import { type ReactNode, useEffect, useState } from "react";
import { Spinner } from "@/components/common/Spinner";
import { StartupNotice } from "@/components/common/StartupNotice";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";

const POLL_INTERVAL_MS = 500;
const TOTAL_BUDGET_MS = 10_000;
const REQUEST_TIMEOUT_MS = 1500;

// Nach Ablauf des Budgets: 5 Minuten alle 10 s, danach dauerhaft jede Minute.
const SLOW_RETRY_MS = 10_000;
const SLOW_RETRY_UNTIL_MS = 5 * 60_000;
const IDLE_RETRY_MS = 60_000;

const retryDelay = (elapsedMs: number): number => {
  if (elapsedMs < TOTAL_BUDGET_MS) {
    return POLL_INTERVAL_MS;
  }
  return elapsedMs < SLOW_RETRY_UNTIL_MS ? SLOW_RETRY_MS : IDLE_RETRY_MS;
};

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
        const elapsedMs = Date.now() - startedAt;
        if (elapsedMs >= TOTAL_BUDGET_MS) {
          setStatus("unavailable");
        }
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay(elapsedMs)),
        );
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
      <StartupNotice
        title={t("startup.stillUnavailableTitle")}
        description={t("startup.stillUnavailable")}
      >
        <Button onClick={onRetry}>{t("startup.retry")}</Button>
      </StartupNotice>
    );
  }

  return (
    <StartupNotice title={t("startup.connecting")}>
      <Spinner className="size-6 text-muted-foreground" />
    </StartupNotice>
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
