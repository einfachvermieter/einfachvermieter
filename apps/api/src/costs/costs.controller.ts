import {
  attachmentMaxBytesFromEnv,
  type CostEntryCreateDto,
  type CostEntryUpdateDto,
  type CostTypeCreateDto,
  type CostTypeUpdateDto,
  costEntryCreateSchema,
  costEntryUpdateSchema,
  costTypeCreateSchema,
  costTypeUpdateSchema,
} from "@einfachvermieter/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import { parsePaginationQuery } from "../common/pagination.js";
import type { UploadedMulterFile } from "../common/uploaded-file.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { AttachmentsService } from "./attachments.service.js";
import { CostsService } from "./costs.service.js";

const MAX_ATTACHMENT_BYTES = attachmentMaxBytesFromEnv(process.env);

@Controller("costs")
@UseGuards(SessionAuthGuard, RolesGuard)
export class CostsController {
  constructor(
    private readonly costsService: CostsService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @Get("types")
  listCostTypes(
    @Query("buildingId") buildingId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
    @Query("q") q?: string,
  ) {
    if (page === undefined && pageSize === undefined && q === undefined) {
      // Unpaginiert: alle Kostenarten (für Zähler-Zuordnung, Auswahl
      // bei Rechnungserfassung etc.).
      return this.costsService.listAllCostTypes(buildingId);
    }
    const allowedSort = new Set(["name", "category"] as const);
    return this.costsService.listCostTypes({
      buildingId,
      ...parsePaginationQuery({ page, pageSize, sort, order, q }, allowedSort),
    });
  }

  @Post("types")
  @Roles("admin")
  createCostType(
    @Body(new ZodValidationPipe(costTypeCreateSchema))
    dto: CostTypeCreateDto,
  ) {
    return this.costsService.createCostType(dto);
  }

  @Patch("types/:id")
  @Roles("admin")
  updateCostType(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(costTypeUpdateSchema))
    patch: CostTypeUpdateDto,
  ) {
    return this.costsService.updateCostType(id, patch);
  }

  @Delete("types/:id")
  @Roles("admin")
  deleteCostType(@Param("id") id: string) {
    return this.costsService.deleteCostType(id);
  }

  @Get()
  listCostEntries(
    @Query("buildingId") buildingId?: string,
    @Query("costTypeId") costTypeId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
    @Query("q") q?: string,
  ) {
    if (page === undefined && pageSize === undefined && q === undefined) {
      // Unpaginiert: alle Rechnungs-Positionen (optional gefiltert
      // nach Kostenart und Periode), wird intern z. B. zur Abrechnungs-
      // berechnung genutzt.
      return this.costsService.listItems(costTypeId, from, to);
    }

    const allowedSort = new Set([
      "invoiceDate",
      "amount",
      "vendor",
      "period",
    ] as const);

    return this.costsService.listCostEntriesOverview({
      buildingId,
      costTypeId,
      ...parsePaginationQuery(
        { page, pageSize, sort, order, q },
        allowedSort,
        "desc",
      ),
    });
  }

  @Get(":id")
  getCostEntry(@Param("id") id: string) {
    return this.costsService.getCostEntry(id);
  }

  @Post()
  @Roles("admin")
  createCostEntry(
    @Body(new ZodValidationPipe(costEntryCreateSchema))
    dto: CostEntryCreateDto,
  ) {
    return this.costsService.createCostEntry(dto);
  }

  @Patch(":id")
  @Roles("admin")
  updateCostEntry(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(costEntryUpdateSchema))
    patch: CostEntryUpdateDto,
  ) {
    return this.costsService.updateCostEntry(id, patch);
  }

  @Delete(":id")
  @Roles("admin")
  deleteCostEntry(@Param("id") id: string) {
    return this.costsService.deleteCostEntry(id);
  }

  @Get(":id/attachments")
  listAttachments(@Param("id") id: string) {
    return this.attachmentsService.list(id);
  }

  @Post(":id/attachments")
  @Roles("admin")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_ATTACHMENT_BYTES } }),
  )
  uploadAttachment(
    @Param("id") id: string,
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Body("ocrText") ocrText?: string,
  ) {
    if (!file) {
      throw new BadRequestException(getI18n().t("errors.fileRequired"));
    }

    return this.attachmentsService.upload(id, { ...file, ocrText });
  }

  @Get(":id/attachments/:attachmentId")
  async downloadAttachment(
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { attachment, data } = await this.attachmentsService.loadFile(
      id,
      attachmentId,
    );

    response.setHeader("Content-Type", attachment.mimeType);
    response.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(attachment.originalFilename)}`,
    );
    response.setHeader("Content-Length", String(attachment.sizeBytes));

    return new StreamableFile(data);
  }

  @Delete(":id/attachments/:attachmentId")
  @Roles("admin")
  deleteAttachment(
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
  ) {
    return this.attachmentsService.delete(id, attachmentId);
  }
}
