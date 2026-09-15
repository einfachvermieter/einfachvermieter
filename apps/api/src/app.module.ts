import { join } from "node:path";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ServeStaticModule } from "@nestjs/serve-static";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AccountsModule } from "./accounts/accounts.module.js";
import { AiExtractionModule } from "./ai/ai-extraction.module.js";
import { AppLockGuard } from "./auth/app-lock.guard.js";
import { AuthModule } from "./auth/auth.module.js";
import { BuildingsModule } from "./buildings/buildings.module.js";
import { CostsModule } from "./costs/costs.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { DiagnosticsModule } from "./diagnostics/diagnostics.module.js";
import { HealthModule } from "./health/health.module.js";
import { HeatingModule } from "./heating/heating.module.js";
import { I18nModule } from "./i18n/i18n.module.js";
import { MetersModule } from "./meters/meters.module.js";
import { PaymentsModule } from "./payments/payments.module.js";
import { SettingsModule } from "./settings/settings.module.js";
import { SetupModule } from "./setup/setup.module.js";
import { StatementsModule } from "./statements/statements.module.js";
import { StatsModule } from "./stats/stats.module.js";
import { TelemetryModule } from "./telemetry/telemetry.module.js";
import { TenantsModule } from "./tenants/tenants.module.js";
import { UnitsModule } from "./units/units.module.js";
import { UpdatesModule } from "./updates/updates.module.js";

const webDistPath =
  process.env.WEB_DIST_PATH || join(process.cwd(), "apps/web/dist");

@Module({
  imports: [
    // Globales Rate-Limit als Grundschutz (DoS/Scraping). Großzügig gewählt,
    // damit die SPA mit vielen parallelen Requests nicht ausgebremst wird; der
    // Login-Endpoint hat ein deutlich strikteres eigenes Limit (Brute-Force-
    // und Argon2-DoS-Schutz, siehe auth.controller).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),

    ServeStaticModule.forRoot({
      rootPath: webDistPath,
      exclude: ["/api/{*splat}"],
    }),
    I18nModule,
    DatabaseModule,
    HealthModule,
    DiagnosticsModule,
    AuthModule,
    BuildingsModule,
    UnitsModule,
    TenantsModule,
    PaymentsModule,
    MetersModule,
    CostsModule,
    HeatingModule,
    StatementsModule,
    StatsModule,
    UpdatesModule,
    TelemetryModule,
    AccountsModule,
    AiExtractionModule,
    SettingsModule,
    SetupModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AppLockGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
