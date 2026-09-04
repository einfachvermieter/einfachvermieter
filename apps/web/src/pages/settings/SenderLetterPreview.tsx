import type { ReactNode } from "react";
import { t } from "@/lib/i18n";

/**
 * Ausschnitt einer A4-Seite: 210 mm breit, oben 105 mm hoch (bis zur
 * oberen Falzmarke). Darin sind
 * Logo, Absenderblock und Adressfeld an denselben Stellen wie im
 * Abrechnungs-PDF
 */
const SHEET_ASPECT = "210 / 105";

/**
 * Volle Blattbreite, oben 45 mm: das Band, in dem das Logo sitzt
 */
const LOGO_BAND = { height: "42.857%" } as const;

/**
 * Absenderblock: oben 50 mm, rechts 10 mm, 75 mm breit
 */
const SENDER_BLOCK = {
  top: "47.619%",
  right: "4.762%",
  width: "35.714%",
} as const;

/**
 * Adressfeld nach DIN 5008 Form B: oben 55 mm, links 25 mm, 80 x 40 mm
 */
const ADDRESS_FIELD = {
  top: "52.381%",
  left: "11.905%",
  width: "38.095%",
} as const;

/**
 * Brieftext beginnt 86 mm unter der Blattkante
 */
const LETTER_TEXT = {
  top: "81.905%",
  left: "11.905%",
  right: "9.524%",
} as const;

export type SenderLetterValues = {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  phone: string;
  fax: string;
  email: string;
};

/**
 * Vorschau des Briefkopfs
 */
export const SenderLetterPreview = ({
  values,
  logo,
}: {
  values: SenderLetterValues;
  logo: ReactNode;
}) => (
  <div
    className="relative w-full overflow-hidden rounded-md border border-foreground/10 bg-white text-schiefer-900"
    style={{ aspectRatio: SHEET_ASPECT }}
  >
    <div className="absolute inset-x-0 top-0 overflow-hidden" style={LOGO_BAND}>
      {logo}
    </div>

    <div className="absolute text-3xs" style={SENDER_BLOCK}>
      <p className="font-semibold">{values.name}</p>
      <p>{values.street}</p>
      <p>
        {values.postalCode} {values.city}
      </p>
      {values.phone ? (
        <p>
          {t("statements.pdf.senderContact.phone", { value: values.phone })}
        </p>
      ) : null}
      {values.fax ? (
        <p>{t("statements.pdf.senderContact.fax", { value: values.fax })}</p>
      ) : null}
      {values.email ? <p>{values.email}</p> : null}
    </div>

    <div className="absolute text-3xs" style={ADDRESS_FIELD}>
      <p className="mb-2 truncate text-4xs text-schiefer-500">
        {t("statements.pdf.senderLine", {
          name: values.name,
          street: values.street,
          postalCode: values.postalCode,
          city: values.city,
        })}
      </p>
      <p>{t("ui.settings.sender.preview.recipientName")}</p>
      <p>{t("ui.settings.sender.preview.recipientStreet")}</p>
      <p>{t("ui.settings.sender.preview.recipientCity")}</p>
    </div>

    <div className="absolute space-y-1.5" style={LETTER_TEXT}>
      <span className="block h-1.5 w-2/3 rounded-full bg-schiefer-100" />
      <span className="block h-1.5 w-11/12 rounded-full bg-schiefer-100" />
      <span className="block h-1.5 w-full rounded-full bg-schiefer-100" />
      <span className="block h-1.5 w-3/5 rounded-full bg-schiefer-100" />
    </div>
  </div>
);
