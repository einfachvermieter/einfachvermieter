import type { RemixiconComponentType } from "@remixicon/react";
import { IconTile } from "./IconTile";

/**
 * Titel-Kachel des Seitenkopfs
 */
export const PageHeaderIcon = ({ icon }: { icon: RemixiconComponentType }) => (
  <IconTile icon={icon} size={38} />
);
