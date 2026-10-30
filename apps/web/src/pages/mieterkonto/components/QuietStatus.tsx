import { IconCheck } from "@/lib/icons";

/**
 * Normalfall in einer Statusspalte: unauffällig mit Häkchen statt farbiger
 * Badge.
 */
export const QuietStatus = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground [&>svg]:size-3.5">
    <IconCheck />
    {label}
  </span>
);
