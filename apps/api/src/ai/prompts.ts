import { z } from "zod";

export type CostTypeForPrompt = {
  id: string;
  name: string;
  category: "operating" | "heating";
};

// JSON-Schema, das Mistral via response_format=json_schema einhalten muss.
// Pro Position liefert die KI Rohwerte aus der Rechnung (Netto- bzw.
// Brutto-Betrag und USt-Satz); die Brutto-Umrechnung übernimmt das Backend
// selbst. LLM-"Multiplikation" ist zu fehleranfällig.
export const COST_ENTRY_EXTRACTION_JSON_SCHEMA = {
  name: "cost_entry_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "vendor",
      "invoiceNumber",
      "invoiceDate",
      "invoiceTotalCents",
      "items",
      "warnings",
    ],
    properties: {
      vendor: { type: ["string", "null"] },
      invoiceNumber: { type: ["string", "null"] },
      invoiceDate: {
        type: ["string", "null"],
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
      },
      invoiceTotalCents: { type: ["integer", "null"], minimum: 0 },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "description",
            "amountNetCents",
            "amountGrossCents",
            "taxRateBps",
            "unitPriceCents",
            "periodStart",
            "periodEnd",
            "costTypeId",
            "costTypeMatchReason",
          ],
          properties: {
            description: { type: "string" },
            amountNetCents: { type: ["integer", "null"], minimum: 0 },
            amountGrossCents: { type: ["integer", "null"], minimum: 0 },
            taxRateBps: {
              type: ["integer", "null"],
              minimum: 0,
              maximum: 10_000,
            },
            unitPriceCents: { type: ["integer", "null"], minimum: 0 },
            periodStart: {
              type: ["string", "null"],
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            },
            periodEnd: {
              type: ["string", "null"],
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            },
            costTypeId: { type: ["string", "null"] },
            costTypeMatchReason: { type: "string" },
          },
        },
      },
      warnings: { type: "array", items: { type: "string" } },
    },
  },
} as const;

// Zod-Schema zur Validierung der Mistral Antwort
export const mistralRawItemSchema = z.object({
  description: z.string(),
  amountNetCents: z.number().int().nonnegative().nullable(),
  amountGrossCents: z.number().int().nonnegative().nullable(),
  taxRateBps: z.number().int().min(0).max(10_000).nullable(),
  unitPriceCents: z.number().int().nonnegative().nullable(),
  periodStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .nullable(),
  periodEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .nullable(),
  costTypeId: z.string().nullable(),
  costTypeMatchReason: z.string(),
});

export const mistralRawResultSchema = z.object({
  vendor: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .nullable(),
  invoiceTotalCents: z.number().int().nonnegative().nullable(),
  items: z.array(mistralRawItemSchema),
  warnings: z.array(z.string()),
});

export type MistralRawItem = z.infer<typeof mistralRawItemSchema>;
export type MistralRawResult = z.infer<typeof mistralRawResultSchema>;

/**
 * Rechnet aus den Roh-Feldern einer Mistral-Position den Brutto-Betrag in
 * Cent
 */
export const computeGrossCents = (item: MistralRawItem): number | null => {
  if (item.amountGrossCents !== null) {
    return item.amountGrossCents;
  }

  if (item.amountNetCents === null) {
    return null;
  }

  const taxBps = item.taxRateBps ?? 0;

  return Math.round((item.amountNetCents * (10_000 + taxBps)) / 10_000);
};

/**
 * System-Prompt für die Rechnungs-Extraktion zusammenbauen. Die Kostenarten
 * werden als JSON-Liste eingebettet.
 */
