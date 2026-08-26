import {
  type MeterType,
  meterTypes,
  type PaymentPurposeKind,
  paymentPurposeKinds,
  type SetupStatus,
} from "@einfachvermieter/shared";
import { RiHome6Line } from "@remixicon/react";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { AppShell } from "./components/AppShell";
import { DetailPending } from "./components/common/DetailPending";
import { PageHeaderIcon } from "./components/common/PageHeaderIcon";
import { TenantScopedNotFound } from "./components/common/TenantScopedNotFound";
import { ErrorFallback } from "./components/ErrorBoundary";
import { NotFound } from "./components/NotFound";
import { Button } from "./components/ui/Button";
import {
  type FeeRow,
  feeIdentityLabel,
  type KontoTab,
  kontoTabs,
  tenantFeesQueryOptions,
} from "./lib/accounts";
import { ApiError } from "./lib/api";
import { authMeQueryOptions } from "./lib/auth";
import { type Building, buildingQueryOptions } from "./lib/buildings";
import {
  type CostEntryDetail,
  type CostTypeDetail,
  costEntryIdentityLabel,
  costEntryQueryOptions,
  costTypeQueryOptions,
} from "./lib/costs";
import { useDocumentTitle } from "./lib/documentTitle";
import { domainVisuals } from "./lib/domainVisuals";
import {
  type HeatingSettings,
  heatingIdentityLabel,
  heatingSettingsByIdQueryOptions,
} from "./lib/heating";
import { t } from "./lib/i18n";
import { type Meter, meterQueryOptions } from "./lib/meters";
import {
  type Payment,
  paymentIdentityLabel,
  paymentQueryOptions,
} from "./lib/payments";
import {
  ensurePrerequisiteMet,
  type GatedDomain,
  PREREQUISITES,
} from "./lib/prerequisites";
import { setupStatusQueryOptions } from "./lib/setup";
import {
  type Statement,
  type StatementTab,
  statementIdentityLabel,
  statementQueryOptions,
  statementTabs,
} from "./lib/statements";
import {
  type TenantAggregate,
  tenantIdentityLabel,
  tenantQueryOptions,
} from "./lib/tenants";
import { type Unit, unitQueryOptions, unitsQueryOptions } from "./lib/units";
// Alle Seiten werden statisch importiert und in einen einzigen Bundle
// gefaltet (kein Code-Splitting). Die App wird nur via Docker/Electron
// vertrieben, wo Chunk-Splitting nur Blitzer beim Seitenwechsel bringt.
import { LoginPage } from "./pages/auth/LoginPage";
import { OutdatedVersionPage } from "./pages/auth/OutdatedVersionPage";
import { PasswordRecoveryPage } from "./pages/auth/PasswordRecoveryPage";
import { BuildingCreatePage } from "./pages/buildings/BuildingCreatePage";
import { BuildingEditPage } from "./pages/buildings/BuildingEditPage";
import { BuildingsOverview } from "./pages/buildings/BuildingsOverview";
import { CostsOverview } from "./pages/costs/CostsOverview";
import { CostTypeCreatePage } from "./pages/costs/CostTypeCreatePage";
import { CostTypeEditPage } from "./pages/costs/CostTypeEditPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { HeatingOverviewPage } from "./pages/heating/HeatingOverviewPage";
import { HeatingVersionCreatePage } from "./pages/heating/HeatingVersionCreatePage";
import { HeatingVersionEditPage } from "./pages/heating/HeatingVersionEditPage";
import { CostEntryCreatePage } from "./pages/invoices/CostEntryCreatePage";
import { CostEntryEditPage } from "./pages/invoices/CostEntryEditPage";
import { InvoicesPage } from "./pages/invoices/InvoicesPage";
import { MeterCreatePage } from "./pages/meters/MeterCreatePage";
import { MeterDetailPage } from "./pages/meters/MeterDetailPage";
import { MeterReadingsPage } from "./pages/meters/MeterReadingsPage";
import { MetersOverview } from "./pages/meters/MetersOverview";
import { FeePage } from "./pages/mieterkonto/FeePage";
import { MieterkontoDetail } from "./pages/mieterkonto/MieterkontoDetail";
import { PaymentCreatePage } from "./pages/payments/PaymentCreatePage";
import { PaymentEditPage } from "./pages/payments/PaymentEditPage";
import { AiSettingsPage } from "./pages/settings/AiSettingsPage";
import { InternetSettingsPage } from "./pages/settings/InternetSettingsPage";
import { PasswordSettingsPage } from "./pages/settings/PasswordSettingsPage";
import { ProfileSettingsPage } from "./pages/settings/ProfileSettingsPage";
import { SenderSettingsPage } from "./pages/settings/SenderSettingsPage";
import { SetupPage } from "./pages/setup/SetupPage";
import { StatementCreatePage } from "./pages/statements/StatementCreatePage";
import { StatementDetailPage } from "./pages/statements/StatementDetailPage";
import { StatementsPage } from "./pages/statements/StatementsPage";
import { TenantCreatePage } from "./pages/tenants/TenantCreatePage";
import { TenantEditPage } from "./pages/tenants/TenantEditPage";
import { TenantsPage } from "./pages/tenants/TenantsPage";
import { UnitCreatePage } from "./pages/units/UnitCreatePage";
import { UnitEditPage } from "./pages/units/UnitEditPage";
import { UnitsOverview } from "./pages/units/UnitsOverview";

