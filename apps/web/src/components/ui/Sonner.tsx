import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiLoaderLine,
} from "@remixicon/react";
import type { CSSProperties } from "react";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

/**
 * Toast/Meldungen (Sonner) oben mittig
 */
const Sonner = ({ ...props }: ToasterProps) => (
  <SonnerToaster
    theme="light"
    position="top-center"
    richColors={true}
    className="toaster group"
    toastOptions={{ classNames: { toast: "shadow-dialog" } }}
    icons={{
      success: <RiCheckboxCircleLine className="size-4" />,
      info: <RiInformationLine className="size-4" />,
      warning: <RiErrorWarningLine className="size-4" />,
      error: <RiCloseCircleLine className="size-4" />,
      loading: <RiLoaderLine className="size-4 animate-spin" />,
    }}
    style={
      {
        "--width": "32rem",
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius)",
        "--success-bg": "var(--color-limette-50)",
        "--success-text": "var(--color-limette-900)",
        "--success-border": "var(--color-limette-500)",
        "--error-bg": "var(--color-himbeere-50)",
        "--error-text": "var(--color-himbeere-900)",
        "--error-border": "var(--color-himbeere-500)",
        "--warning-bg": "var(--color-honig-50)",
        "--warning-text": "var(--color-honig-900)",
        "--warning-border": "var(--color-honig-500)",
        "--info-bg": "var(--color-azur-50)",
        "--info-text": "var(--color-azur-900)",
        "--info-border": "var(--color-azur-500)",
      } as CSSProperties
    }
    {...props}
  />
);

export { Sonner };
