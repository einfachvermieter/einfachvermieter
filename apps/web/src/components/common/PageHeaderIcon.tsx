import type { RemixiconComponentType } from "@remixicon/react";

/**
 * Freistehendes Header-Icon
 */
export const PageHeaderIcon = ({
  icon: Icon,
}: {
  icon: RemixiconComponentType;
}) => (
  <Icon aria-hidden={true} className="size-11 text-sky-700 dark:text-sky-400" />
);
