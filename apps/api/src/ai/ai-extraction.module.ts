import { Module } from "@nestjs/common";
import { CostsModule } from "../costs/costs.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { AiExtractionController } from "./ai-extraction.controller.js";
import { AiExtractionService } from "./ai-extraction.service.js";
import { MistralClient } from "./mistral-client.provider.js";

@Module({
  imports: [CostsModule, StorageModule],
  controllers: [AiExtractionController],
  providers: [AiExtractionService, MistralClient],
})
export class AiExtractionModule {}
