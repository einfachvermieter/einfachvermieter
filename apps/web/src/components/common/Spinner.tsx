import { RiLoader4Line } from "@remixicon/react";
import type { ComponentProps } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const Spinner = ({
  className,
  ...props
}: Omit<ComponentProps<"svg">, "children">) => (
  <RiLoader4Line
    role="status"
    aria-label={t("ui.common.loading")}
    className={cn("size-4 animate-spin", className)}
    {...props}
  />
);

export { Spinner };
