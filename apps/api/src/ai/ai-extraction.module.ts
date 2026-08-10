import { Module } from "@nestjs/common";
import { CostsModule } from "../costs/costs.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { AiClientFactory } from "./ai-client.factory.js";
import { AiExtractionController } from "./ai-extraction.controller.js";
import { AiExtractionService } from "./ai-extraction.service.js";

@Module({
  imports: [CostsModule, SettingsModule, StorageModule],
  controllers: [AiExtractionController],
  providers: [AiExtractionService, AiClientFactory],
})
export class AiExtractionModule {}