type RouterContext = {
  queryClient: QueryClient;
};

const loadSetupStatus = (context: RouterContext) =>
  context.queryClient.ensureQueryData(setupStatusQueryOptions);

/**
 * Status für die Weichen unten. Meldet der Server den Rücksetz-Modus, ist das
 * Passwort-Formular der einzige erreichbare Bildschirm. Die Umleitung gehört
 * deshalb hierher, wo jede abgesicherte Route vorbeikommt.
 */
const getSetupStatus = async (context: RouterContext) => {
  let status: SetupStatus | null = null;
  try {
    status = await loadSetupStatus(context);
  } catch {
    // Status-Endpoint nicht erreichbar: nicht in den Assistenten umleiten,
    // sondern den regulären Auth-Pfad entscheiden lassen.
    return null;
  }

  if (status.databaseNewerThanApp) {
    throw redirect({ to: "/version-veraltet" });
  }

  if (status.recovery) {
    throw redirect({ to: "/passwort-zuruecksetzen" });
  }

  return status;
};

const isSetupNeeded = async (context: RouterContext): Promise<boolean> =>
  (await getSetupStatus(context))?.needsSetup ?? false;

const requireAuth = async ({ context }: { context: RouterContext }) => {
  if (await isSetupNeeded(context)) {
    throw redirect({ to: "/einrichtung" });
  }

  try {
    await context.queryClient.ensureQueryData(authMeQueryOptions);
  } catch (error) {
    if (error instanceof ApiError && error.status < 500) {
      throw redirect({ to: "/anmelden" });
    }

    throw error;
  }
};

/**
 * Anlage-Route absichern: erst Auth, dann ob die fachliche Voraussetzung fürs
 * aktive Gebäude erfüllt ist. Fehlt sie, zurück zur Liste, deren Leer-Hinweis
 * auf die zuerst benötigte Entität verweist.
 */
const requirePrerequisite =
  (domain: GatedDomain) =>
  async ({
    context,
    search,
  }: {
    context: RouterContext;
    search?: { buildingId?: string };
  }) => {
    await requireAuth({ context });
    const met = await ensurePrerequisiteMet(
      context.queryClient,
      domain,
      search ?? {},
    );
    if (!met) {
      throw redirect({ to: PREREQUISITES[domain].listTo });
    }
  };

/**
 * Login-Seite: ist die App noch nicht eingerichtet, zuerst zum Assistenten.
 * Im `local`-Auth-Modus (Desktop-App) gibt es keinen Login -> Dashboard.
 */
const redirectToSetupIfNeeded = async ({
  context,
}: {
  context: RouterContext;
}) => {
  const status = await getSetupStatus(context);
  if (status?.needsSetup) {
    throw redirect({ to: "/einrichtung" });
  }

  if (status?.authMode === "local") {
    throw redirect({ to: "/" });
  }
};

/**
 * Konto-Seiten (Profil/Passwort): im `local`-Auth-Modus gibt es kein Konto.
 */
const redirectAwayIfLocalAuth = async ({
  context,
}: {
  context: RouterContext;
}) => {
  await requireAuth({ context });
  if ((await getSetupStatus(context))?.authMode === "local") {
    throw redirect({ to: "/einstellungen/absender" });
  }
};

/**
 * Rücksetz-Formular: nur im Rücksetz-Modus erreichbar. Nutzt den Status
 * direkt, sonst würde die Weiche in `getSetupStatus` auf sich selbst
 * umleiten.
 */
const redirectAwayIfNotRecovering = async ({
  context,
}: {
  context: RouterContext;
}) => {
  const recovering = await loadSetupStatus(context)
    .then((status) => status.recovery)
    .catch(() => false);

  if (!recovering) {
    throw redirect({ to: "/" });
  }
};

/**
 * Sperrseite für den Versionskonflikt: nur erreichbar, solange die Datenbank
 * von einer neueren App stammt. Nutzt den Status direkt, sonst würde die
 * Weiche in `getSetupStatus` auf sich selbst umleiten.
 */
const redirectAwayIfVersionCurrent = async ({
  context,
}: {
  context: RouterContext;
}) => {
  const locked = await loadSetupStatus(context)
    .then((status) => status.databaseNewerThanApp !== null)
    .catch(() => false);

  if (!locked) {
    throw redirect({ to: "/" });
  }
};

