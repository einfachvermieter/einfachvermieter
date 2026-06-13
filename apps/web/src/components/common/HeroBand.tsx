import type { ReactNode } from "react";

/**
 * Hero-Band auf Detail-/Formularseiten: Avatar/Icon-Kachel,
 * Name, Meta-Zeile, rechts Kennzahlen
 */
export const HeroBand = ({
  tile,
  eyebrow,
  title,
  meta,
  stats,
  action,
}: {
  /** IconTile oder InitialsAvatar in Größe 64 */
  tile: ReactNode;
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
  stats?: { label: string; value: ReactNode }[];

  /** Aktions-Buttons rechts außen (z. B. Finalisieren/Stornieren) */
  action?: ReactNode;
}) => (
  <div className="relative mb-5.5 flex items-center gap-5.5 overflow-hidden rounded-2xl border border-border bg-card px-6.5 py-5.5 max-md:flex-wrap">
    <div
      aria-hidden={true}
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(30rem_16rem_at_0%_0%,var(--color-sky-50),transparent_60%),radial-gradient(28rem_16rem_at_100%_130%,var(--color-teal-50),transparent_60%)] dark:bg-none"
    />
    <div className="relative shrink-0">{tile}</div>
    <div className="relative min-w-0">
      {eyebrow ? (
        <div className="text-xs font-semibold tracking-wider text-teal-600 uppercase">
          {eyebrow}
        </div>
      ) : null}
      <h1 className="mt-0.75 text-[26px] font-semibold">{title}</h1>
      {meta ? (
        <div className="mt-1 text-[13px] text-muted-foreground">{meta}</div>
      ) : null}
    </div>
    {stats && stats.length > 0 ? (
      <div className="relative ml-auto flex max-md:ml-0 max-md:w-full max-md:justify-between">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border-l border-border px-5.5 text-right first:border-l-0 last:pr-0 max-md:first:pl-0"
          >
            <div className="text-[11.5px] font-semibold text-slate-400">
              {stat.label}
            </div>
            <div className="mt-0.75 text-xl font-semibold tabular-nums">
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    ) : null}
    {action ? (
      <div
        className={
          stats && stats.length > 0
            ? "relative flex shrink-0 items-center gap-2"
            : "relative ml-auto flex shrink-0 items-center gap-2"
        }
      >
        {action}
      </div>
    ) : null}
  </div>
);
