import type { RemixiconComponentType } from "@remixicon/react";
import { IconTile } from "./IconTile";

/**
 * Icon-Badge des Seitenkopfs
 */
export const PageHeaderIcon = ({ icon }: { icon: RemixiconComponentType }) => (
  <IconTile icon={icon} size={38} />
);