/**
 * Assistent: ist die App bereits eingerichtet, gibt es nichts mehr zu tun.
 */
const redirectAwayIfSetupDone = async ({
  context,
}: {
  context: RouterContext;
}) => {
  if (!(await isSetupNeeded(context))) {
    throw redirect({ to: "/" });
  }
};

const RootComponent = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (
    pathname === "/anmelden" ||
    pathname === "/einrichtung" ||
    pathname === "/passwort-zuruecksetzen" ||
    pathname === "/version-veraltet"
  ) {
    return <Outlet />;
  }

  return <AppShell />;
};

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/anmelden",
  beforeLoad: redirectToSetupIfNeeded,
  component: LoginPage,
});

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/einrichtung",
  beforeLoad: redirectAwayIfSetupDone,
  component: SetupPage,
});

const passwordRecoveryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/passwort-zuruecksetzen",
  beforeLoad: redirectAwayIfNotRecovering,
  component: PasswordRecoveryPage,
});

const outdatedVersionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/version-veraltet",
  beforeLoad: redirectAwayIfVersionCurrent,
  component: OutdatedVersionPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: requireAuth,
  component: DashboardPage,
  staticData: { crumb: t("ui.common.crumbs.dashboard") },
});

const buildingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gebaeude",
  beforeLoad: requireAuth,
  component: BuildingsOverview,
  staticData: { crumb: t("ui.common.crumbs.buildings") },
});

const buildingCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gebaeude/neu",
  beforeLoad: requireAuth,
  component: BuildingCreatePage,
  staticData: {
    crumb: () => [
      { label: t("ui.common.crumbs.buildings"), to: "/gebaeude" },
      { label: t("ui.common.crumbs.buildingNew") },
    ],
  },
});

const buildingEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gebaeude/$buildingId",
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(
        buildingQueryOptions(params.buildingId),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },
  component: BuildingEditPage,
  pendingComponent: () => (
    <DetailPending
      tile={<PageHeaderIcon icon={domainVisuals.buildings.icon} />}
      statsSkeleton={3}
      rows={4}
      aside={true}
    />
  ),
  pendingMs: 0,
  staticData: {
    crumb: ({ loaderData }) => {
      const building = loaderData as Building | null;
      return [
        { label: t("ui.common.crumbs.buildings"), to: "/gebaeude" },
        { label: building?.name ?? "" },
      ];
    },
  },
});

const unitsSearchSchema = (search: Record<string, unknown>) => ({
  buildingId:
    typeof search.buildingId === "string" ? search.buildingId : undefined,
});

const unitsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/wohnungen",
  beforeLoad: requireAuth,
  validateSearch: unitsSearchSchema,
  component: UnitsOverview,
  staticData: { crumb: t("ui.common.crumbs.units") },
});

const unitCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/wohnungen/neu",
  beforeLoad: requirePrerequisite("units"),
  validateSearch: unitsSearchSchema,
  component: UnitCreatePage,
  staticData: {
    crumb: () => [
      { label: t("ui.common.crumbs.units"), to: "/wohnungen" },
      { label: t("ui.common.crumbs.unitNew") },
    ],
  },
});

const unitEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/wohnungen/$unitId",
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(
        unitQueryOptions(params.unitId),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }

      throw error;
    }
  },
  component: UnitEditPage,
  pendingComponent: () => (
    <DetailPending
      tile={<PageHeaderIcon icon={RiHome6Line} />}
      statsSkeleton={3}
      rows={3}
      aside={true}
    />
  ),
  pendingMs: 0,
  staticData: {
    crumb: ({ loaderData }) => {
      const unit = loaderData as Unit | null;

      return [
        { label: t("ui.common.crumbs.units"), to: "/wohnungen" },
        { label: unit?.name ?? "" },
      ];
    },
  },
});

const tenantsSearchSchema = (search: Record<string, unknown>) => ({
  buildingId:
    typeof search.buildingId === "string" ? search.buildingId : undefined,
});

const tenantsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mieter",
  beforeLoad: requireAuth,
  validateSearch: tenantsSearchSchema,
  component: TenantsPage,
  staticData: { crumb: t("ui.common.crumbs.tenants") },
});

const tenantCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mieter/neu",
  beforeLoad: requirePrerequisite("tenants"),
  component: TenantCreatePage,
  staticData: {
    crumb: () => [
      { label: t("ui.common.crumbs.tenants"), to: "/mieter" },
      { label: t("ui.common.crumbs.tenantNew") },
    ],
  },
});

const tenantEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mieter/$tenantId",
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    const [aggregate, units] = await Promise.all([
      context.queryClient.ensureQueryData(tenantQueryOptions(params.tenantId)),
      context.queryClient.ensureQueryData(unitsQueryOptions),
    ]);
    return { aggregate, units };
  },
  component: TenantEditPage,
  pendingComponent: () => (
    <DetailPending
      tile={<PageHeaderIcon icon={domainVisuals.tenants.icon} />}
      statsSkeleton={4}
      rows={6}
      aside={true}
      tabs="default"
    />
  ),
  pendingMs: 0,
  errorComponent: TenantScopedNotFound,
  staticData: {
    crumb: ({ loaderData }) => {
      const data = loaderData as
        | { aggregate: TenantAggregate; units: Unit[] }
        | undefined;
      return [
        { label: t("ui.common.crumbs.tenants"), to: "/mieter" },
        {
          label: data
            ? tenantIdentityLabel(data)
            : t("ui.common.crumbs.tenantContract"),
        },
      ];
    },
  },
});

const kontoTabSet: ReadonlySet<KontoTab> = new Set(kontoTabs);

const kontoSearchSchema = (
  search: Record<string, unknown>,
): { tab?: KontoTab } => {
  const tab =
    typeof search.tab === "string" && kontoTabSet.has(search.tab as KontoTab)
      ? (search.tab as KontoTab)
      : undefined;

  return tab ? { tab } : {};
};

/**
 * Konto-Tab des Mieters. Lädt Mieter-Aggregat nur für die Breadcrumb vor;
 * die Seite selbst holt ihre Daten via useQueries.
 */
const tenantAccountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mieter/$tenantId/konto",
  beforeLoad: requireAuth,
  validateSearch: kontoSearchSchema,
  loader: async ({ context, params }) => {
    const [aggregate, units] = await Promise.all([
      context.queryClient.ensureQueryData(tenantQueryOptions(params.tenantId)),
      context.queryClient.ensureQueryData(unitsQueryOptions),
    ]);
    return { aggregate, units };
  },
  component: MieterkontoDetail,
  errorComponent: TenantScopedNotFound,
  staticData: {
    // Konstant zur Stammdaten-Crumb: der Mietvertrag ist die Entität, Konto
    // nur einer ihrer Reiter (keine eigene "Mieterkonto"-Ebene).
    crumb: ({ loaderData }) => {
      const data = loaderData as
        | { aggregate: TenantAggregate; units: Unit[] }
        | undefined;
      return [
        { label: t("ui.common.crumbs.tenants"), to: "/mieter" },
        {
          label: data
            ? tenantIdentityLabel(data)
            : t("ui.common.crumbs.tenantContract"),
        },
      ];
    },
  },
});

const purposeKindSet: ReadonlySet<PaymentPurposeKind> = new Set(
  paymentPurposeKinds,
);

type PaymentsSearchParams = {
  tenantId?: string;
  // Vorbelegung beim Buchen eines konkreten Monats (abweichend erfassen).
  forMonth?: string;
  baseRentCents?: number;
  advanceCents?: number;
  // Festgelegter Zahlungszweck (z. B. Kaution/Gebühr aus dem Mieterkonto
  // heraus) und, bei Gebühr, die Ziel-Gebühr.
  purposeKind?: PaymentPurposeKind;
  forFeeId?: string;
};

const paymentsSearchSchema = (
  search: Record<string, unknown>,
): PaymentsSearchParams => ({
  tenantId: typeof search.tenantId === "string" ? search.tenantId : undefined,
  forMonth: typeof search.forMonth === "string" ? search.forMonth : undefined,
  baseRentCents:
    typeof search.baseRentCents === "number" ? search.baseRentCents : undefined,
  advanceCents:
    typeof search.advanceCents === "number" ? search.advanceCents : undefined,
  purposeKind:
    typeof search.purposeKind === "string" &&
    purposeKindSet.has(search.purposeKind as PaymentPurposeKind)
      ? (search.purposeKind as PaymentPurposeKind)
      : undefined,
  forFeeId: typeof search.forFeeId === "string" ? search.forFeeId : undefined,
});

const paymentCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/zahlungen/neu",
  beforeLoad: requireAuth,
  validateSearch: paymentsSearchSchema,
  loaderDeps: ({ search }) => ({ tenantId: search.tenantId }),
  loader: async ({ context, deps }) => {
    if (!deps.tenantId) {
      return null;
    }

    try {
      const [aggregate, units] = await Promise.all([
        context.queryClient.ensureQueryData(tenantQueryOptions(deps.tenantId)),
        context.queryClient.ensureQueryData(unitsQueryOptions),
      ]);

      return { aggregate, units, tenantId: deps.tenantId };
    } catch {
      return null;
    }
  },
  component: PaymentCreatePage,
  staticData: {
    crumb: ({ loaderData }) => {
      const data = loaderData as {
        aggregate: TenantAggregate;
        units: Unit[];
        tenantId: string;
      } | null;
      if (!data) {
        return [
          { label: t("ui.common.crumbs.tenants"), to: "/mieter" },
          { label: t("ui.common.crumbs.paymentNew") },
        ];
      }

      return [
        ...tenantAccountCrumbBase(data, data.tenantId),
        { label: t("ui.common.crumbs.paymentNew") },
      ];
    },
  },
});

const paymentEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/zahlungen/$paymentId/bearbeiten",
  beforeLoad: requireAuth,
  validateSearch: paymentsSearchSchema,
  // Lädt Zahlung + Mietvertrag + Wohnungen, damit die Breadcrumb den
  // Mieter-Kontext zeigt (Zahlungen gehören zu einem Mieterkonto, haben
  // keine eigene Übersicht).
  loader: async ({ context, params }) => {
    try {
      const payment = await context.queryClient.ensureQueryData(
        paymentQueryOptions(params.paymentId),
      );

      const [aggregate, units] = await Promise.all([
        context.queryClient.ensureQueryData(
          tenantQueryOptions(payment.tenantId),
        ),
        context.queryClient.ensureQueryData(unitsQueryOptions),
      ]);

      return { payment, aggregate, units };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }

      throw error;
    }
  },
  component: PaymentEditPage,
  staticData: {
    crumb: ({ loaderData }) => {
      const data = loaderData as {
        payment: Payment;
        aggregate: TenantAggregate;
        units: Unit[];
      } | null;
      if (!data) {
        return [{ label: t("ui.common.crumbs.paymentEdit") }];
      }

      return [
        { label: t("ui.common.crumbs.tenants"), to: "/mieter" },
        {
          label: tenantIdentityLabel({
            aggregate: data.aggregate,
            units: data.units,
          }),
          to: `/mieter/${data.payment.tenantId}/konto`,
        },
        { label: paymentIdentityLabel(data.payment) },
      ];
    },
  },
});

/**
 * Gebühren leben im Mieterkonto: gemeinsame Crumb-Basis "Mieter ›
 * {Mietvertrag, verlinkt aufs Konto}"; die Blatt-Crumb variiert je Seite.
 */
const tenantAccountCrumbBase = (
  data: { aggregate: TenantAggregate; units: Unit[] } | undefined,
  tenantId: string,
): CrumbEntry[] => [
  { label: t("ui.common.crumbs.tenants"), to: "/mieter" },
  {
    label: data
      ? tenantIdentityLabel(data)
      : t("ui.common.crumbs.tenantContract"),
    to: `/mieter/${tenantId}/konto`,
  },
];

const feeContextLoader = async ({
  context,
  params,
}: {
  context: RouterContext;
  params: Record<string, string>;
}) => {
  const [aggregate, units] = await Promise.all([
    context.queryClient.ensureQueryData(
      tenantQueryOptions(params.tenantId ?? ""),
    ),
    context.queryClient.ensureQueryData(unitsQueryOptions),
  ]);
  return { aggregate, units };
};

const feeCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mieter/$tenantId/gebuehren/neu",
  beforeLoad: requireAuth,
  loader: feeContextLoader,
  component: FeePage,
  errorComponent: TenantScopedNotFound,
  staticData: {
    crumb: ({ loaderData, params }) => [
      ...tenantAccountCrumbBase(
        loaderData as { aggregate: TenantAggregate; units: Unit[] } | undefined,
        (params as { tenantId: string }).tenantId,
      ),
      { label: t("ui.common.crumbs.feeNew") },
    ],
  },
});

const feeEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mieter/$tenantId/gebuehren/$feeId/bearbeiten",
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    const [aggregate, units, fees] = await Promise.all([
      context.queryClient.ensureQueryData(tenantQueryOptions(params.tenantId)),
      context.queryClient.ensureQueryData(unitsQueryOptions),
      context.queryClient.ensureQueryData(
        tenantFeesQueryOptions(params.feeId ? params.tenantId : ""),
      ),
    ]);
    return {
      aggregate,
      units,
      fee: fees.find((row) => row.feeId === params.feeId) ?? null,
    };
  },
  component: FeePage,
  errorComponent: TenantScopedNotFound,
  staticData: {
    crumb: ({ loaderData, params }) => {
      const data = loaderData as
        | { aggregate: TenantAggregate; units: Unit[]; fee: FeeRow | null }
        | undefined;
      return [
        ...tenantAccountCrumbBase(
          data,
          (params as { tenantId: string }).tenantId,
        ),
        {
          label: data?.fee
            ? feeIdentityLabel(data.fee)
            : t("ui.common.crumbs.feeEdit"),
        },
      ];
    },
  },
});

/**
 * Alt-URL bleibt gültig: leitet auf den Konto-Tab des Mieters um.
 */
const mieterkontoDetailRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/mieterkonto/$tenantId",
  beforeLoad: ({ params }) => {
    const { tenantId } = params;
    throw redirect({ to: "/mieter/$tenantId/konto", params: { tenantId } });
  },
});

const meterTypeSet: ReadonlySet<MeterType> = new Set(meterTypes);

const metersSearchSchema = (search: Record<string, unknown>) => ({
  buildingId:
    typeof search.buildingId === "string" ? search.buildingId : undefined,
  unitId: typeof search.unitId === "string" ? search.unitId : undefined,
  type:
    typeof search.type === "string" &&
    meterTypeSet.has(search.type as MeterType)
      ? (search.type as MeterType)
      : undefined,
});

const metersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/zaehler",
  beforeLoad: requireAuth,
  validateSearch: metersSearchSchema,
  component: MetersOverview,
  staticData: { crumb: t("ui.common.crumbs.meters") },
});

const meterCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/zaehler/neu",
  beforeLoad: requirePrerequisite("meters"),
  validateSearch: metersSearchSchema,
  component: MeterCreatePage,
  staticData: {
    crumb: () => [
      { label: t("ui.common.crumbs.meters"), to: "/zaehler" },
      { label: t("ui.common.crumbs.meterNew") },
    ],
  },
});

const meterEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/zaehler/$meterId",
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(
        meterQueryOptions(params.meterId),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },
  component: MeterDetailPage,
  pendingComponent: () => (
    <DetailPending
      tile={<PageHeaderIcon icon={domainVisuals.meters.icon} />}
      statsSkeleton={3}
      rows={4}
      aside={true}
      tabs="default"
    />
  ),
  pendingMs: 0,
  staticData: {
    crumb: ({ loaderData }) => {
      const meter = loaderData as Meter | null;
      return [
        { label: t("ui.common.crumbs.meters"), to: "/zaehler" },
        { label: meter?.label ?? "" },
      ];
    },
  },
});

/**
 * Zählerstände-Tab des Zählers. Gleiche Entität wie die Stammdaten, nur ein
 * anderer Reiter -> Crumb konstant zur Zähler-Crumb (keine eigene Ebene).
 */
const meterReadingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/zaehler/$meterId/zaehlerstaende",
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(
        meterQueryOptions(params.meterId),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },
  component: MeterReadingsPage,
  pendingComponent: () => (
    <DetailPending
      tile={<PageHeaderIcon icon={domainVisuals.meters.icon} />}
      statsSkeleton={3}
      rows={4}
      tabs="default"
    />
  ),
  pendingMs: 0,
  staticData: {
    crumb: ({ loaderData }) => {
      const meter = loaderData as Meter | null;
      return [
        { label: t("ui.common.crumbs.meters"), to: "/zaehler" },
        { label: meter?.label ?? "" },
      ];
    },
  },
});

const heatingSearchSchema = (search: Record<string, unknown>) => ({
  buildingId:
    typeof search.buildingId === "string" ? search.buildingId : undefined,
});

const heatingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/heizkosten",
  beforeLoad: requireAuth,
  validateSearch: heatingSearchSchema,
  component: HeatingOverviewPage,
  staticData: { crumb: t("ui.common.crumbs.heating") },
});

const heatingVersionCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/heizkosten/neu",
  beforeLoad: requirePrerequisite("heating"),
  validateSearch: heatingSearchSchema,
  component: HeatingVersionCreatePage,
  staticData: {
    crumb: () => [
      { label: t("ui.common.crumbs.heating"), to: "/heizkosten" },
      { label: t("ui.common.crumbs.heatingVersionNew") },
    ],
  },
});

const heatingVersionEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/heizkosten/$id",
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(
        heatingSettingsByIdQueryOptions(params.id),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },
  component: HeatingVersionEditPage,
  staticData: {
    crumb: ({ loaderData }) => {
      const version = loaderData as HeatingSettings | null;
      return [
        { label: t("ui.common.crumbs.heating"), to: "/heizkosten" },
        {
          label: version
            ? heatingIdentityLabel(version)
            : t("ui.common.crumbs.heatingVersionEdit"),
        },
      ];
    },
  },
});

const costsSearchSchema = (search: Record<string, unknown>) => ({
  buildingId:
    typeof search.buildingId === "string" ? search.buildingId : undefined,
});

const costsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/kostenarten",
  beforeLoad: requireAuth,
  validateSearch: costsSearchSchema,
  component: CostsOverview,
  staticData: { crumb: t("ui.common.crumbs.costTypes") },
});

const costTypeCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/kostenarten/neu",
  beforeLoad: requirePrerequisite("costTypes"),
  validateSearch: costsSearchSchema,
  component: CostTypeCreatePage,
  staticData: {
    crumb: () => [
      { label: t("ui.common.crumbs.costTypes"), to: "/kostenarten" },
      { label: t("ui.common.crumbs.costTypeNew") },
    ],
  },
});

const costTypeEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/kostenarten/$costTypeId",
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(
        costTypeQueryOptions(params.costTypeId),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },
  component: CostTypeEditPage,
  staticData: {
    crumb: ({ loaderData }) => {
      const costType = loaderData as CostTypeDetail | null;
      return [
        { label: t("ui.common.crumbs.costTypes"), to: "/kostenarten" },
        {
          label: costType ? costType.name : t("ui.common.crumbs.costTypeEdit"),
        },
      ];
    },
  },
});

const invoicesSearchSchema = (search: Record<string, unknown>) => ({
  buildingId:
    typeof search.buildingId === "string" ? search.buildingId : undefined,
});

const invoicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rechnungen",
  beforeLoad: requireAuth,
  validateSearch: invoicesSearchSchema,
  component: InvoicesPage,
  staticData: { crumb: t("ui.common.crumbs.invoices") },
});

const costEntryCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rechnungen/neu",
  beforeLoad: requirePrerequisite("invoices"),
  component: CostEntryCreatePage,
  staticData: {
    crumb: () => [
      { label: t("ui.common.crumbs.invoices"), to: "/rechnungen" },
      { label: t("ui.common.crumbs.invoiceNew") },
    ],
  },
});

const costEntryEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rechnungen/$costEntryId",
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(
        costEntryQueryOptions(params.costEntryId),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },
  component: CostEntryEditPage,
  staticData: {
    crumb: ({ loaderData }) => {
      const entry = loaderData as CostEntryDetail | null;
      return [
        { label: t("ui.common.crumbs.invoices"), to: "/rechnungen" },
        {
          label: entry
            ? costEntryIdentityLabel(entry)
            : t("ui.common.crumbs.invoiceEdit"),
        },
      ];
    },
  },
});

const statementsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/abrechnungen",
  beforeLoad: requireAuth,
  component: StatementsPage,
  staticData: { crumb: t("ui.common.crumbs.statements") },
});

const statementCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/abrechnungen/neu",
  beforeLoad: requirePrerequisite("statements"),
  component: StatementCreatePage,
  staticData: {
    crumb: () => [
      { label: t("ui.common.crumbs.statements"), to: "/abrechnungen" },
      { label: t("ui.common.crumbs.statementNew") },
    ],
  },
});

/**
 * Alle Tabs der Abrechnungs-Detailseite sind eigene Routen (URL-adressierbar);
 * Loader + Crumb teilen sich diese Helper. Der Loader wärmt denselben Query-
 * Cache wie die Seite und lädt zusätzlich Mietvertrag + Wohnungen, damit die
 * Crumb die Abrechnung über Mieter und Wohnung identifiziert (statt nur über
 * den Zeitraum, der bei mehreren Mietern mehrdeutig wäre).
 */
type StatementDetailLoaderData = {
  statement: Statement;
  aggregate: TenantAggregate;
  units: Unit[];
};

const statementDetailLoader = async ({
  context,
  params,
}: {
  context: RouterContext;
  params: { statementId: string };
}): Promise<StatementDetailLoaderData | null> => {
  try {
    const statement = await context.queryClient.ensureQueryData(
      statementQueryOptions(params.statementId),
    );
    const [aggregate, units] = await Promise.all([
      context.queryClient.ensureQueryData(
        tenantQueryOptions(statement.tenantId),
      ),
      context.queryClient.ensureQueryData(unitsQueryOptions),
    ]);
    return { statement, aggregate, units };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
};

const statementDetailCrumb: Crumb = ({ loaderData }) => {
  const data = loaderData as StatementDetailLoaderData | null;
  return [
    { label: t("ui.common.crumbs.statements"), to: "/abrechnungen" },
    { label: data ? statementIdentityLabel(data) : "" },
  ];
};

const statementTabSet: ReadonlySet<StatementTab> = new Set(statementTabs);

const statementSearchSchema = (
  search: Record<string, unknown>,
): { tab?: StatementTab } => {
  const tab =
    typeof search.tab === "string" &&
    statementTabSet.has(search.tab as StatementTab)
      ? (search.tab as StatementTab)
      : undefined;

  return tab ? { tab } : {};
};

const statementDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/abrechnungen/$statementId",
  beforeLoad: requireAuth,
  validateSearch: statementSearchSchema,
  loader: statementDetailLoader,
  component: StatementDetailPage,
  pendingComponent: () => (
    <DetailPending
      tile={<PageHeaderIcon icon={domainVisuals.statements.icon} />}
      statsSkeleton={3}
      rows={8}
      aside={true}
      tabs="pills"
    />
  ),
  pendingMs: 0,
  staticData: { crumb: statementDetailCrumb },
});

/**
 * Einstiegspunkt der Einstellungen (Ziel der Breadcrumb): leitet auf den
 * ersten sichtbaren Reiter weiter.
 */
const settingsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/einstellungen",
  beforeLoad: async ({ context }) => {
    await requireAuth({ context });
    throw redirect({ to: "/einstellungen/absender" });
  },
});

/**
 * Einstiegspunkt des Konto-Bereichs (Ziel der Breadcrumb)
 */
const accountIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/konto",
  beforeLoad: async (args) => {
    await redirectAwayIfLocalAuth(args);
    throw redirect({ to: "/konto/profil" });
  },
});

const profileSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/konto/profil",
  beforeLoad: redirectAwayIfLocalAuth,
  component: ProfileSettingsPage,
  staticData: {
    crumb: () => [
      { label: t("ui.common.crumbs.account"), to: "/konto" },
      { label: t("ui.common.crumbs.settingsProfile") },
    ],
  },
});

const senderSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/einstellungen/absender",
  beforeLoad: requireAuth,
  component: SenderSettingsPage,
  staticData: {
    crumb: () => [
      { label: t("ui.common.crumbs.settings"), to: "/einstellungen" },
      { label: t("ui.common.crumbs.settingsSender") },
    ],
  },
});

const aiSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/einstellungen/ki",
  beforeLoad: requireAuth,
  component: AiSettingsPage,
  staticData: {
    crumb: () => [
      { label: t("ui.common.crumbs.settings"), to: "/einstellungen" },
      { label: t("ui.common.crumbs.settingsAi") },
    ],
  },
});

const internetSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/einstellungen/internet",
  beforeLoad: requireAuth,
  component: InternetSettingsPage,
  staticData: {
    crumb: () => [
      { label: t("ui.common.crumbs.settings"), to: "/einstellungen" },
      { label: t("ui.common.crumbs.settingsInternet") },
    ],
  },
});

const passwordSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/konto/passwort",
  beforeLoad: redirectAwayIfLocalAuth,
  component: PasswordSettingsPage,
  staticData: {
    crumb: () => [
      { label: t("ui.common.crumbs.account"), to: "/konto" },
      { label: t("ui.common.crumbs.settingsPassword") },
    ],
  },
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  setupRoute,
  passwordRecoveryRoute,
  outdatedVersionRoute,
  dashboardRoute,
  buildingsRoute,
  buildingCreateRoute,
  buildingEditRoute,
  unitsRoute,
  unitCreateRoute,
  unitEditRoute,
  tenantsRoute,
  tenantCreateRoute,
  tenantEditRoute,
  tenantAccountRoute,
  feeCreateRoute,
  feeEditRoute,
  paymentCreateRoute,
  paymentEditRoute,
  mieterkontoDetailRedirectRoute,
  metersRoute,
  meterCreateRoute,
  meterEditRoute,
  meterReadingsRoute,
  heatingRoute,
  heatingVersionCreateRoute,
  heatingVersionEditRoute,
  costsRoute,
  costTypeCreateRoute,
  costTypeEditRoute,
  invoicesRoute,
  costEntryCreateRoute,
  costEntryEditRoute,
  statementsRoute,
  statementCreateRoute,
  statementDetailRoute,
  settingsIndexRoute,
  accountIndexRoute,
  profileSettingsRoute,
  senderSettingsRoute,
  aiSettingsRoute,
  internetSettingsRoute,
  passwordSettingsRoute,
]);

/**
 * Steht ausserhalb der Breadcrumb-Shell und erbt den Tab-Titel sonst vom
 * zuvor besuchten Screen -> Titel selbst setzen.
 */
const RouteNotFound = () => {
  useDocumentTitle(t("ui.common.routeNotFound.title"));
  return (
    <NotFound
      title={t("ui.common.routeNotFound.title")}
      description={t("ui.common.routeNotFound.description")}
      action={
        <Button asChild={true} variant="outline">
          <Link to="/">{t("ui.common.action.backToHome")}</Link>
        </Button>
      }
    />
  );
};

export const router = createRouter({
  routeTree,
  context: { queryClient: undefined as unknown as QueryClient },
  defaultErrorComponent: ({ error, reset }) => (
    <ErrorFallback
      error={error}
      onRetry={() => {
        reset();
        router.invalidate().catch(() => undefined);
      }}
    />
  ),
  defaultNotFoundComponent: RouteNotFound,
});

export type CrumbEntry = {
  label: string;
  to?: string;
};

export type CrumbContext = {
  params: Record<string, string>;
  loaderData: unknown;
  pathname: string;
};

export type Crumb = string | ((ctx: CrumbContext) => string | CrumbEntry[]);

declare module "@tanstack/react-router" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: Module-Augmentation erfordert interface
  interface Register {
    router: typeof router;
  }
  // biome-ignore lint/style/useConsistentTypeDefinitions: Module-Augmentation erfordert interface
  interface StaticDataRouteOption {
    crumb?: Crumb;
  }
}
