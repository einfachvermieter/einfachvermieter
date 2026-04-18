import {
  type SenderSettingsUpdateDto,
  senderSettingsUpdateSchema,
} from "@einfachvermieter/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { Roles, RolesGuard, SessionAuthGuard } from "../auth/auth.guards.js";
import type { UploadedMulterFile } from "../common/uploaded-file.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { getI18n } from "../i18n/i18n.registry.js";
import { MAX_LOGO_BYTES, SettingsService } from "./settings.service.js";

@Controller("settings")
@UseGuards(SessionAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("sender")
  getSender() {
    return this.settingsService.getSenderSettings();
  }

  @Patch("sender")
  @Roles("admin")
  updateSender(
    @Body(new ZodValidationPipe(senderSettingsUpdateSchema))
    dto: SenderSettingsUpdateDto,
  ) {
    return this.settingsService.updateSenderSettings(dto);
  }

  @Post("sender/logo")
  @Roles("admin")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_LOGO_BYTES } }),
  )
  uploadLogo(@UploadedFile() file: UploadedMulterFile | undefined) {
    if (!file) {
      throw new BadRequestException(getI18n().t("errors.fileRequired"));
    }

    return this.settingsService.uploadLogo(file);
  }

  @Post("sender/logo/preview")
  @Roles("admin")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_LOGO_BYTES } }),
  )
  async previewLogo(
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!file) {
      throw new BadRequestException(getI18n().t("errors.fileRequired"));
    }

    const pdf = await this.settingsService.renderLogoPreview(file);

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Length", String(pdf.byteLength));
    response.setHeader("Cache-Control", "private, no-cache");

    return new StreamableFile(pdf);
  }

  @Get("sender/logo/preview")
  async downloadLogoPreview(@Res({ passthrough: true }) response: Response) {
    const pdf = await this.settingsService.renderStoredLogoPreview();
    if (!pdf) {
      throw new NotFoundException(getI18n().t("errors.logoNotSet"));
    }

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Length", String(pdf.byteLength));
    response.setHeader("Cache-Control", "private, no-cache");

    return new StreamableFile(pdf);
  }

  @Delete("sender/logo")
  @Roles("admin")
  deleteLogo() {
    return this.settingsService.deleteLogo();
  }

  @Get("sender/logo")
  async downloadLogo(@Res({ passthrough: true }) response: Response) {
    const logo = await this.settingsService.loadLogo();
    if (!logo) {
      throw new NotFoundException(getI18n().t("errors.logoNotSet"));
    }

    response.setHeader("Content-Type", logo.mimeType);
    response.setHeader("Content-Length", String(logo.data.byteLength));
    response.setHeader("Cache-Control", "private, no-cache");

    // Defense-in-Depth gegen stored XSS über manipulierte SVGs: selbst wenn
    // der Upload-Sanitizer etwas durchlässt, verbietet die Response-CSP beim
    // Inline-Rendern jede Skript-Ausführung und externe Referenzen.
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'",
    );

    return new StreamableFile(logo.data);
  }
}
