import { Component, type ErrorInfo, type ReactNode } from "react";
import { ApiError } from "../lib/api";
import { t } from "../lib/i18n";
import { OuterShell } from "./common/OuterShell";
import { Button } from "./ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/Card";

export const ErrorFallback = ({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) => {
  const isNetwork = error instanceof TypeError;
  const isServer = error instanceof ApiError && error.status >= 500;
  const status = error instanceof ApiError ? error.status : undefined;

  const resolveMessage = (): string => {
    if (isNetwork) {
      return t("errors.boundary.backendUnavailable");
    }
    if (isServer) {
      return t("errors.boundary.serverError", { status: status ?? 0 });
    }
    return t("errors.boundary.generic");
  };
  const message = resolveMessage();

  // Konkrete Fehlermeldung vom Server/Code anzeigen, statt sie nur in die
  // Console zu loggen.
  const detail =
    error instanceof Error && error.message && error.message !== message
      ? error.message
      : null;

  return (
    <OuterShell width="md">
      <Card>
        <CardHeader>
          <div className="flex flex-col items-center gap-1 text-center">
            <CardTitle>{t("errors.boundary.title")}</CardTitle>
            <CardDescription>{message}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            {detail ? (
              <div className="rounded-md border border-border bg-muted p-3 text-sm">
                <div className="mb-1 text-xs font-semibold text-muted-foreground">
                  {t("errors.boundary.detailsLabel")}
                </div>
                <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">
                  {detail}
                </pre>
              </div>
            ) : null}
            <div className="flex justify-center gap-2">
              <Button onClick={onRetry}>{t("errors.boundary.retry")}</Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                {t("errors.boundary.reload")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </OuterShell>
  );
};

type Props = {
  children: ReactNode;
  onReset?: () => void;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info);
  }

  handleRetry = (): void => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }
    return (
      <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />
    );
  }
}
