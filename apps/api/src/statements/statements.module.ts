import { Module } from "@nestjs/common";
import { AccountsModule } from "../accounts/accounts.module.js";
import { BuildingsModule } from "../buildings/buildings.module.js";
import { HeatingModule } from "../heating/heating.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { TenantsModule } from "../tenants/tenants.module.js";
import { UnitsModule } from "../units/units.module.js";
import { ClimateFactorService } from "./climate-factor.service.js";
import { ClimateFactorsController } from "./climate-factors.controller.js";
import { PdfService } from "./pdf.service.js";
import { StatementsController } from "./statements.controller.js";
import { StatementsService } from "./statements.service.js";

@Module({
  imports: [
    TenantsModule,
    HeatingModule,
    AccountsModule,
    BuildingsModule,
    UnitsModule,
    SettingsModule,
    StorageModule,
  ],
  controllers: [StatementsController, ClimateFactorsController],
  providers: [StatementsService, PdfService, ClimateFactorService],
  exports: [StatementsService],
})
export class StatementsModule {}
