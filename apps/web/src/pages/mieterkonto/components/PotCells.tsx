import type { PotState } from "@einfachvermieter/shared";
import { formatEur } from "@einfachvermieter/shared";
import { TableCell } from "@/components/ui/Table";
import { AccountStatusBadge } from "./AccountStatusBadge";

/**
 * Ein Topf (Kaltmiete/NK) als drei nebeneinanderliegende Tabellenzellen:
 * Ist x Soll x Status. Wird im Monatsraster für Monats- und Jahreszeilen
 * verwendet.
 */
export const PotCells = ({ pot }: { pot: PotState }) => (
  <>
    <TableCell className="px-4 py-3 text-right align-top font-semibold tabular-nums">
      {formatEur(pot.istCents)}
    </TableCell>
    <TableCell className="px-4 py-3 text-right align-top tabular-nums text-muted-foreground">
      {formatEur(pot.sollCents)}
    </TableCell>
    <TableCell className="px-4 py-3 align-top">
      <AccountStatusBadge pot={pot} />
    </TableCell>
  </>
);
