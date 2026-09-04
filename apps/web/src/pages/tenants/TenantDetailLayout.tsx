import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { TenantDetailHeader } from "./TenantDetailHeader";
import { TenantHero } from "./TenantHero";
import { TenantKpiRow } from "./TenantKpiRow";

/**
 * Gemeinsames Gerüst der Mieter-Detailseiten: Hero, Bereichs-Pills und
 * Kennzahl-Reihe
 */
export const TenantDetailLayout = ({
  tenantId,
  active,
  action,
  className,
  children,
}: {
  tenantId: string;
  active: "stammdaten" | "konto";
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <div className={cn("max-w-225", className)}>
    <TenantHero tenantId={tenantId} action={action} />

    <div className="flex flex-col gap-2">
      <TenantDetailHeader tenantId={tenantId} active={active} />

      <div className="space-y-5">
        <TenantKpiRow tenantId={tenantId} />
        {children}
      </div>
    </div>
  </div>
);
