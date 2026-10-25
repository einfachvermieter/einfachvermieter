import type { ReactNode } from "react";

/**
 * Baut eine Illustration im Stil "Versatz" aus dem App-Design: eine
 * Farbebene, leicht nach rechts unten versetzt, darüber die Linien in
 * Textfarbe.
 */
const createIllustration = (fills: ReactNode, lines: ReactNode) => {
  const Illustration = ({ className }: { className?: string }) => (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
      className={className}
    >
      <g transform="translate(4,3)" stroke="none">
        {fills}
      </g>
      <g>{lines}</g>
    </svg>
  );
  return Illustration;
};

export const ArtTenants = createIllustration(
  <>
    <circle cx="26" cy="19" r="9" className="fill-schiefer-200" />
    <path
      d="M10 54v-6a13 13 0 0 1 13-13h6a13 13 0 0 1 13 13v6z"
      className="fill-azur-200"
    />
    <circle cx="51" cy="30" r="6" className="fill-limette-400" />
  </>,
  <>
    <circle cx="26" cy="19" r="9" />
    <path d="M10 54v-6a13 13 0 0 1 13-13h6a13 13 0 0 1 13 13v6zM51 36v17M51 46h4.5M51 51h3.5" />
    <circle cx="51" cy="30" r="6" />
  </>,
);

export const ArtDashboard = createIllustration(
  <>
    <rect x="6" y="8" width="22" height="44" rx="4" className="fill-azur-200" />
    <rect
      x="34"
      y="8"
      width="20"
      height="18"
      rx="4"
      className="fill-limette-400"
    />
    <rect
      x="34"
      y="32"
      width="20"
      height="20"
      rx="4"
      className="fill-schiefer-200"
    />
  </>,
  <>
    <rect x="6" y="8" width="22" height="44" rx="4" />
    <rect x="34" y="8" width="20" height="18" rx="4" />
    <rect x="34" y="32" width="20" height="20" rx="4" />
    <path d="M12 45v-8M17 45V30M22 45v-5M39 39h10M39 45h6" />
  </>,
);

export const ArtBuildings = createIllustration(
  <>
    <path
      d="M12 54V12a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v42z"
      className="fill-azur-200"
    />
    <path d="M38 54V28h10a3 3 0 0 1 3 3v23z" className="fill-schiefer-200" />
    <rect x="21" y="43" width="8" height="11" className="fill-limette-400" />
  </>,
  <>
    <path d="M12 54V12a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v42z" />
    <path d="M38 54V28h10a3 3 0 0 1 3 3v23z" />
    <rect x="21" y="43" width="8" height="11" />
    <rect x="17.5" y="15" width="5" height="5" rx="1" />
    <rect x="27.5" y="15" width="5" height="5" rx="1" />
    <rect x="17.5" y="25" width="5" height="5" rx="1" />
    <rect x="27.5" y="25" width="5" height="5" rx="1" />
    <rect x="17.5" y="34" width="5" height="5" rx="1" />
    <rect x="27.5" y="34" width="5" height="5" rx="1" />
    <path d="M6 54h50M43 36h3M43 43h3" />
  </>,
);

export const ArtUnits = createIllustration(
  <>
    <path
      d="M14 54V11a3 3 0 0 1 3-3h24a3 3 0 0 1 3 3v43z"
      className="fill-azur-200"
    />
    <rect
      x="22"
      y="15"
      width="14"
      height="8"
      rx="2"
      className="fill-schiefer-200"
    />
    <circle cx="37" cy="33" r="3" className="fill-limette-400" />
  </>,
  <>
    <path d="M14 54V11a3 3 0 0 1 3-3h24a3 3 0 0 1 3 3v43z" />
    <rect x="22" y="15" width="14" height="8" rx="2" />
    <circle cx="37" cy="33" r="3" />
    <path d="M6 54h50M26 19h6" />
  </>,
);

