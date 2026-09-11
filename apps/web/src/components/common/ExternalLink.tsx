import { RiExternalLinkLine } from "@remixicon/react";

/**
 * Link, der die App verlässt
 */
export const ExternalLink = ({
  href,
  label,
}: {
  href: string;
  label: string;
}) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-1 font-medium underline underline-offset-3 hover:text-foreground"
  >
    {label}
    <RiExternalLinkLine className="size-3.5" />
  </a>
);
