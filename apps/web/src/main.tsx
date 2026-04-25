import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./lib/i18n";

import { Sonner } from "@/components/ui/Sonner";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { BackendReadyGate } from "./components/BackendReadyGate";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ApiError } from "./lib/api";
import { router } from "./router";

const shouldEscalateToBoundary = (error: Error): boolean => {
  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof ApiError && error.status >= 500) {
    return true;
  }

  return false;
};

const shouldRetry = (failureCount: number, error: Error): boolean => {
  if (error instanceof ApiError) {
    if (error.status === 408 || error.status === 429) {
      return failureCount < 1;
    }

    if (error.status >= 400 && error.status < 500) {
      return false;
    }
  }

  return failureCount < 1;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
      throwOnError: shouldEscalateToBoundary,
    },
  },
});

router.update({ context: { queryClient } });

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const handleReset = (): void => {
  queryClient.resetQueries();
};

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary onReset={handleReset}>
          <BackendReadyGate>
            <RouterProvider router={router} />
          </BackendReadyGate>
        </ErrorBoundary>
        <Sonner />
      </TooltipProvider>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  </StrictMode>,
);
