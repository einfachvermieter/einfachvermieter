import { RiArrowRightUpLine } from "@remixicon/react";
import { createLink, type LinkComponent } from "@tanstack/react-router";
import type { ComponentProps } from "react";

const DomainAnchor = ({ children, ...props }: ComponentProps<"a">) => (
  <a
    className="inline-flex items-center gap-0.5 text-azur-700 underline-offset-4 hover:underline"
    {...props}
  >
    {children}
    <RiArrowRightUpLine className="size-3.5 shrink-0" aria-hidden={true} />
  </a>
);

const CreatedDomainLink = createLink(DomainAnchor);

/**
 * Querverweis aus einer Tabellenzelle in eine andere Domäne
 */
export const DomainLink: LinkComponent<typeof DomainAnchor> = (props) => (
  <CreatedDomainLink {...props} />
);
