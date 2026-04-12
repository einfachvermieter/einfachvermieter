import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module.js";
import { AttachmentsService } from "./attachments.service.js";
import { CostsController } from "./costs.controller.js";
import { CostsService } from "./costs.service.js";

@Module({
  imports: [StorageModule],
  controllers: [CostsController],
  providers: [CostsService, AttachmentsService],
  exports: [CostsService, AttachmentsService],
})
export class CostsModule {}
