import type { RemixiconComponentType } from "@remixicon/react";
import type { ComponentProps, ReactNode } from "react";

/**
 * Baut ein Linien-Icon aus dem App-Design. Die Signatur entspricht
 * den Remix-Icons, damit beide an denselben Stellen passen.
 */
const createIcon = (paths: ReactNode): RemixiconComponentType => {
  const Icon = ({
    size = 24,
    color = "currentColor",
    ...props
  }: ComponentProps<RemixiconComponentType>) => (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
      {...props}
    >
      {paths}
    </svg>
  );
  return Icon;
};

export const IconHome = createIcon(
  <>
    <rect x="3.5" y="3.5" width="7.5" height="17" rx="2" />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="2" />
    <rect x="14" y="13.5" width="6.5" height="7" rx="2" />
  </>,
);

export const IconBuilding = createIcon(
  <path d="M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 10h3a1 1 0 0 1 1 1v10M3 21h18M9 8h2M9 12h2M9 16h2" />,
);

export const IconDoor = createIcon(
  <path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14 12v.01" />,
);

export const IconUsers = createIcon(
  <>
    <circle cx="9" cy="7" r="3.5" />
    <path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2z" />
    <circle cx="19.5" cy="11" r="2.25" />
    <path d="M19.5 13.25V20M19.5 16.5h2M19.5 19h1.5" />
  </>,
);

export const IconGauge = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m12 12 4-4M12 7v.01M7 12h.01M17 12h.01" />
  </>,
);

export const IconTag = createIcon(
  <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM8 8v.01" />,
);

export const IconReceipt = createIcon(
  <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />,
);

export const IconFlame = createIcon(
  <path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />,
);

export const IconDoc = createIcon(
  <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v4h4M9 12h6M9 16h6" />,
);

export const IconGear = createIcon(
  <>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

export const IconMore = createIcon(
  <path d="M12 6v.01M12 12v.01M12 18v.01" strokeWidth={2.5} />,
);

export const IconCheck = createIcon(<path d="m5 12.5 4.5 4.5L19 7.5" />);

export const IconTrash = createIcon(
  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />,
);

export const IconMenu = createIcon(<path d="M4 7h16M4 12h16M4 17h16" />);

export const IconPlus = createIcon(<path d="M12 5v14M5 12h14" />);

export const IconSearch = createIcon(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </>,
);

export const IconChevronDown = createIcon(<path d="m8 10 4 4 4-4" />);

export const IconWallet = createIcon(
  <path d="M4 7a2 2 0 0 1 2-2h11v4M4 7v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2zM16 14v.01" />,
);

export const IconCoins = createIcon(
  <>
    <circle cx="9" cy="9" r="5.5" />
    <path d="M14.5 9.6A5.5 5.5 0 1 1 9.6 14.5" />
  </>,
);

export const IconHelp = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.01" />
  </>,
);

export const IconUser = createIcon(
  <>
    <circle cx="12" cy="7" r="3.5" />
    <path d="M5 20v-3a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3z" />
  </>,
);

export const IconPen = createIcon(
  <path d="m4 20 1-4L16 5l3 3L8 19zM14 7l3 3" />,
);

export const IconUpload = createIcon(<path d="M12 16V5M8 9l4-4 4 4M5 19h14" />);

export const IconDownload = createIcon(
  <path d="M12 5v11M8 12l4 4 4-4M5 19h14" />,
);

export const IconEye = createIcon(
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

export const IconSparkle = createIcon(
  <>
    <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9Z" />
    <path d="M18.5 16v4M16.5 18h4" />
  </>,
);

export const IconFile = createIcon(
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
  </>,
);