export const ArtMeters = createIllustration(
  <>
    <circle cx="30" cy="30" r="22" className="fill-azur-200" />
    <rect
      x="19"
      y="36"
      width="22"
      height="9"
      rx="2"
      className="fill-schiefer-200"
    />
    <circle cx="30" cy="24" r="3" className="fill-limette-400" />
  </>,
  <>
    <circle cx="30" cy="30" r="22" />
    <rect x="19" y="36" width="22" height="9" rx="2" />
    <circle cx="30" cy="24" r="3" />
    <path d="m32 22 7-7M30 12v3M17 24h3M43 24h-3M24.5 36v9M30 36v9M35.5 36v9" />
  </>,
);

export const ArtCostTypes = createIllustration(
  <>
    <path
      d="M8 30V11a3 3 0 0 1 3-3h19l24 24-22 22z"
      className="fill-azur-200"
    />
    <circle cx="19" cy="19" r="4" className="fill-limette-400" />
  </>,
  <>
    <path d="M8 30V11a3 3 0 0 1 3-3h19l24 24-22 22z" />
    <circle cx="19" cy="19" r="4" />
    <path d="m30 26 12 12M24 32l9 9" />
  </>,
);

export const ArtInvoices = createIllustration(
  <>
    <path d="M14 8h30v46l-5-4-5 4-5-4-5 4-5-4-5 4z" className="fill-azur-200" />
    <rect
      x="27"
      y="33"
      width="11"
      height="7"
      rx="2"
      className="fill-limette-400"
    />
  </>,
  <>
    <path d="M14 8h30v46l-5-4-5 4-5-4-5 4-5-4-5 4z" />
    <rect x="27" y="33" width="11" height="7" rx="2" />
    <path d="M20 17h18M20 24h18M20 36.5h3" />
  </>,
);

const flamePath =
  "M30 7c2.5 10 12.5 13.75 12.5 25a12.5 12.5 0 0 1-25 0c0-5 2.5-7.5 5-10 0 5 2.5 7.5 5 7.5 0-7.5-2.5-12.5 2.5-22.5z";
const innerFlamePath =
  "M30 40.5a4.5 4.5 0 0 1-4.5-4.5c0-2.5 2.5-4 4.5-7 2 3 4.5 4.5 4.5 7a4.5 4.5 0 0 1-4.5 4.5z";

export const ArtHeating = createIllustration(
  <>
    <path d={flamePath} className="fill-azur-200" />
    <rect
      x="14"
      y="48"
      width="32"
      height="6"
      rx="3"
      className="fill-schiefer-200"
    />
    <path d={innerFlamePath} className="fill-limette-400" />
  </>,
  <>
    <path d={flamePath} />
    <rect x="14" y="48" width="32" height="6" rx="3" />
    <path d={innerFlamePath} />
  </>,
);

const documentPath =
  "M17 8h16l12 12v31a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z";

export const ArtStatements = createIllustration(
  <>
    <path d={documentPath} className="fill-azur-200" />
    <circle cx="45" cy="45" r="8" className="fill-limette-400" />
  </>,
  <>
    <path d={documentPath} />
    <path d="M33 8v12h12M20 28h14M20 35h14M20 42h10" />
    <circle cx="45" cy="45" r="8" className="fill-background" />
    <circle cx="49" cy="48" r="8" stroke="none" className="fill-limette-400" />
    <circle cx="45" cy="45" r="8" />
    <path d="m41 45 3 3 5-6" />
  </>,
);

const gearPath =
  "M46.4 25.6L52.8 26.8L52.8 33.2L46.4 34.4L44.7 38.5L48.4 43.8L43.8 48.4L38.5 44.7L34.4 46.4L33.2 52.8L26.8 52.8L25.6 46.4L21.5 44.7L16.2 48.4L11.6 43.8L15.3 38.5L13.6 34.4L7.2 33.2L7.2 26.8L13.6 25.6L15.3 21.5L11.6 16.2L16.2 11.6L21.5 15.3L25.6 13.6L26.8 7.2L33.2 7.2L34.4 13.6L38.5 15.3L43.8 11.6L48.4 16.2L44.7 21.5z";

export const ArtSettings = createIllustration(
  <>
    <path d={gearPath} className="fill-azur-200" />
    <circle cx="30" cy="30" r="7" className="fill-limette-400" />
  </>,
  <>
    <path d={gearPath} />
    <circle cx="30" cy="30" r="7" />
  </>,
);
