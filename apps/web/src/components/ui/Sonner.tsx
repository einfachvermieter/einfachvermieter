import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiLoaderLine,
} from "@remixicon/react";
import type { CSSProperties } from "react";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

const Sonner = ({ ...props }: ToasterProps) => (
  <SonnerToaster
    theme="system"
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
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius)",
      } as CSSProperties
    }
    toastOptions={{
      classNames: {
        toast: "cn-toast",
      },
    }}
    {...props}
  />
);

export { Sonner };
