import {
  formatDate,
  formatNumber,
  type OccupancyDetail,
} from "@einfachvermieter/shared";
import { Text, View } from "@react-pdf/renderer";
import { t } from "../i18n.js";
import { styles } from "../styles.js";
import { renderSuperscripts, toSuperscript } from "../superscript.js";

type Props = {
  detail: OccupancyDetail;
  targetUnitId: string;
};

type ResidentGroup = {
  count: number;
  from: string;
  to: string;
  days: number;
};

const COL_LABEL = { flex: 2.2 };
const COL_RESIDENT = { flex: 1.3 };
const COL_SPAN = { flex: 1.8 };
const COL_PERSON_DAYS = { flex: 1.2 };

/**
 * Fasst Bewohner mit identischem Mietzeit-Fenster zu einer Zeile zusammen
 * (z. B. Pärchen mit gleichem Einzugsdatum). Macht es einfacher lesbar.
 */
const groupResidentsBySpan = (
  residents: OccupancyDetail["perUnit"][number]["residents"],
): ResidentGroup[] => {
  const groups = new Map<string, ResidentGroup>();

  for (const r of residents) {
    const key = `${r.from}|${r.to}|${r.days}`;
    const existing = groups.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { count: 1, from: r.from, to: r.to, days: r.days });
    }
  }

  return [...groups.values()];
};

const formatDays = (days: number): string => formatNumber(days, 0);

type RowSpec = {
  key: string;
  label: string;
  resident: string;
  span: string;
  personDays: string;
  footnoteMarker?: string;
  isTotal?: boolean;
};

export const OccupancyAppendix = ({ detail, targetUnitId }: Props) => {
  // Hybrid-Ansicht: Mieter-eigene Wohnung detailliert, alle anderen
  // anonym aggregiert (Datenschutz)
  const targetUnit = detail.perUnit.find((u) => u.unitId === targetUnitId);
  const otherUnits = detail.perUnit.filter((u) => u.unitId !== targetUnitId);

  const rows: RowSpec[] = [];

  if (targetUnit) {
    const label = t("statements.pdf.occupancy.targetUnitLabel", {
      unit: targetUnit.unitName,
    });

    if (targetUnit.residents.length === 0) {
      rows.push({
        key: targetUnit.unitId,
        label,
        resident: t("ui.common.emptyValue"),
        span: t("ui.common.emptyValue"),
        personDays: "0",
      });
    } else {
      const groups = groupResidentsBySpan(targetUnit.residents);

      groups.forEach((g, idx) => {
        const isLast = idx === groups.length - 1;

        rows.push({
          key: `${targetUnit.unitId}-${g.from}-${g.to}-${g.days}`,
          label: idx === 0 ? label : "",
          resident:
            g.count === 1
              ? t("statements.pdf.occupancy.personSingular")
              : t("statements.pdf.occupancy.personPlural", { count: g.count }),
          span: `${formatDate(g.from)} – ${formatDate(g.to)}`,
          personDays: isLast ? formatDays(targetUnit.personDays) : "",
        });
      });
    }
  }

  if (otherUnits.length > 0) {
    const otherPersonDays = otherUnits.reduce(
      (sum, u) => sum + u.personDays,
      0,
    );

    // Bei genau einer anderen Wohnung wird deren Name gezeigt.
    // DSGVO ist hier wirkungslos, Ab zwei weiteren Wohnungen
    // wird anonym aggregiert.
    const label =
      otherUnits.length === 1 && otherUnits[0]
        ? otherUnits[0].unitName
        : t("statements.pdf.occupancy.otherUnitsPlural", {
            count: otherUnits.length,
          });

    rows.push({
      key: "other-units",
      label,
      resident: t("ui.common.emptyValue"),
      span: t("ui.common.emptyValue"),
      personDays: formatDays(otherPersonDays),
    });
  }

  const hasLandlordShare = detail.landlordPersonDays > 0;
  const landlordMarker = hasLandlordShare ? toSuperscript(1) : undefined;

  if (hasLandlordShare) {
    rows.push({
      key: "landlord-person-days",
      label: t("statements.pdf.occupancy.landlordDays"),
      resident: t("ui.common.emptyValue"),
      span: t("ui.common.emptyValue"),
      personDays: formatDays(detail.landlordPersonDays),
      footnoteMarker: landlordMarker,
    });
  }

  rows.push({
    key: "total-person-days",
    label: t("statements.pdf.occupancy.totalPersonDays"),
    resident: "",
    span: "",
    personDays: formatDays(detail.totalPersonDays),
    isTotal: true,
  });

  return (
    <View>
      <Text style={styles.paragraph}>
        {t("statements.pdf.occupancy.intro")}
      </Text>

      <View style={styles.table}>
        <View style={styles.rowHeader}>
          <View style={[styles.cellLeft, COL_LABEL]}>
            <Text>{t("statements.pdf.occupancy.unit")}</Text>
          </View>
          <View style={[styles.cellLeft, styles.cellDivider, COL_RESIDENT]}>
            <Text>{t("statements.pdf.occupancy.resident")}</Text>
          </View>
          <View style={[styles.cellLeft, styles.cellDivider, COL_SPAN]}>
            <Text>{t("statements.pdf.occupancy.span")}</Text>
          </View>
          <View style={[styles.cellRight, styles.cellDivider, COL_PERSON_DAYS]}>
            <Text>{t("statements.pdf.occupancy.personDays")}</Text>
          </View>
        </View>
        {rows.map((row) => (
          <View
            key={row.key}
            style={[
              styles.row,
              row.isTotal ? styles.rowDividerStrong : styles.rowDivider,
              ...(row.isTotal ? [styles.bold] : []),
            ]}
          >
            <View style={[styles.cellLeft, COL_LABEL]}>
              <Text>
                {row.label}
                {row.footnoteMarker
                  ? renderSuperscripts(` ${row.footnoteMarker}`)
                  : ""}
              </Text>
            </View>
            <View
              style={[
                styles.cellLeft,
                ...(!row.isTotal ? [styles.cellDivider] : []),
                COL_RESIDENT,
              ]}
            >
              <Text>{row.resident}</Text>
            </View>
            <View
              style={[
                styles.cellLeft,
                ...(!row.isTotal ? [styles.cellDivider] : []),
                COL_SPAN,
              ]}
            >
              <Text>{row.span}</Text>
            </View>
            <View
              style={[
                styles.cellRight,
                ...(!row.isTotal ? [styles.cellDivider] : []),
                COL_PERSON_DAYS,
              ]}
            >
              <Text>{row.personDays}</Text>
            </View>
          </View>
        ))}
      </View>
      {hasLandlordShare ? (
        <Text style={styles.footnote}>
          {renderSuperscripts(
            `${landlordMarker} ${t("statements.pdf.occupancy.landlordFootnote")}`,
          )}
        </Text>
      ) : null}
    </View>
  );
};
