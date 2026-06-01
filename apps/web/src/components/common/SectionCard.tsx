import type { RemixiconComponentType } from "@remixicon/react";
import type { ReactNode } from "react";
import { IconTile } from "@/components/common/IconTile";

/**
 * Weiße Sektions-Karte mit Icon-Kachel-Kopf
 */
export const SectionCard = ({
  icon,
  iconBackground,
  title,
  description,
  action,
  children,
}: {
  icon: RemixiconComponentType;
  /** Farbe oder Verlauf aus lib/domainVisuals.ts */
  iconBackground: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <section className="mb-5 rounded-xl border border-border bg-card px-6.5 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="mb-5 flex items-center gap-3.25">
      <IconTile icon={icon} size={40} background={iconBackground} />
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[12.5px] text-slate-400">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
    {children}
  </section>
);
