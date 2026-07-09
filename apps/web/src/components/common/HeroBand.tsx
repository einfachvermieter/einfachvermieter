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
  <div className="relative mb-5.5 flex items-center gap-4 overflow-hidden rounded-xl border border-border bg-card px-4 py-4 max-lg:flex-wrap sm:gap-5.5 sm:px-6.5 sm:py-5.5">
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
      <h1 className="mt-0.75 text-2xl leading-tight font-semibold sm:text-[26px]">
        {title}
      </h1>
      {meta ? (
        <div className="mt-1 text-[13px] text-muted-foreground">{meta}</div>
      ) : null}
    </div>
    {stats && stats.length > 0 ? (
      <div className="relative ml-auto flex max-lg:ml-0 max-lg:w-full max-lg:justify-between max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-4 max-sm:gap-y-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border-l border-border px-4 text-right first:border-l-0 last:pr-0 max-lg:first:pl-0 sm:px-5.5 max-sm:border-l-0 max-sm:px-0"
          >
            <div className="text-[11.5px] font-semibold text-slate-400">
              {stat.label}
            </div>
            <div className="mt-0.75 text-base font-semibold tabular-nums lg:text-xl">
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
