import { attachmentMaxBytesFromEnv } from "@einfachvermieter/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { z } from "zod";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import type { UploadedMulterFile } from "../common/uploaded-file.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { AiExtractionService } from "./ai-extraction.service.js";

const MAX_ATTACHMENT_BYTES = attachmentMaxBytesFromEnv(process.env);

const fromAttachmentSchema = z.object({
  costEntryId: z.string().min(1),
  attachmentId: z.string().min(1),
  buildingId: z.string().optional(),
});

type FromAttachmentDto = z.infer<typeof fromAttachmentSchema>;

@Controller("ai")
export class AiExtractionController {
  constructor(private readonly service: AiExtractionService) {}

  @Get("config")
  @UseGuards(SessionAuthGuard, RolesGuard)
  config() {
    return { mistralConfigured: this.service.isConfigured() };
  }

  @Post("extract-cost-entry/upload")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles("admin")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_ATTACHMENT_BYTES } }),
  )
  extractFromUpload(
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Body("buildingId") buildingId?: string,
  ) {
    if (!file) {
      throw new BadRequestException(getI18n().t("errors.fileRequired"));
    }

    return this.service.extractFromBuffer({
      buffer: file.buffer,
      mimeType: file.mimetype,
      buildingId: buildingId?.trim() || undefined,
    });
  }

  @Post("extract-cost-entry/from-attachment")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles("admin")
  extractFromAttachment(
    @Body(new ZodValidationPipe(fromAttachmentSchema))
    dto: FromAttachmentDto,
  ) {
    return this.service.extractFromAttachment(dto);
  }
}