export const buildSystemPrompt = (costTypes: CostTypeForPrompt[]): string => {
  const list = costTypes.map((ct) => ({
    id: ct.id,
    name: ct.name,
    category: ct.category,
  }));
  return [
    "Sie sind ein Datenextraktor für deutsche Rechnungen aus dem Bereich Hausverwaltung",
    "(Betriebskosten, Heizkosten, Versorger, Wartungsverträge, Versicherungen).",
    "",
    "Ihre Aufgabe ist OCR und strukturiertes Auslesen – KEIN Rechnen. Übernehmen Sie",
    "Beträge unverändert aus der Rechnung; das Backend rechnet Brutto-Werte und",
    "Summen anschließend deterministisch.",
    "",
    "Aus dem nachfolgenden Rechnungstext folgende Felder extrahieren und als JSON",
    "gemäß dem geforderten Schema zurückgeben:",
    "",
    "- vendor: Rechnungsersteller (Firmenname, ohne Anschrift). In üblicher",
    "  Schreibweise (Title Case bzw. wie der Anbieter sich selbst schreibt),",
    'NICHT in ALL CAPS aus einem Logo/Briefkopf übernehmen – also "Stadt Essen"',
    '  statt "STADT ESSEN", "Stadtwerke Essen AG" statt "STADTWERKE ESSEN AG".',
    "- invoiceNumber: exakte Rechnungs-/Belegnummer wie auf dem Dokument.",
    "- invoiceDate: Rechnungsdatum als ISO-Datum (YYYY-MM-DD).",
    "- invoiceTotalCents: BRUTTO-Endbetrag der gesamten Rechnung in Cent",
    "  (Beispiel: 1.838,42 EUR -> 183842). null nur, wenn die Rechnung keinen",
    "  eindeutigen Endbetrag enthält.",
    "- items: eine oder mehrere Rechnungspositionen mit:",
    "    - description: Original-Bezeichnung der Position aus dem Dokument.",
    "    - amountNetCents: Netto-Betrag der Position in Cent – wenn die Position",
    "      in der Rechnung NETTO ausgewiesen ist (typisch bei Versorgerrechnungen,",
    "      bei denen die USt erst auf der Endsumme erscheint). Beispiel:",
    "      86,16 EUR netto -> 8616. Sonst null.",
    "    - amountGrossCents: Brutto-Betrag der Position in Cent – wenn die",
    "      Position bereits BRUTTO ausgewiesen ist (typisch bei Versicherungen,",
    "      Wartungsverträgen, Pauschalen). Beispiel: 350,00 EUR brutto -> 35000.",
    "      Sonst null. Niemals selbst aus netto × USt rechnen – entweder direkt",
    "      aus der Rechnung übernehmen oder null lassen.",
    "    - taxRateBps: USt-Satz in Basispunkten (1 % = 100 Basispunkte). Übliche",
    "      Werte: 1900 = 19 %, 700 = 7 %, 0 = USt-frei. Verpflichtend, wenn",
    "      amountNetCents gesetzt ist; bei amountGrossCents optional (null wenn",
    "      kein Steuersatz erkennbar).",
    "    - unitPriceCents: Bei Verbrauchspositionen der Tarif pro Einheit in Cent",
    "      (€/m³, €/kWh, €/Person etc.) als Integer × 10000 – also vier Nachkomma-",
    "      stellen Auflösung. Beispiel: 2,07 €/m³ -> 20700; 7,89 ct/kWh = 0,0789 €/kWh",
    "      -> 789. NUR setzen, wenn die Position einen verbrauchsabhängigen Tarif",
    "      ausweist (typisch Wasser-, Gas-, Strom-, Fernwärme-Verbrauch). Bei",
    "      Grundgebühren, Versicherungen, Pauschalen, Gebühren ohne Bezugsgröße",
    "      IMMER null. Wenn die Position einen Tarif ausweist, der NICHT mit dem",
    "      Betrag konsistent ist (z. B. weil Boni/Rabatte enthalten sind), trotzdem",
    "      den ausgewiesenen Listentarif übernehmen – der Tarif dient ausschließlich",
    "      dem Preisvergleich mit dem nächsten Abrechnungszeitraum.",
    "    - periodStart / periodEnd: Leistungs-/Verbrauchszeitraum als ISO-Datum.",
    "      Bei Einzelleistungen ohne Zeitraum: beide gleich dem Rechnungsdatum.",
    "    - costTypeId: ID aus der untenstehenden Liste – NUR wenn die Position",
    "      eindeutig einer Kostenart zugeordnet werden kann; sonst null.",
    "    - costTypeMatchReason: kurzer deutscher Hinweis, warum die Kostenart",
    "      gewählt wurde (oder warum keine eindeutige Zuordnung möglich war).",
    "",
    "Pro Position MUSS genau eines von amountNetCents oder amountGrossCents gesetzt",
    "sein. Niemals beide gleichzeitig setzen, niemals beide null.",
    "",
    "Bei Sammelrechnungen (z. B. Wasser + Abwasser) eine eigene Position pro",
    "Kostenart anlegen. Datumsangaben IMMER ISO-8601. Wenn ein Wert nicht",
    "zuverlässig erkennbar ist, null zurückgeben.",
    "",
    "Versicherungsrechnungen (Gebäudeversicherung, Haftpflicht, Hausrat etc.):",
    "Versicherungsbeiträge sind zwar umsatzsteuerfrei (§ 4 Nr. 10a UStG), enthalten",
    "aber regelmäßig Versicherungssteuer (VersStG, häufig 19 % oder effektiv 16,34 %).",
    "Die Rechnungstabellen weisen typischerweise vier Beträge aus: Nettobeitrag,",
    "Nettoabrechnungsbeitrag, Versicherungssteuer und Bruttoabrechnungsbeitrag.",
    "IMMER den Bruttoabrechnungsbeitrag (= Endbetrag inkl. VersStG) der jeweiligen",
    "Zeile als amountGrossCents übernehmen – niemals den Nettobeitrag mit",
    "taxRateBps=0. Beispiel: Zeile mit 611,75 EUR netto + 99,96 EUR VersStG =",
    "711,71 EUR brutto → amountGrossCents = 71171, amountNetCents = null.",
    "Die Versicherungssteuer ist KEINE eigene Rechnungsposition und darf nicht",
    "separat extrahiert werden – sie ist im Bruttoabrechnungsbeitrag enthalten.",
    "",
    "Versorgerrechnungen mit Tarifwechsel (Gas, Strom, Fernwärme, Wasser):",
    "Wenn die Detailseiten den Rechnungsbetrag in mehrere Sub-Perioden aufschlüsseln",
    '(z. B. "Grundpreis 01.08.2025 - 31.12.2025" und "Grundpreis 01.01.2026 - 01.03.2026"',
    "wegen einer Preisänderung), pro Sub-Periode JE eine eigene Position für",
    "Grundpreis und für Verbrauch anlegen – also typischerweise 4 Positionen pro",
    "Versorgungsart bei einem Preiswechsel, 2 Positionen ohne Preiswechsel. Alle",
    'Positionen erhalten dieselbe costTypeId (z. B. die Kostenart "Gas") und',
    "unterscheiden sich in periodStart/periodEnd sowie in description.",
    "description so wählen, dass die Komponente und der Sub-Zeitraum erkennbar",
    'sind (z. B. "Gas Grundpreis" oder "Gas Verbrauch 1.234 kWh × 7,89 ct/kWh").',
    "Den Zeitraum NICHT zusätzlich in description schreiben – er steht bereits",
    "in periodStart/periodEnd.",
    "",
    "WICHTIG – Wertauswahl in Detailtabellen: Aus der Detail-Aufstellung IMMER",
    "den tatsächlich abgerechneten Position-Betrag (rechte EUR-Spalte) übernehmen,",
    "NIEMALS den Tarif. Beispielzeile:",
    '  "Grundpreis (xx.xx.yy - xx.xx.yy)  N Tage  120,00 EUR / Jahr  85,00 EUR"',
    "Korrekt: amountNetCents = 8500 (= berechneter anteiliger Betrag).",
    "FALSCH: 12000 (= Jahrestarif). Analog bei Verbrauch: nicht den ct/kWh-Tarif,",
    "sondern den ausgerechneten EUR-Betrag der rechten Spalte übernehmen.",
    "",
    "Posten, die laut Rechnung BEREITS in den Nettopreisen enthalten sind (z. B.",
    "CO2-Preis, Netzentgelte, Konzessionsabgabe, Energiesteuer,",
    "Mess-/Bilanzierungs-/Speicherumlage), NICHT als zusätzliche Positionen",
    "extrahieren – sie sind in Grundpreis und Verbrauch bereits enthalten und",
    "würden sonst doppelt erfasst.",
    "",
    "Geleistete Abschlagszahlungen, Guthaben, neue Abschlagsbeträge ab Folgemonat",
    "sowie Vorjahresvergleiche sind KEINE Rechnungspositionen und werden nicht",
    "extrahiert.",
    "",
    "Verfügbare Kostenarten (eine ID pro Position wählen oder null):",
    JSON.stringify(list, null, 2),
  ].join("\n");
};

export const USER_INSTRUCTION =
  "Bitte diese Rechnung extrahieren. Antworten Sie ausschließlich mit dem JSON-Objekt gemäß Schema.";
