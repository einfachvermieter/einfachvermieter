import { formatDate, formatEur } from "@einfachvermieter/shared";
import { RiTimeLine } from "@remixicon/react";
import { type ReactNode, useState } from "react";
import { DomainLink } from "@/components/common/DomainLink";
import { EmptyNote } from "@/components/common/EmptyNote";
import { SectionCard } from "@/components/common/SectionCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import type { DashboardResult } from "@/lib/stats";
import { monthLabel } from "../monthLabel";

const DECEMBER = 12;
const MAX_TASK_ITEMS = 5;

type TaskItem = { key: string; label: ReactNode; value?: string };

type Task = {
  key: string;
  when: string;
  tone: "bad" | "warn" | "neutral";
  title: ReactNode;
  items: TaskItem[];
  note?: string;
};

/**
 * Eine Aufgabe: Fristangabe, Titel, die betroffenen Objekte und die
 * Begründung.
 */
const TaskRow = ({ task }: { task: Task }) => {
  const [expanded, setExpanded] = useState(false);
  const hidden = task.items.length - MAX_TASK_ITEMS;
  const shown = expanded ? task.items : task.items.slice(0, MAX_TASK_ITEMS);

  return (
    <div className="flex items-start gap-3 border-t border-border py-3 first:border-t-0">
      <span className="w-28 shrink-0">
        <Badge variant={task.tone}>{task.when}</Badge>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{task.title}</p>
        <ul className="mt-1 space-y-0.5">
          {shown.map((item) => (
            <li
              key={item.key}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate">{item.label}</span>
              {item.value ? (
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {item.value}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {hidden > 0 ? (
          <Button
            type="button"
            variant="link"
            size="text"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded
              ? t("ui.dashboard.tasks.less")
              : t("ui.dashboard.tasks.more", { count: hidden })}
          </Button>
        ) : null}
        {task.note ? (
          <p className="mt-1 text-xs text-muted-foreground">{task.note}</p>
        ) : null}
      </div>
    </div>
  );
};

/**
 * Aufgabenliste der Übersicht: was Fristen hat, was Geld kostet und was
 * die Einrichtung blockiert
 */
export const DashboardTasks = ({
  data,
  month,
  showWhenEmpty,
}: {
  data: DashboardResult;
  month: number;
  showWhenEmpty: boolean;
}) => {
  const tasks: Task[] = [];
  const openStatements = data.statementsTotal - data.statementsDone;

  if (openStatements > 0) {
    tasks.push({
      key: "statements",
      when: formatDate(data.statementDeadline),
      tone: data.daysUntilDeadline < 0 ? "bad" : "warn",
      title: t("ui.dashboard.tasks.statementsTitle", {
        year: data.statementYear,
        count: openStatements,
      }),
      items: data.buildingsWithMissingStatements.map((building) => ({
        key: building.id,
        label: (
          <DomainLink
            to="/gebaeude/$buildingId"
            params={{ buildingId: building.id }}
          >
            {building.name}
          </DomainLink>
        ),
        value: t("ui.dashboard.tasks.statementsCount", {
          count: building.count,
        }),
      })),
      note: t("ui.dashboard.tasks.statementsBody", {
        deadline: formatDate(data.statementDeadline),
      }),
    });
  }

  if (data.overdueTenants.length > 0) {
    const since = data.overdueTenants
      .map((tenant) => tenant.sinceMonth)
      .filter((value): value is string => value !== null)
      .reduce((a, b) => (a < b ? a : b), "9999-99");

    tasks.push({
      key: "overdue",
      when:
        since === "9999-99"
          ? t("ui.dashboard.tasks.setupWhen")
          : t("ui.dashboard.tasks.overdueSince", { month: monthLabel(since) }),
      tone: "bad",
      title: t("ui.dashboard.tasks.overdueTitle", {
        count: data.overdueTenants.length,
      }),
      items: data.overdueTenants.map((tenant) => ({
        key: tenant.tenantId,
        label: (
          <DomainLink
            to="/mieter/$tenantId/konto"
            params={{ tenantId: tenant.tenantId }}
          >
            {tenant.residentNames.join(t("ui.common.separators.comma"))}
          </DomainLink>
        ),
        value: formatEur(tenant.amountCents),
      })),
    });
  }

  if (month === DECEMBER && data.meterCount > 0) {
    tasks.push({
      key: "meters",
      when: t("ui.dashboard.tasks.metersWhen"),
      tone: "warn",
      title: t("ui.dashboard.tasks.metersTitle"),
      items: [
        {
          key: "meters",
          label: (
            <DomainLink
              to="/zaehler"
              search={{
                buildingId: undefined,
                type: undefined,
                unitId: undefined,
              }}
            >
              {t("ui.meters.sub.count", { count: data.meterCount })}
            </DomainLink>
          ),
        },
      ],
      note: t("ui.dashboard.tasks.metersBody"),
    });
  }

  // Was noch nicht steht: Gebäude ohne Wohnungen und Wohnungen, für die
  // es noch nie einen Mieter gab. Leerstand gehört nicht dazu.
  const emptyBuildings = data.buildings.filter(
    (candidate) => candidate.unitsCount === 0,
  );
  const setupItems: TaskItem[] = [
    ...emptyBuildings.map((building) => ({
      key: `building-${building.id}`,
      label: (
        <DomainLink to="/wohnungen" search={{ buildingId: building.id }}>
          {building.name}
        </DomainLink>
      ),
      value: t("ui.dashboard.tasks.setupNoUnits"),
    })),
    ...data.unitsWithoutTenant.map((unit) => ({
      key: `unit-${unit.id}`,
      label: (
        <DomainLink to="/mieter" search={{ buildingId: unit.buildingId }}>
          {t("ui.dashboard.tasks.setupUnitLabel", {
            building: unit.buildingName,
            unit: unit.name,
          })}
        </DomainLink>
      ),
      value: t("ui.dashboard.tasks.setupNoTenant"),
    })),
  ];

  if (setupItems.length > 0) {
    tasks.push({
      key: "setup",
      when: t("ui.dashboard.tasks.setupWhen"),
      tone: "neutral",
      title: t("ui.dashboard.tasks.setupTitle", { count: setupItems.length }),
      items: setupItems,
    });
  }

  if (tasks.length === 0 && !showWhenEmpty) {
    return null;
  }

  return (
    <SectionCard icon={RiTimeLine} title={t("ui.dashboard.tasks.title")}>
      {tasks.length === 0 ? (
        <EmptyNote>{t("ui.dashboard.tasks.empty")}</EmptyNote>
      ) : (
        tasks.map((task) => <TaskRow key={task.key} task={task} />)
      )}
    </SectionCard>
  );
};
