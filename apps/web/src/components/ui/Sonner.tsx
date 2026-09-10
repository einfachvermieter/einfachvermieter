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
    theme="system"
    position="top-center"
    richColors={true}
    className="toaster group"
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
        "--success-bg": "var(--color-limette-100)",
        "--success-text": "var(--color-limette-1000)",
        "--success-border": "var(--color-limette-300)",
        "--error-bg": "var(--color-himbeere-100)",
        "--error-text": "var(--color-himbeere-1000)",
        "--error-border": "var(--color-himbeere-300)",
        "--warning-bg": "var(--color-honig-100)",
        "--warning-text": "var(--color-honig-1000)",
        "--warning-border": "var(--color-honig-300)",
        "--info-bg": "var(--color-azur-100)",
        "--info-text": "var(--color-azur-1000)",
        "--info-border": "var(--color-azur-300)",
      } as CSSProperties
    }
    {...props}
  />
);

export { Sonner };
