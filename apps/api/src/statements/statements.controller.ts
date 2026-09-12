import {
  isoDate,
  type OperatingCostStatementAdvanceAdjustmentDto,
  type OperatingCostStatementCancelDto,
  type OperatingCostStatementCreateDto,
  operatingCostStatementAdvanceAdjustmentSchema,
  operatingCostStatementCancelSchema,
  operatingCostStatementCreateSchema,
} from "@einfachvermieter/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import type { AuthUser } from "../auth/auth.service.js";
import { parsePaginationQuery } from "../common/pagination.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import {
  STATEMENT_STORAGE,
  StorageService,
} from "../storage/storage.service.js";
import { PdfService } from "./pdf.service.js";
import { StatementsService } from "./statements.service.js";

const previewQuerySchema = z.object({
  buildingId: z.string().min(1),
  tenantId: z.string().min(1),
  from: isoDate(),
  to: isoDate(),
});

@Controller("statements")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles("admin")
export class StatementsController {
  private readonly logger = new Logger(StatementsController.name);

  constructor(
    private readonly statementsService: StatementsService,
    private readonly pdfService: PdfService,
    @Inject(STATEMENT_STORAGE) private readonly storage: StorageService,
  ) {}

  @Get()
  list(
    @Query("buildingId") buildingId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
    @Query("q") q?: string,
  ) {
    const allowedSort = new Set([
      "tenant",
      "period",
      "status",
      "balance",
    ] as const);
    return this.statementsService.list({
      buildingId,
      ...parsePaginationQuery(
        { page, pageSize, sort, order, q },
        allowedSort,
        "desc",
      ),
    });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.statementsService.get(id);
  }

  @Post()
  @Roles("admin")
  create(
    @Body(new ZodValidationPipe(operatingCostStatementCreateSchema))
    dto: OperatingCostStatementCreateDto,
  ) {
    return this.statementsService.create(dto);
  }

  /**
   * Live-Preview: Berechnet eine Abrechnung ohne zu speichern.
   * Wird vom Frontend bei jeder Änderung von Eingabedaten aufgerufen.
   */
  @Get("preview/calculate")
  preview(
    @Query(new ZodValidationPipe(previewQuerySchema))
    query: z.infer<typeof previewQuerySchema>,
  ) {
    return this.statementsService.calculate(
      query.buildingId,
      query.tenantId,
      query.from,
      query.to,
    );
  }

  /**
   * Finalisiert eine Abrechnung. Snapshot wird erstellt, ab hier unveränderlich.
   * Anschließend wird das PDF gerendert und im Storage abgelegt. Fehler
   * dabei werden geloggt, brechen den Finalize aber nicht zurück. Beim
   * nächsten PDF-Abruf rendert der Endpoint dann on-the-fly aus dem
   * Snapshot.
   */
  @Post(":id/finalize")
  @Roles("admin")
  async finalize(@Param("id") id: string, @Req() req: Request) {
    const user = req.user as AuthUser;
    const updated = await this.statementsService.finalize(id, user.userId);
    try {
      await this.pdfService.persistForStatement(id);
    } catch (err) {
      this.logger.error(
        `PDF persist after finalize failed for statement ${id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
    return updated;
  }

  /**
   * Storniert eine finalisierte Abrechnung (Soll auf dem Mieterkonto wird
   * zurückgenommen, Begründung Pflicht). Der Snapshot bleibt erhalten.
   */
  @Post(":id/cancel")
  @Roles("admin")
  cancel(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(operatingCostStatementCancelSchema))
    dto: OperatingCostStatementCancelDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.statementsService.cancel(id, user.userId, dto);
  }

  /**
   * Legt eine Korrektur-Abrechnung (neue Draft) zu einer finalisierten oder
   * stornierten Abrechnung an. Beim Finalisieren ersetzt sie das Original.
   */
  @Post(":id/correct")
  @Roles("admin")
  createCorrection(@Param("id") id: string) {
    return this.statementsService.createCorrection(id);
  }

  /**
   * Setzt oder entfernt die optionale Anpassung der monatlichen
   * NK-Vorauszahlung an einer Draft-Abrechnung. Beide Felder müssen
   * zusammen gesetzt oder zusammen `null` sein.
   */
  @Put(":id/advance-adjustment")
  @Roles("admin")
  setAdvanceAdjustment(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(operatingCostStatementAdvanceAdjustmentSchema))
    dto: OperatingCostStatementAdvanceAdjustmentDto,
  ) {
    return this.statementsService.setAdvanceAdjustment(id, dto);
  }

  /**
   * Liefert das NK-Statement als PDF.
   *
   * - Draft: rendert on-the-fly aus den aktuellen Stammdaten.
   * - Finalized mit gesetztem `pdfPath`: streamt aus dem Storage.
   * - Finalized ohne `pdfPath` (Altbestand / nach Render-Fehler beim
   *   Finalisieren): rendert on-the-fly aus dem Snapshot.
   */
  @Get(":id/pdf")
  async downloadPdf(
    @Param("id") id: string,
    @Res({ passthrough: true }) response: Response,
    @Query("download") download?: string,
  ) {
    const statement = await this.statementsService.get(id);
    const filename = await this.pdfService.filenameFor(statement);

    // Finalisierte Statements werden aus dem persistierten PDF geliefert.
    // Fehlt die Datei (z.B. nach Umzug des Storage-Verzeichnisses), rendern
    // wir aus dem Snapshot neu, statt einen Fehler zu werfen.
    const data =
      statement.status === "finalized" && statement.pdfPath
        ? await this.storage
            .read(statement.pdfPath)
            .catch(() => this.pdfService.renderForStatement(id))
        : await this.pdfService.renderForStatement(id);

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `${download === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    response.setHeader("Content-Length", String(data.byteLength));
    response.setHeader(
      "Cache-Control",
      // Entwürfe werden bei jedem Abruf neu gerendert, deshalb kurz cachen:
      // Die Oberfläche prüft die Antwort einmal vorab und zeigt sie danach
      // im Betrachter an, das wären sonst zwei Renderläufe.
      statement.status === "finalized"
        ? "private, max-age=3600"
        : "private, max-age=30",
    );
    return new StreamableFile(data);
  }

  @Delete(":id")
  @Roles("admin")
  delete(@Param("id") id: string) {
    return this.statementsService.delete(id);
  }
}
